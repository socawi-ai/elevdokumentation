import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  listStudents,
  deleteStudent,
  archiveStudent,
  unarchiveStudent,
  bulkArchiveStudents,
  bulkUpdateGroup,
  openStudentsPdf,
  type Student,
  type StatusFilter,
} from "../api/students";
import { errorMessage } from "../api/http";
import {
  applyFilters,
  DEFAULT_FILTERS,
  extractYear,
  filtersQuery,
  filtersToParams,
  readFilters,
  type SortField,
  type StudentFilters,
} from "../studentFilters";

export default function StudentListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const { q: search, klass: groupFilter, year: yearFilter, status: statusFilter, sort: sortField, dir: sortDirection } =
    filters;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  const years = useMemo(() => {
    const collator = new Intl.Collator("sv");
    return [...new Set(students.map((s) => extractYear(s.group)).filter((y): y is string => y !== null))].sort(
      collator.compare,
    );
  }, [students]);

  const sortedStudents = useMemo(() => applyFilters(students, filters), [students, filters]);

  // Status isn't counted: it picks which list is shown, and "Skriv ut alla"
  // should still read naturally for e.g. the full archived list.
  const narrowingFilters = search.trim() !== "" || groupFilter !== "" || yearFilter !== "";
  const filtersActive = narrowingFilters || statusFilter !== "active";

  // replace: typing in the search box shouldn't push one history entry per key.
  function updateFilters(patch: Partial<StudentFilters>) {
    setSearchParams(filtersToParams({ ...filters, ...patch }), { replace: true });
  }

  function clearFilters() {
    updateFilters({ q: "", klass: "", year: "", status: DEFAULT_FILTERS.status });
  }

  function handleSort(field: SortField) {
    if (field === sortField) {
      updateFilters({ dir: sortDirection === "asc" ? "desc" : "asc" });
    } else {
      updateFilters({ sort: field, dir: "asc" });
    }
  }

  function printSelected() {
    // Print in the list's current sort order, not click order. Selected
    // students hidden by the current filter still print, after the visible ones.
    const visible = sortedStudents.filter((s) => selectedIds.has(s.id)).map((s) => s.id);
    const hidden = [...selectedIds].filter((id) => !visible.includes(id));
    openStudentsPdf([...visible, ...hidden]);
  }

  function sortArrow(field: SortField) {
    if (field !== sortField) return null;
    return <span className="sort-arrow">{sortDirection === "asc" ? "▲" : "▼"}</span>;
  }

  async function handleDelete(student: Student) {
    const ok = window.confirm(
      `Ta bort ${student.firstName} ${student.lastName} permanent?\n\n` +
        "Alla betyg och anteckningar för eleven raderas och kan inte återställas. " +
        "Vill du bara dölja eleven (t.ex. när hen slutat), använd Arkivera istället.",
    );
    if (!ok) return;
    setRowError("");
    try {
      await deleteStudent(student.id);
      refresh();
    } catch (err) {
      setRowError(errorMessage(err));
    }
  }

  async function handleArchive(id: string) {
    setRowError("");
    try {
      await archiveStudent(id);
      refresh();
    } catch (err) {
      setRowError(errorMessage(err));
    }
  }

  async function handleUnarchive(id: string) {
    setRowError("");
    try {
      await unarchiveStudent(id);
      refresh();
    } catch (err) {
      setRowError(errorMessage(err));
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
      setBulkMessage(errorMessage(err));
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
      setBulkMessage(errorMessage(err));
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
            <button type="button" className="btn" onClick={printSelected}>
              Skriv ut markerade ({selectedIds.size})
            </button>
          )}
          {sortedStudents.length > 0 && (
            <button type="button" className="btn" onClick={() => openStudentsPdf(sortedStudents.map((s) => s.id))}>
              {narrowingFilters ? "Skriv ut filtrerade" : "Skriv ut alla"} ({sortedStudents.length})
            </button>
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
        <input type="text" placeholder="Sök namn…" value={search} onChange={(e) => updateFilters({ q: e.target.value })} />
        <select value={groupFilter} onChange={(e) => updateFilters({ klass: e.target.value })}>
          <option value="">Alla klasser</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={yearFilter} onChange={(e) => updateFilters({ year: e.target.value })}>
          <option value="">Alla årskullar</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => updateFilters({ status: e.target.value as StatusFilter })}>
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
                      <Link className="btn btn-sm" to={`/students/${s.id}/edit${filtersQuery(filters)}`}>
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
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s)}>
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
