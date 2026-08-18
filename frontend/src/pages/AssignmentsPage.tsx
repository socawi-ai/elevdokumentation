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

  if (loading) return <p>Laddar…</p>;

  return (
    <div>
      <h1>Uppgifter</h1>
      <p>Hantera vilka uppgifter som listas för varje kurs på elevernas PDF-blad.</p>
      {COURSES.map((course) => {
        const courseAssignments = assignments.filter((a) => a.course === course);
        const isNationalTestCourse = (NATIONAL_TEST_COURSES as readonly string[]).includes(course);
        const showNationalTest = courseSettings.find((c) => c.course === course)?.showNationalTest ?? false;
        return (
          <section key={course}>
            <h2>{course}</h2>
            {isNationalTestCourse && (
              <p>
                <label>
                  <input
                    type="checkbox"
                    checked={showNationalTest}
                    onChange={(e) => handleToggleNationalTest(course, e.target.checked)}
                  />{" "}
                  Visa nationella prov på PDF:en
                </label>
              </p>
            )}
            {courseAssignments.length === 0 ? (
              <p>Inga uppgifter tillagda ännu.</p>
            ) : (
              <ul>
                {courseAssignments.map((a) => (
                  <li key={a.id}>
                    {a.name} <button onClick={() => handleDelete(a.id)}>Ta bort</button>
                  </li>
                ))}
              </ul>
            )}
            <form
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
              <button type="submit">Lägg till</button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
