import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getGradeGrid, type GradeGrid } from "../api/students";
import { listAssignments, type Assignment } from "../api/assignments";
import { saveStudentData, type StudentDataPatch } from "../api/studentData";
import { errorMessage } from "../api/http";
import { useCourses } from "../coursesContext";
import { filtersQuery, DEFAULT_FILTERS } from "../studentFilters";
import { ASSIGNMENT_GRADE_OPTIONS } from "../grades";

// Short labels so the grid columns stay narrow (same abbreviations as the PDF).
const SHORT_LABELS: Record<string, string> = { "Inte närvarande": "Frv", Deltagit: "Delt" };

// Keyboard shortcuts for assignment cells.
const KEY_TO_GRADE: Record<string, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  i: "Inte närvarande",
  x: "Deltagit",
};

type Column =
  | { kind: "assignment"; key: string; label: string; assignmentId: string }
  | { kind: "delprov"; key: string; label: string; delprov: string }
  | { kind: "summary"; key: string; label: string };

type GradesState = GradeGrid["grades"];

function cellValue(grades: GradesState, studentId: string, col: Column): string {
  const g = grades[studentId];
  if (!g) return "";
  if (col.kind === "assignment") return g.assignmentGrades[col.assignmentId] ?? "";
  if (col.kind === "delprov") return g.nationalTestGrades[col.delprov] ?? "";
  return g.summaryGrade;
}

function mergePatch(base: StudentDataPatch, add: StudentDataPatch): StudentDataPatch {
  const merged: StudentDataPatch = { ...base };
  if (add.assignmentGrades) merged.assignmentGrades = { ...base.assignmentGrades, ...add.assignmentGrades };
  if (add.nationalTestGrades) {
    merged.nationalTestGrades = { ...base.nationalTestGrades };
    for (const [course, delprov] of Object.entries(add.nationalTestGrades)) {
      merged.nationalTestGrades[course] = { ...merged.nationalTestGrades[course], ...delprov };
    }
  }
  if (add.courseNotes) {
    merged.courseNotes = { ...base.courseNotes };
    for (const [course, note] of Object.entries(add.courseNotes)) {
      merged.courseNotes[course] = { ...merged.courseNotes[course], ...note };
    }
  }
  return merged;
}

