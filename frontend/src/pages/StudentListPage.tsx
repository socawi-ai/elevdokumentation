import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listStudents, deleteStudent, type Student } from "../api/students";

type SortField = "firstName" | "lastName" | "group";
type SortDirection = "asc" | "desc";

export default function StudentListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("lastName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function refresh() {
    setLoading(true);
    listStudents()
      .then((data) => {
        setStudents(data);
        const validIds = new Set(data.map((s) => s.id));
        setSelectedIds((prev) => new Set([...prev].filter((id) => validIds.has(id))));
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  const sortedStudents = useMemo(() => {
    const collator = new Intl.Collator("sv");
    const sorted = [...students].sort((a, b) => collator.compare(a[sortField], b[sortField]));
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [students, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function sortArrow(field: SortField) {
    if (field !== sortField) return null;
    return <span className="sort-arrow">{sortDirection === "asc" ? "▲" : "▼"}</span>;
  }

  async function handleDelete(id: string) {
    await deleteStudent(id);
    refresh();
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = sortedStudents.length > 0 && sortedStudents.every((s) => selectedIds.has(s.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sortedStudents.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...sortedStudents.map((s) => s.id)]));
    }
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
          {selectedIds.size > 0 && (
            <a
              className="btn"
              href={`/api/students/pdf/selected?ids=${[...selectedIds].join(",")}`}
              target="_blank"
              rel="noreferrer"
            >
              Skriv ut markerade ({selectedIds.size})
            </a>
          )}
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
                <th>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                </th>
                <th className="sortable-header" onClick={() => handleSort("firstName")}>
                  Förnamn {sortArrow("firstName")}
                </th>
                <th className="sortable-header" onClick={() => handleSort("lastName")}>
                  Efternamn {sortArrow("lastName")}
                </th>
                <th className="sortable-header" onClick={() => handleSort("group")}>
                  Klass {sortArrow("group")}
                </th>
                <th>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelected(s.id)}
                    />
                  </td>
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
