import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createStudent, getStudent, listStudents, updateStudent, type Student, type StudentInput } from "../api/students";
import { listAssignments, type Assignment } from "../api/assignments";
import { getStudentData, saveStudentData, type StudentDataBundle } from "../api/studentData";
import { errorMessage } from "../api/http";
import type { Course } from "../api/courses";
import { useCourses } from "../coursesContext";
import { applyFilters, filtersQuery, readFilters } from "../studentFilters";
import { ASSIGNMENT_GRADE_OPTIONS } from "../grades";

const emptyForm: StudentInput = { firstName: "", lastName: "", group: "" };

function emptyDataBundle(): StudentDataBundle {
  return { assignmentGrades: {}, nationalTestGrades: {}, courseNotes: {} };
}

function buildDefaultData(assignments: Assignment[], courses: Course[]): StudentDataBundle {
  const courseNames = new Set(courses.map((c) => c.name));
  const assignmentGrades: Record<string, string> = {};
  for (const a of assignments) if (courseNames.has(a.course)) assignmentGrades[a.id] = "";

  const nationalTestGrades: Record<string, Record<string, string>> = {};
  for (const course of courses) {
    if (course.nationalTestDelprov.length === 0) continue;
    nationalTestGrades[course.name] = {};
    for (const d of course.nationalTestDelprov) nationalTestGrades[course.name][d] = "";
  }

  const courseNotes: Record<string, { notes: string; summaryGrade: string }> = {};
  for (const course of courses) courseNotes[course.name] = { notes: "", summaryGrade: "" };

  return { assignmentGrades, nationalTestGrades, courseNotes };
}

// Overlays the stored (sparse) data onto the defaults, keeping only keys that
// belong to the student's current courses — so a save never touches data for
// courses the form doesn't show.
function overlayData(defaults: StudentDataBundle, sparse: StudentDataBundle): StudentDataBundle {
  const assignmentGrades: Record<string, string> = {};
  for (const id of Object.keys(defaults.assignmentGrades)) {
    assignmentGrades[id] = sparse.assignmentGrades[id] ?? "";
  }

  const nationalTestGrades: Record<string, Record<string, string>> = {};
  for (const course of Object.keys(defaults.nationalTestGrades)) {
    nationalTestGrades[course] = {};
    for (const d of Object.keys(defaults.nationalTestGrades[course])) {
      nationalTestGrades[course][d] = sparse.nationalTestGrades[course]?.[d] ?? "";
    }
  }

  const courseNotes: Record<string, { notes: string; summaryGrade: string }> = {};
  for (const course of Object.keys(defaults.courseNotes)) {
    courseNotes[course] = { ...defaults.courseNotes[course], ...(sparse.courseNotes[course] ?? {}) };
  }

  return { assignmentGrades, nationalTestGrades, courseNotes };
}

