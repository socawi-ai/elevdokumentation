import { useEffect, useState } from "react";
import { COURSES, NATIONAL_TEST_COURSES } from "../courses";
import { listAssignments, createAssignment, deleteAssignment, type Assignment } from "../api/assignments";
import { listCourseSettings, setCourseSetting, type CourseSetting } from "../api/courseSettings";

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courseSettings, setCourseSettings] = useState<CourseSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNames, setNewNames] = useState<Record<string, string>>({});

  function refresh() {
    setLoading(true);
    Promise.all([listAssignments(), listCourseSettings()])
      .then(([a, c]) => {
        setAssignments(a);
        setCourseSettings(c);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleAdd(course: string) {
    const name = (newNames[course] ?? "").trim();
    if (!name) return;
    await createAssignment({ course, name });
    setNewNames((prev) => ({ ...prev, [course]: "" }));
    refresh();
  }

  async function handleDelete(id: string) {
    await deleteAssignment(id);
    refresh();
  }

  async function handleToggleNationalTest(course: string, checked: boolean) {
    await setCourseSetting(course, checked);
    refresh();
  }

  if (loading) return <p className="loading-state">Laddar…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Uppgifter</h1>
      </div>
      <p className="hint" style={{ marginBottom: "1.5rem" }}>
        Hantera vilka uppgifter som listas för varje kurs på elevernas PDF-blad.
      </p>
      <div className="course-grid">
        {COURSES.map((course) => {
          const courseAssignments = assignments.filter((a) => a.course === course);
          const isNationalTestCourse = (NATIONAL_TEST_COURSES as readonly string[]).includes(course);
          const showNationalTest = courseSettings.find((c) => c.course === course)?.showNationalTest ?? false;
          return (
            <div className="course-card" key={course}>
              <h2>{course}</h2>
              {isNationalTestCourse && (
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={showNationalTest}
                    onChange={(e) => handleToggleNationalTest(course, e.target.checked)}
                  />
                  Visa nationella prov på PDF:en
                </label>
              )}
              {courseAssignments.length === 0 ? (
                <p className="hint">Inga uppgifter tillagda ännu.</p>
              ) : (
                <ul className="assignment-list">
                  {courseAssignments.map((a) => (
                    <li key={a.id}>
                      {a.name}
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>
                        Ta bort
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAdd(course);
                }}
              >
                <input
                  value={newNames[course] ?? ""}
                  onChange={(e) => setNewNames((prev) => ({ ...prev, [course]: e.target.value }))}
                  placeholder="Ny uppgift"
                />
                <button className="btn btn-primary btn-sm" type="submit">
                  Lägg till
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
