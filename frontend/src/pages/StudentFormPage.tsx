import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createStudent, getStudent, listStudents, updateStudent, type Student, type StudentInput } from "../api/students";
import { listAssignments, type Assignment } from "../api/assignments";
import { listCourseSettings, type CourseSetting } from "../api/courseSettings";
import { getStudentData, saveStudentData, type StudentDataBundle } from "../api/studentData";
import { COURSES, NATIONAL_TEST_DELPROV } from "../courses";
import { ASSIGNMENT_GRADE_OPTIONS } from "../grades";

const emptyForm: StudentInput = { firstName: "", lastName: "", group: "" };

function emptyDataBundle(): StudentDataBundle {
  return { assignmentGrades: {}, nationalTestGrades: {}, courseNotes: {} };
}

function buildDefaultData(assignments: Assignment[]): StudentDataBundle {
  const assignmentGrades: Record<string, string> = {};
  for (const a of assignments) assignmentGrades[a.id] = "";

  const nationalTestGrades: Record<string, Record<string, string>> = {};
  for (const [course, delprov] of Object.entries(NATIONAL_TEST_DELPROV)) {
    nationalTestGrades[course] = {};
    for (const d of delprov ?? []) nationalTestGrades[course][d] = "";
  }

  const courseNotes: Record<string, { notes: string; summaryGrade: string }> = {};
  for (const course of COURSES) courseNotes[course] = { notes: "", summaryGrade: "" };

  return { assignmentGrades, nationalTestGrades, courseNotes };
}

function overlayData(defaults: StudentDataBundle, sparse: StudentDataBundle): StudentDataBundle {
  const assignmentGrades = { ...defaults.assignmentGrades, ...sparse.assignmentGrades };

  const nationalTestGrades: Record<string, Record<string, string>> = {};
  for (const course of Object.keys(defaults.nationalTestGrades)) {
    nationalTestGrades[course] = { ...defaults.nationalTestGrades[course], ...(sparse.nationalTestGrades[course] ?? {}) };
  }

  const courseNotes: Record<string, { notes: string; summaryGrade: string }> = {};
  for (const course of Object.keys(defaults.courseNotes)) {
    courseNotes[course] = { ...defaults.courseNotes[course], ...(sparse.courseNotes[course] ?? {}) };
  }

  return { assignmentGrades, nationalTestGrades, courseNotes };
}

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<StudentInput>(emptyForm);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courseSettings, setCourseSettings] = useState<CourseSetting[]>([]);
  const [dataForm, setDataForm] = useState<StudentDataBundle>(emptyDataBundle());
  const [dataLoaded, setDataLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const justLoadedRef = useRef(false);

  useEffect(() => {
    listStudents().then(setAllStudents);
  }, []);

  useEffect(() => {
    if (!id) return;
    setDataLoaded(false);
    setForm(emptyForm);
    setDataForm(emptyDataBundle());
    setAutosaveStatus("idle");
    Promise.all([getStudent(id), listAssignments(), listCourseSettings(), getStudentData(id)]).then(
      ([student, assignmentList, courseSettingList, sparseData]) => {
        setForm({ firstName: student.firstName, lastName: student.lastName, group: student.group });
        setAssignments(assignmentList);
        setCourseSettings(courseSettingList);
        justLoadedRef.current = true;
        setDataForm(overlayData(buildDefaultData(assignmentList), sparseData));
        setDataLoaded(true);
      },
    );
  }, [id]);

  useEffect(() => {
    if (!isEdit || !dataLoaded || !id) return;
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }
    setAutosaveStatus("saving");
    const timer = setTimeout(() => {
      saveStudentData(id, dataForm)
        .then(() => setAutosaveStatus("saved"))
        .catch(() => setAutosaveStatus("error"));
    }, 600);
    return () => clearTimeout(timer);
  }, [dataForm, isEdit, dataLoaded, id]);

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
        await updateStudent(id, form);
        await saveStudentData(id, dataForm);
      } else {
        await createStudent(form);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel, försök igen.");
    } finally {
      setSaving(false);
    }
  }

  const currentIndex = allStudents.findIndex((s) => s.id === id);
  const prevStudent = currentIndex > 0 ? allStudents[currentIndex - 1] : null;
  const nextStudent =
    currentIndex >= 0 && currentIndex < allStudents.length - 1 ? allStudents[currentIndex + 1] : null;

  return (
    <div className="edit-layout">
      {allStudents.length > 0 && (
        <aside className="student-sidebar">
          <div className="sidebar-heading">Elever</div>
          <ul className="sidebar-list">
            {allStudents.map((s) => (
              <li key={s.id}>
                <Link to={`/students/${s.id}/edit`} className={s.id === id ? "active" : undefined}>
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
        <div className="page-header">
          <h1>{isEdit ? "Redigera elev" : "Ny elev"}</h1>
          {isEdit && (
            <div className="actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={!prevStudent}
                onClick={() => prevStudent && navigate(`/students/${prevStudent.id}/edit`)}
              >
                ← Föregående
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!nextStudent}
                onClick={() => nextStudent && navigate(`/students/${nextStudent.id}/edit`)}
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
          <p className="loading-state">Laddar…</p>
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

            {isEdit && dataLoaded && (
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
                  Fylls i här, visas ifyllt på elevens PDF istället för tomma rutor/rader. Sparas automatiskt.
                </p>
                <div className="course-grid">
                  {COURSES.map((course) => {
                    const courseAssignments = assignments.filter((a) => a.course === course);
                    const delprov = NATIONAL_TEST_DELPROV[course];
                    const showNationalTest =
                      courseSettings.find((c) => c.course === course)?.showNationalTest ?? false;
                    const notes = dataForm.courseNotes[course]?.notes ?? "";

                    return (
                      <div className="course-card" key={course}>
                        <h2>{course}</h2>

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

                        {delprov && showNationalTest && (
                          <>
                            <div className="course-subheading">Nationella prov</div>
                            <div className="grade-list">
                              {delprov.map((d) => (
                                <div className="grade-row" key={d}>
                                  <span>{d}</span>
                                  <input
                                    className="grade-input"
                                    maxLength={4}
                                    value={dataForm.nationalTestGrades[course]?.[d] ?? ""}
                                    onChange={(e) => setDelprovGrade(course, d, e.target.value)}
                                  />
                                </div>
                              ))}
                              <div className="grade-row">
                                <span>Sammanfattande betyg</span>
                                <input
                                  className="grade-input"
                                  maxLength={4}
                                  value={dataForm.courseNotes[course]?.summaryGrade ?? ""}
                                  onChange={(e) => setCourseNoteField(course, "summaryGrade", e.target.value)}
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
                          onChange={(e) => setCourseNoteField(course, "notes", e.target.value)}
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