interface PendingSave {
  studentId: string;
  data: StudentDataBundle;
}

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const listQuery = filtersQuery(filters);
  const { coursesForGroup, loading: coursesLoading } = useCourses();

  const [form, setForm] = useState<StudentInput>(emptyForm);
  const [studentGroup, setStudentGroup] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dataForm, setDataForm] = useState<StudentDataBundle>(emptyDataBundle());
  // Which student `dataForm` belongs to. Autosave only runs while this matches
  // the route's id, so a render that happens between "id changed" and "new
  // student loaded" can never save the previous student's data to the new id.
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const justLoadedRef = useRef(false);
  const pendingSaveRef = useRef<PendingSave | null>(null);
  const currentIdRef = useRef(id);
  currentIdRef.current = id;

  const dataLoaded = isEdit && dataOwnerId === id;

  useEffect(() => {
    listStudents(filters.status).then(setAllStudents);
  }, [filters.status]);

  const flushPendingSave = useCallback(() => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    const isCurrent = () => currentIdRef.current === pending.studentId;
    saveStudentData(pending.studentId, pending.data)
      .then(() => isCurrent() && setAutosaveStatus("saved"))
      .catch(() => {
        if (isCurrent()) setAutosaveStatus("error");
        else window.alert("Kunde inte spara ändringarna för föregående elev. Gå tillbaka och kontrollera.");
      });
  }, []);

  // Leaving the student (prev/next, sidebar, another page) saves any edit
  // still waiting on the debounce timer instead of dropping it.
  useEffect(() => () => flushPendingSave(), [id, flushPendingSave]);

  useEffect(() => {
    if (!id || coursesLoading) return;
    let cancelled = false;
    setDataOwnerId(null);
    setError(null);
    setAutosaveStatus("idle");
    Promise.all([getStudent(id), listAssignments(), getStudentData(id)])
      .then(([student, assignmentList, sparseData]) => {
        // A slower response for a student we've already navigated away from.
        if (cancelled) return;
        setForm({ firstName: student.firstName, lastName: student.lastName, group: student.group });
        setStudentGroup(student.group);
        setAssignments(assignmentList);
        justLoadedRef.current = true;
        setDataForm(overlayData(buildDefaultData(assignmentList, coursesForGroup(student.group)), sparseData));
        setDataOwnerId(id);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [id, coursesLoading, coursesForGroup]);

  useEffect(() => {
    if (!dataLoaded || !id) return;
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }
    setAutosaveStatus("saving");
    pendingSaveRef.current = { studentId: id, data: dataForm };
    const timer = setTimeout(flushPendingSave, 600);
    return () => clearTimeout(timer);
  }, [dataForm, dataLoaded, id, flushPendingSave]);

  function setAssignmentGrade(assignmentId: string, grade: string) {
    setDataForm((prev) => ({ ...prev, assignmentGrades: { ...prev.assignmentGrades, [assignmentId]: grade } }));
  }

  function setDelprovGrade(course: string, delprov: string, grade: string) {
    setDataForm((prev) => ({
      ...prev,
      nationalTestGrades: {
        ...prev.nationalTestGrades,
        [course]: { ...prev.nationalTestGrades[course], [delprov]: grade },
      },
    }));
  }

  function setCourseNoteField(course: string, field: "notes" | "summaryGrade", value: string) {
    setDataForm((prev) => ({
      ...prev,
      courseNotes: {
        ...prev.courseNotes,
        [course]: { ...prev.courseNotes[course], [field]: value },
      },
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit && id) {
        // This save supersedes any pending autosave.
        pendingSaveRef.current = null;
        await updateStudent(id, form);
        await saveStudentData(id, dataForm);
      } else {
        await createStudent(form);
      }
      navigate(`/${listQuery}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const visibleStudents = useMemo(() => applyFilters(allStudents, filters), [allStudents, filters]);
  const currentIndex = visibleStudents.findIndex((s) => s.id === id);
  const prevStudent = currentIndex > 0 ? visibleStudents[currentIndex - 1] : null;
  const nextStudent =
    currentIndex >= 0 && currentIndex < visibleStudents.length - 1 ? visibleStudents[currentIndex + 1] : null;
  const studentCourses = isEdit ? coursesForGroup(studentGroup) : [];
  const filterLabel = [filters.klass, filters.year && `årskull ${filters.year}`, filters.q && `"${filters.q}"`]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="edit-layout">
      {visibleStudents.length > 0 && (
        <aside className="student-sidebar">
          <div className="sidebar-heading">
            Elever{filterLabel && ` · ${filterLabel}`} ({visibleStudents.length})
          </div>
          <ul className="sidebar-list">
            {visibleStudents.map((s) => (
              <li key={s.id}>
                <Link to={`/students/${s.id}/edit${listQuery}`} className={s.id === id ? "active" : undefined}>
                  <span className="sidebar-name">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="sidebar-group">{s.group}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div className="edit-main">
        <p style={{ margin: "0 0 0.5rem" }}>
          <Link to={`/${listQuery}`}>← Tillbaka till listan</Link>
        </p>
        <div className="page-header">
          <h1>{isEdit ? "Redigera elev" : "Ny elev"}</h1>
          {isEdit && (
            <div className="actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={!prevStudent}
                onClick={() => prevStudent && navigate(`/students/${prevStudent.id}/edit${listQuery}`)}
              >
                ← Föregående
              </button>
              {currentIndex >= 0 && (
                <span className="hint" style={{ alignSelf: "center" }}>
                  {currentIndex + 1} / {visibleStudents.length}
                </span>
              )}
              <button
                type="button"
                className="btn btn-sm"
                disabled={!nextStudent}
                onClick={() => nextStudent && navigate(`/students/${nextStudent.id}/edit${listQuery}`)}
              >
                Nästa →
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="hint" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        )}

        {isEdit && !dataLoaded ? (
          !error && <p className="loading-state">Laddar…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-card">
              <div className="field">
                <label htmlFor="firstName">Förnamn</label>
                <input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="lastName">Efternamn</label>
                <input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="group">Klass</label>
                <input
                  id="group"
                  value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })}
                  placeholder="t.ex. TE23A"
                  required
                />
              </div>
            </div>

            {dataLoaded && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "2rem" }}>
                  <h2 style={{ margin: 0 }}>Digital dokumentation</h2>
                  {autosaveStatus === "saving" && <span className="hint">Sparar…</span>}
                  {autosaveStatus === "saved" && <span className="hint">Sparat</span>}
                  {autosaveStatus === "error" && (
                    <span className="hint" style={{ color: "var(--color-danger)" }}>
                      Kunde inte spara
                    </span>
                  )}
                </div>
                <p className="hint" style={{ marginBottom: "1rem" }}>
                  Fylls i här, visas ifyllt på elevens PDF istället för tomma rutor/rader. Sparas automatiskt. Visar
                  kurserna som klass {studentGroup} läser.
                </p>
                <div className="course-grid">
                  {studentCourses.map((course) => {
                    const courseAssignments = assignments.filter((a) => a.course === course.name);
                    const delprov = course.nationalTestDelprov;
                    const notes = dataForm.courseNotes[course.name]?.notes ?? "";

                    return (
                      <div className="course-card" key={course.name}>
                        <h2>{course.name}</h2>

                        <div className="course-subheading">Uppgifter</div>
                        {courseAssignments.length === 0 ? (
                          <p className="hint">Inga uppgifter tillagda ännu.</p>
                        ) : (
                          <div className="grade-list">
                            {courseAssignments.map((a) => (
                              <div className="grade-row" key={a.id}>
                                <span>{a.name}</span>
                                <select
                                  className="grade-input"
                                  value={dataForm.assignmentGrades[a.id] ?? ""}
                                  onChange={(e) => setAssignmentGrade(a.id, e.target.value)}
                                >
                                  <option value="">–</option>
                                  {ASSIGNMENT_GRADE_OPTIONS.map((g) => (
                                    <option key={g} value={g}>
                                      {g}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}

                        {delprov.length > 0 && course.showNationalTest && (
                          <>
                            <div className="course-subheading">Nationella prov</div>
                            <div className="grade-list">
                              {delprov.map((d) => (
                                <div className="grade-row" key={d}>
                                  <span>{d}</span>
                                  <input
                                    className="grade-input"
                                    maxLength={4}
                                    value={dataForm.nationalTestGrades[course.name]?.[d] ?? ""}
                                    onChange={(e) => setDelprovGrade(course.name, d, e.target.value)}
                                  />
                                </div>
                              ))}
                              <div className="grade-row">
                                <span>Sammanfattande betyg</span>
                                <input
                                  className="grade-input"
                                  maxLength={4}
                                  value={dataForm.courseNotes[course.name]?.summaryGrade ?? ""}
                                  onChange={(e) => setCourseNoteField(course.name, "summaryGrade", e.target.value)}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        <div className="course-subheading">Anteckningar</div>
                        <textarea
                          rows={4}
                          style={{ width: "100%" }}
                          value={notes}
                          onChange={(e) => setCourseNoteField(course.name, "notes", e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: "1.5rem" }}>
              {saving ? "Sparar…" : isEdit ? "Spara" : "Skapa"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
