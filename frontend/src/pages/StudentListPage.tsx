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

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Students</h1>
      <p className="no-print">
        <Link to="/students/new">+ New student</Link>
      </p>
      {students.length === 0 ? (
        <p>No students yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>First name</th>
              <th>Last name</th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.firstName}</td>
                <td>{s.lastName}</td>
                <td className="no-print">
                  <Link to={`/students/${s.id}/edit`}>Edit</Link>{" "}
                  <Link to={`/students/${s.id}/print`}>Print</Link>{" "}
                  <button onClick={() => handleDelete(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
