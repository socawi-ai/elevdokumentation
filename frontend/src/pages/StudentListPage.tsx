import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listStudents,
  deleteStudent,
  archiveStudent,
  unarchiveStudent,
  bulkArchiveStudents,
  bulkUpdateGroup,
  type Student,
  type StatusFilter,
} from "../api/students";

type SortField = "firstName" | "lastName" | "group";
type SortDirection = "asc" | "desc";

export default function StudentListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("lastName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [rowError, setRowError] = useState("");
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  function refresh() {
    setLoading(true);
    listStudents(statusFilter)
      .then((data) => {
        setStudents(data);
        const validIds = new Set(data.map((s) => s.id));
        setSelectedIds((prev) => new Set([...prev].filter((id) => validIds.has(id))));
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [statusFilter]);

  const groups = useMemo(() => {
    const collator = new Intl.Collator("sv");
    return [...new Set(students.map((s) => s.group))].sort(collator.compare);
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (groupFilter && s.group !== groupFilter) return false;
      if (!q) return true;
      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      );
    });
  }, [students, search, groupFilter]);

  const sortedStudents = useMemo(() => {
    const collator = new Intl.Collator("sv");
    const sorted = [...filteredStudents].sort((a, b) => collator.compare(a[sortField], b[sortField]));
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [filteredStudents, sortField, sortDirection]);

  const filtersActive = search.trim() !== "" || groupFilter !== "" || statusFilter !== "active";

  function clearFilters() {
    setSearch("");
    setGroupFilter("");
    setStatusFilter("active");
  }

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

  async function handleArchive(id: string) {
    setRowError("");
    try {
      await archiveStudent(id);
      refresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Något gick fel, försök igen.");
    }
  }

  async function handleUnarchive(id: string) {
    setRowError("");
    try {
      await unarchiveStudent(id);
      refresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Något gick fel, försök igen.");
    }
  }

  async function handleBulkArchive() {
    setBulkBusy(true);
    setBulkMessage("");
    try {
      const result = await bulkArchiveStudents([...selectedIds]);
      setBulkMessage(`${result.updated} arkiverade`);
      refresh();
    } catch (err) {
      setBulkMessage(err instanceof Error ? err.message : "Något gick fel, försök igen.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkGroup() {
    const group = bulkGroup.trim();
    if (!group) return;
    setBulkBusy(true);
    setBulkMessage("");
    try {
      const result = await bulkUpdateGroup([...selectedIds], group);
      const parts = [`${result.updated} uppdaterade`];
      if (result.skipped > 0) parts.push(`${result.skipped} hoppade över (skulle bli dubbletter)`);
      if (result.notFound > 0) parts.push(`${result.notFound} hittades inte`);
      setBulkMessage(parts.join(", "));
      setBulkGroup("");
      refresh();
    } catch (err) {
      setBulkMessage(err instanceof Error ? err.message : "Något gick fel, försök igen.");
    } finally {
      setBulkBusy(false);
    }
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
      {selectedIds.size > 0 && (
        <div className="inline-form" style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Ny klass…"
            value={bulkGroup}
            onChange={(e) => setBulkGroup(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleBulkGroup}
            disabled={!bulkGroup.trim() || bulkBusy}
          >
            Byt klass för markerade ({selectedIds.size})
          </button>
          <button type="button" className="btn btn-sm" onClick={handleBulkArchive} disabled={bulkBusy}>
            Arkivera markerade ({selectedIds.size})
          </button>
        </div>
      )}
      {bulkMessage && <p className="hint">{bulkMessage}</p>}
      {rowError && <p className="hint" style={{ color: "var(--color-danger)" }}>{rowError}</p>}
      <div className="list-filters">
        <input type="text" placeholder="Sök namn…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">Alla klasser</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="active">Aktiva</option>
          <option value="archived">Arkiverade</option>
          <option value="all">Alla</option>
        </select>
        <span className="hint">
          {sortedStudents.length} av {students.length} elever
        </span>
        {filtersActive && (
          <button type="button" className="btn btn-sm" onClick={clearFilters}>
            Rensa filter
          </button>
        )}
      </div>
      {students.length === 0 ? (
        <p className="empty-state">
          {statusFilter === "archived" ? "Inga arkiverade elever." : "Inga elever ännu."}
        </p>
      ) : sortedStudents.length === 0 ? (
        <p className="empty-state">Inga elever matchar filtret.</p>
      ) : (
        <div className="table-wrap table-wrap-scroll">
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
                    <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelected(s.id)} />
                  </td>
                  <td>
                    {s.firstName}
                    {s.archived && (
                      <span className="badge badge-warning" style={{ marginLeft: "0.4rem" }}>
                        Arkiverad
                      </span>
                    )}
                  </td>
                  <td>{s.lastName}</td>
                  <td>{s.group}</td>
                  <td>
                    <div className="actions">
                      <Link className="btn btn-sm" to={`/students/${s.id}/edit`}>
                        Redigera
                      </Link>
                      <a className="btn btn-sm" href={`/api/students/${s.id}/pdf`} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                      {s.archived ? (
                        <button className="btn btn-sm" onClick={() => handleUnarchive(s.id)}>
                          Återaktivera
                        </button>
                      ) : (
                        <button className="btn btn-sm" onClick={() => handleArchive(s.id)}>
                          Arkivera
                        </button>
                      )}
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
