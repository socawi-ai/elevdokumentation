import { useEffect, useState } from "react";
import { COURSES } from "../courses";
import { listAssignments, createAssignment, deleteAssignment, type Assignment } from "../api/assignments";

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNames, setNewNames] = useState<Record<string, string>>({});

  function refresh() {
    setLoading(true);
    listAssignments()
      .then(setAssignments)
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

  if (loading) return <p>Laddar…</p>;

  return (
    <div>
      <h1>Uppgifter</h1>
      <p>Hantera vilka uppgifter som listas för varje kurs på elevernas PDF-blad.</p>
      {COURSES.map((course) => {
        const courseAssignments = assignments.filter((a) => a.course === course);
        return (
          <section key={course}>
            <h2>{course}</h2>
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