export default function GradeGridPage() {
  const { courses, groupCourses, loading: coursesLoading } = useCourses();
  const [searchParams, setSearchParams] = useSearchParams();
  const courseName = searchParams.get("course") ?? courses[0]?.name ?? "";
  const klass = searchParams.get("klass") ?? "";
  const course = courses.find((c) => c.name === courseName);

  const [grid, setGrid] = useState<GradeGrid | null>(null);
  const [grades, setGrades] = useState<GradesState>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Snapshot of who was missing a grade when the filter was switched on, so
  // rows don't vanish mid-typing as their last empty cell gets filled.
  const [missingOnly, setMissingOnly] = useState<Set<string> | null>(null);

  const pendingRef = useRef<Map<string, StudentDataPatch>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    pendingRef.current = new Map();
    Promise.all([...pending].map(([studentId, patch]) => saveStudentData(studentId, patch)))
      .then(() => setSaveStatus((s) => (s === "error" ? s : pendingRef.current.size > 0 ? "saving" : "saved")))
      .catch(() => setSaveStatus("error"));
  }, []);

  // Save anything still queued when switching course/klass or leaving the page.
  useEffect(() => () => flush(), [courseName, klass, flush]);

  useEffect(() => {
    if (!courseName) return;
    let cancelled = false;
    setGrid(null);
    setError("");
    setMissingOnly(null);
    Promise.all([getGradeGrid(courseName, klass || undefined), listAssignments()])
      .then(([g, a]) => {
        if (cancelled) return;
        setGrid(g);
        setGrades(g.grades);
        setAssignments(a.filter((x) => x.course === courseName));
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [courseName, klass]);

  const columns = useMemo<Column[]>(() => {
    const cols: Column[] = assignments.map((a) => ({
      kind: "assignment",
      key: `a:${a.id}`,
      label: a.name,
      assignmentId: a.id,
    }));
    if (course?.showNationalTest && course.nationalTestDelprov.length > 0) {
      for (const d of course.nationalTestDelprov) cols.push({ kind: "delprov", key: `d:${d}`, label: d, delprov: d });
      cols.push({ kind: "summary", key: "summary", label: "Sammanfattande" });
    }
    return cols;
  }, [assignments, course]);

  const students = useMemo(() => {
    const all = grid?.students ?? [];
    return missingOnly ? all.filter((s) => missingOnly.has(s.id)) : all;
  }, [grid, missingOnly]);

  function studentsMissingAny(): Set<string> {
    const ids = (grid?.students ?? [])
      .filter((s) => columns.some((col) => cellValue(grades, s.id, col) === ""))
      .map((s) => s.id);
    return new Set(ids);
  }

  function setCell(studentId: string, col: Column, value: string) {
    setGrades((prev) => {
      const g = prev[studentId] ?? { assignmentGrades: {}, nationalTestGrades: {}, summaryGrade: "" };
      const next = { ...g };
      if (col.kind === "assignment") next.assignmentGrades = { ...g.assignmentGrades, [col.assignmentId]: value };
      else if (col.kind === "delprov") next.nationalTestGrades = { ...g.nationalTestGrades, [col.delprov]: value };
      else next.summaryGrade = value;
      return { ...prev, [studentId]: next };
    });

    const patch: StudentDataPatch =
      col.kind === "assignment"
        ? { assignmentGrades: { [col.assignmentId]: value } }
        : col.kind === "delprov"
          ? { nationalTestGrades: { [courseName]: { [col.delprov]: value } } }
          : { courseNotes: { [courseName]: { summaryGrade: value } } };
    pendingRef.current.set(studentId, mergePatch(pendingRef.current.get(studentId) ?? {}, patch));
    setSaveStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 500);
  }

  function focusCell(row: number, col: number) {
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
    el?.focus();
  }

  function handleSelectKeyDown(e: KeyboardEvent<HTMLSelectElement>, row: number, colIndex: number, studentId: string) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const col = columns[colIndex];
    const key = e.key.toLowerCase();
    if (KEY_TO_GRADE[key]) {
      e.preventDefault();
      setCell(studentId, col, KEY_TO_GRADE[key]);
      focusCell(row + 1, colIndex);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      setCell(studentId, col, "");
    } else {
      handleArrowKeys(e, row, colIndex, true);
    }
  }

  function handleArrowKeys(e: KeyboardEvent<HTMLElement>, row: number, colIndex: number, horizontal: boolean) {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Enter: [1, 0],
      ...(horizontal ? { ArrowLeft: [0, -1], ArrowRight: [0, 1] } : {}),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    focusCell(row + move[0], colIndex + move[1]);
  }

  function updateParams(patch: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setSearchParams(next, { replace: true });
  }

  if (coursesLoading) return <p className="loading-state">Laddar…</p>;

  const groups = groupCourses.map((g) => g.group);
  const editQuery = filtersQuery({ ...DEFAULT_FILTERS, klass });

  return (
    <div>
      <div className="page-header">
        <h1>Betyg</h1>
        <span className="hint">
          {saveStatus === "saving" && "Sparar…"}
          {saveStatus === "saved" && "Alla ändringar sparade"}
          {saveStatus === "error" && (
            <span style={{ color: "var(--color-danger)" }}>Kunde inte spara alla ändringar — ladda om sidan</span>
          )}
        </span>
      </div>
      <div className="list-filters">
        <select value={courseName} onChange={(e) => updateParams({ course: e.target.value })}>
          {courses.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={klass} onChange={(e) => updateParams({ klass: e.target.value })}>
          <option value="">Alla klasser</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <label className="toggle-row" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={missingOnly !== null}
            onChange={(e) => setMissingOnly(e.target.checked ? studentsMissingAny() : null)}
          />
          Bara elever som saknar betyg
        </label>
      </div>
      <p className="hint">
        Markera en ruta och skriv <kbd>A</kbd>–<kbd>F</kbd> (hoppar till nästa elev), <kbd>I</kbd> = Inte närvarande,{" "}
        <kbd>X</kbd> = Deltagit, <kbd>Delete</kbd> rensar. Piltangenterna flyttar mellan rutor. Sparas automatiskt.
      </p>

      {error && (
        <p className="hint" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}

      {!grid ? (
        !error && <p className="loading-state">Laddar…</p>
      ) : grid.students.length === 0 ? (
        <p className="empty-state">
          Inga aktiva elever {klass ? `i ${klass} ` : ""}läser {courseName}.
        </p>
      ) : columns.length === 0 ? (
        <p className="empty-state">
          {courseName} har inga uppgifter ännu. <Link to="/kurser">Lägg till uppgifter</Link>
        </p>
      ) : students.length === 0 ? (
        <p className="empty-state">Alla elever har betyg i alla rutor.</p>
      ) : (
        <div className="table-wrap table-wrap-scroll">
          <table className="grade-grid" ref={tableRef}>
            <thead>
              <tr>
                <th>Elev</th>
                {!klass && <th>Klass</th>}
                {columns.map((col) => {
                  const missing = grid.students.filter((s) => cellValue(grades, s.id, col) === "").length;
                  return (
                    <th key={col.key} title={col.label}>
                      <div className="grade-grid-col-label">{col.label}</div>
                      <div className={missing > 0 ? "grade-grid-missing" : "grade-grid-complete"}>
                        {missing > 0 ? `${missing} saknas` : "klar"}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((s, row) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/students/${s.id}/edit${editQuery}`}>
                      {s.lastName}, {s.firstName}
                    </Link>
                  </td>
                  {!klass && <td className="hint">{s.group}</td>}
                  {columns.map((col, colIndex) => {
                    const value = cellValue(grades, s.id, col);
                    const cellClass = value === "" ? "grade-cell cell-missing" : "grade-cell";
                    return (
                      <td key={col.key}>
                        {col.kind === "assignment" ? (
                          <select
                            className={cellClass}
                            data-row={row}
                            data-col={colIndex}
                            aria-label={`${s.firstName} ${s.lastName}, ${col.label}`}
                            value={value}
                            onChange={(e) => setCell(s.id, col, e.target.value)}
                            onKeyDown={(e) => handleSelectKeyDown(e, row, colIndex, s.id)}
                          >
                            <option value="">–</option>
                            {ASSIGNMENT_GRADE_OPTIONS.map((g) => (
                              <option key={g} value={g} title={g}>
                                {SHORT_LABELS[g] ?? g}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className={cellClass}
                            data-row={row}
                            data-col={colIndex}
                            aria-label={`${s.firstName} ${s.lastName}, ${col.label}`}
                            maxLength={4}
                            value={value}
                            onChange={(e) => setCell(s.id, col, e.target.value)}
                            onKeyDown={(e) => handleArrowKeys(e, row, colIndex, false)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
