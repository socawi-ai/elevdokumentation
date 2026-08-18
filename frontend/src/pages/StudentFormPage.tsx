import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createStudent, getStudent, updateStudent, type StudentInput } from "../api/students";
import { listAssignments, type Assignment } from "../api/assignments";
import { listCourseSettings, type CourseSetting } from "../api/courseSettings";
import { getStudentData, saveStudentData, type StudentDataBundle } from "../api/studentData";
import { COURSES, NATIONAL_TEST_DELPROV } from "../courses";

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

  useEffect(() => {
    if (!id) return;
    Promise.all([getStudent(id), listAssignments(), listCourseSettings(), getStudentData(id)]).then(
      ([student, assignmentList, courseSettingList, sparseData]) => {
        setForm({ firstName: student.firstName, lastName: student.lastName, group: student.group });
        setAssignments(assignmentList);
        setCourseSettings(courseSettingList);
        setDataForm(overlayData(buildDefaultData(assignmentList), sparseData));
        setDataLoaded(true);
      },
    );
  }, [id]);

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

  return (
    <div>
      <h1>{isEdit ? "Redigera elev" : "Ny elev"}</h1>
      {error && (
        <p className="hint" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
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
            <h2 style={{ marginTop: "2rem" }}>Digital dokumentation</h2>
            <p className="hint" style={{ marginBottom: "1rem" }}>
              Fylls i här, visas ifyllt på elevens PDF istället för tomma rutor/rader.
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
                            <input
                              className="grade-input"
                              maxLength={4}
                              value={dataForm.assignmentGrades[a.id] ?? ""}
                              onChange={(e) => setAssignmentGrade(a.id, e.target.value)}
                            />
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
    </div>
  );
}
