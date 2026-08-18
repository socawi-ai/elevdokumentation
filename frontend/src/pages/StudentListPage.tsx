import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listStudents, deleteStudent, type Student } from "../api/students";

export default function StudentListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    listStudents()
      .then(setStudents)
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleDelete(id: string) {
    await deleteStudent(id);
    refresh();
  }

  if (loading) return <p>Laddar…</p>;

  return (
    <div>
      <h1>Elever</h1>
      <p>
        <Link to="/students/new">+ Ny elev</Link> <Link to="/students/import">Importera elever</Link>
      </p>
      {students.length === 0 ? (
        <p>Inga elever ännu.</p>
      ) : (
        <>
          <p>
            <a href="/api/students/pdf/all" target="_blank" rel="noreferrer">
              Skriv ut alla ({students.length}) (PDF)
            </a>
          </p>
          <table>
            <thead>
              <tr>
                <th>Förnamn</th>
                <th>Efternamn</th>
                <th>Klass</th>
                <th>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.firstName}</td>
                  <td>{s.lastName}</td>
                  <td>{s.group}</td>
                  <td>
                    <Link to={`/students/${s.id}/edit`}>Redigera</Link>{" "}
                    <a href={`/api/students/${s.id}/pdf`} target="_blank" rel="noreferrer">
                      Skriv ut (PDF)
                    </a>{" "}
                    <button onClick={() => handleDelete(s.id)}>Ta bort</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
