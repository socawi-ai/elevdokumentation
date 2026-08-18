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

  if (loading) return <p className="loading-state">Laddar…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Elever</h1>
        <div className="actions">
          <Link className="btn btn-primary" to="/students/new">
            + Ny elev
          </Link>
          <Link className="btn" to="/students/import">
            Importera elever
          </Link>
          {students.length > 0 && (
            <a className="btn" href="/api/students/pdf/all" target="_blank" rel="noreferrer">
              Skriv ut alla ({students.length})
            </a>
          )}
        </div>
      </div>
      {students.length === 0 ? (
        <p className="empty-state">Inga elever ännu.</p>
      ) : (
        <div className="table-wrap">
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
                    <div className="actions">
                      <Link className="btn btn-sm" to={`/students/${s.id}/edit`}>
                        Redigera
                      </Link>
                      <a
                        className="btn btn-sm"
                        href={`/api/students/${s.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>
                        Ta bort
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
