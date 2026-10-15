import { useEffect, useState, type FormEvent } from "react";
import {
  listAssignments,
  createAssignment,
  deleteAssignment,
  renameAssignment,
  reorderAssignments,
  type Assignment,
} from "../api/assignments";
import { createCourse, deleteCourse, reorderCourses, setGroupCourses, updateCourse, type Course } from "../api/courses";
import { errorMessage } from "../api/http";
import { useCourses } from "../coursesContext";

function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function parseDelprovList(text: string): string[] {
  return text
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

// Text that turns into an input on "Byt namn"; Enter saves, Escape cancels.
function RenameableText({ value, onSave }: { value: string; onSave: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <>
        <span className="renameable-text">{value}</span>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          aria-label={`Byt namn på ${value}`}
          title="Byt namn"
        >
          ✎
        </button>
      </>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (name && name !== value) await onSave(name);
    setEditing(false);
  }

  return (
    <form className="inline-form" style={{ flex: 1 }} onSubmit={submit}>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
      />
      <button className="btn btn-primary btn-sm" type="submit">
        Spara
      </button>
    </form>
  );
}

export default function AssignmentsPage() {
  const { courses, groupCourses, reload: reloadCourses, loading: coursesLoading } = useCourses();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [delprovDrafts, setDelprovDrafts] = useState<Record<string, string>>({});
  const [newCourseName, setNewCourseName] = useState("");
  const [newCoursePage, setNewCoursePage] = useState<1 | 2>(2);

  async function refresh() {
    const [a] = await Promise.all([listAssignments(), reloadCourses()]);
    setAssignments(a);
  }

  useEffect(() => {
    listAssignments()
      .then(setAssignments)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  // Wraps every mutation: show its error instead of failing silently, and
  // always re-sync with the server afterwards.
  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
    await refresh().catch((err) => setError(errorMessage(err)));
  }

  function handleAdd(course: string) {
    const name = (newNames[course] ?? "").trim();
    if (!name) return;
    run(async () => {
      await createAssignment({ course, name });
      setNewNames((prev) => ({ ...prev, [course]: "" }));
    });
  }

  function handleDeleteAssignment(a: Assignment) {
    const gradeWarning =
      a.gradeCount > 0 ? `\n\n${a.gradeCount} elever har betyg på uppgiften. Betygen raderas också.` : "";
    if (!window.confirm(`Ta bort uppgiften "${a.name}"?${gradeWarning}`)) return;
    run(() => deleteAssignment(a.id));
  }

  function handleMoveAssignment(courseAssignments: Assignment[], index: number, delta: -1 | 1) {
    run(() => reorderAssignments(moveItem(courseAssignments, index, delta).map((a) => a.id)));
  }

  function handleMoveCourse(index: number, delta: -1 | 1) {
    run(() => reorderCourses(moveItem(courses, index, delta).map((c) => c.name)));
  }

  function handleDeleteCourse(course: Course) {
    const count = assignments.filter((a) => a.course === course.name).length;
    const ok = window.confirm(
      `Ta bort kursen "${course.name}"?\n\n` +
        `Kursens ${count} uppgifter och ALLA elevers betyg, nationella prov och anteckningar i kursen raderas permanent.`,
    );
    if (!ok) return;
    run(() => deleteCourse(course.name));
  }

  function handleSaveDelprov(course: Course) {
    const draft = delprovDrafts[course.name];
    if (draft === undefined) return;
    const next = parseDelprovList(draft);
    const removed = course.nationalTestDelprov.filter((d) => !next.includes(d));
    if (removed.length > 0) {
      const ok = window.confirm(
        `Ta bort ${removed.join(", ")} från ${course.name}?\n\nElevernas resultat på ${
          removed.length === 1 ? "det delprovet" : "de delproven"
        } raderas.`,
      );
      if (!ok) return;
    }
    run(async () => {
      await updateCourse(course.name, { nationalTestDelprov: next });
      setDelprovDrafts((prev) => {
        const { [course.name]: _, ...rest } = prev;
        return rest;
      });
    });
  }

  function handleAddCourse(e: FormEvent) {
    e.preventDefault();
    const name = newCourseName.trim();
    if (!name) return;
    run(async () => {
      await createCourse(name, newCoursePage);
      setNewCourseName("");
    });
  }

  function handleToggleGroupCourse(group: string, selected: string[] | null, course: string, checked: boolean) {
    const current = selected ?? courses.map((c) => c.name);
    const next = checked ? [...current, course] : current.filter((c) => c !== course);
    if (next.length === 0) {
      setError("En klass måste läsa minst en kurs.");
      return;
    }
    run(() => setGroupCourses(group, next.length === courses.length ? null : next));
  }

  if (loading || coursesLoading) return <p className="loading-state">Laddar…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Kurser & uppgifter</h1>
      </div>
      <p className="hint" style={{ marginBottom: "1rem" }}>
        Hantera kurserna, deras ordning och vilken sida av PDF-bladet de skrivs ut på, samt uppgifterna som listas för
        varje kurs.
      </p>
      {error && (
        <p className="hint" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}

      <div className="course-grid">
        {courses.map((course, courseIndex) => {
          const courseAssignments = assignments.filter((a) => a.course === course.name);
          const delprovDraft = delprovDrafts[course.name] ?? course.nationalTestDelprov.join(", ");
          const delprovDirty = delprovDrafts[course.name] !== undefined;
          return (
            <div className="course-card" key={course.name}>
              <div className="course-card-header">
                <h2>
                  <RenameableText
                    value={course.name}
                    onSave={(name) => run(() => updateCourse(course.name, { name }))}
                  />
                </h2>
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={courseIndex === 0}
                    onClick={() => handleMoveCourse(courseIndex, -1)}
                    aria-label="Flytta kursen uppåt"
                    title="Flytta uppåt"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={courseIndex === courses.length - 1}
                    onClick={() => handleMoveCourse(courseIndex, 1)}
                    aria-label="Flytta kursen nedåt"
                    title="Flytta nedåt"
                  >
                    ↓
                  </button>
                </div>
              </div>

              <label className="toggle-row">
                PDF-sida
                <select
                  value={course.page}
                  onChange={(e) => run(() => updateCourse(course.name, { page: Number(e.target.value) as 1 | 2 }))}
                >
                  <option value={1}>Sida 1</option>
                  <option value={2}>Sida 2</option>
                </select>
              </label>

              <div className="course-subheading">Nationella prov</div>
              <form
                className="inline-form"
                style={{ marginBottom: "0.5rem" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveDelprov(course);
                }}
              >
                <input
                  value={delprovDraft}
                  onChange={(e) => setDelprovDrafts((prev) => ({ ...prev, [course.name]: e.target.value }))}
                  placeholder="Inga (t.ex. Delprov A, Delprov B)"
                />
                {delprovDirty && (
                  <button className="btn btn-primary btn-sm" type="submit">
                    Spara
                  </button>
                )}
              </form>
              {course.nationalTestDelprov.length > 0 && (
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={course.showNationalTest}
                    onChange={(e) => run(() => updateCourse(course.name, { showNationalTest: e.target.checked }))}
                  />
                  Visa nationella prov på PDF:en
                </label>
              )}

              <div className="course-subheading">Uppgifter</div>
              {courseAssignments.length === 0 ? (
                <p className="hint">Inga uppgifter tillagda ännu.</p>
              ) : (
                <ul className="assignment-list">
                  {courseAssignments.map((a, i) => (
                    <li key={a.id}>
                      <RenameableText value={a.name} onSave={(name) => run(() => renameAssignment(a.id, name))} />
                      <span className="assignment-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={i === 0}
                          onClick={() => handleMoveAssignment(courseAssignments, i, -1)}
                          aria-label="Flytta uppåt"
                          title="Flytta uppåt"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={i === courseAssignments.length - 1}
                          onClick={() => handleMoveAssignment(courseAssignments, i, 1)}
                          aria-label="Flytta nedåt"
                          title="Flytta nedåt"
                        >
                          ↓
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAssignment(a)}>
                          Ta bort
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAdd(course.name);
                }}
              >
                <input
                  value={newNames[course.name] ?? ""}
                  onChange={(e) => setNewNames((prev) => ({ ...prev, [course.name]: e.target.value }))}
                  placeholder="Ny uppgift"
                />
                <button className="btn btn-primary btn-sm" type="submit">
                  Lägg till
                </button>
              </form>

              <div style={{ marginTop: "1rem", textAlign: "right" }}>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteCourse(course)}>
                  Ta bort kursen
                </button>
              </div>
            </div>
          );
        })}

        <form className="course-card" onSubmit={handleAddCourse}>
          <h2>Ny kurs</h2>
          <div className="field">
            <input value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} placeholder="Kursnamn" />
          </div>
          <div className="inline-form">
            <select value={newCoursePage} onChange={(e) => setNewCoursePage(Number(e.target.value) as 1 | 2)}>
              <option value={1}>Sida 1</option>
              <option value={2}>Sida 2</option>
            </select>
            <button className="btn btn-primary btn-sm" type="submit" disabled={!newCourseName.trim()}>
              Lägg till kurs
            </button>
          </div>
          <p className="hint" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            Varje elev får alltid exakt ett dubbelsidigt blad, så många kurser på samma sida ger mindre plats för
            anteckningar.
          </p>
        </form>
      </div>

      <h2 style={{ marginTop: "2.5rem" }}>Klasser och kurser</h2>
      <p className="hint">
        Bocka ur kurser som en klass inte läser. De döljs då på elevens sida, i betygsmatrisen, i statistiken och på
        PDF:en. Klasser där allt är ibockat får automatiskt nya kurser som läggs till.
      </p>
      {groupCourses.length === 0 ? (
        <p className="empty-state">Inga klasser ännu.</p>
      ) : (
        <div className="table-wrap">
          <table className="checkbox-matrix">
            <thead>
              <tr>
                <th>Klass</th>
                {courses.map((c) => (
                  <th key={c.name}>{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupCourses.map(({ group, courses: selected }) => (
                <tr key={group}>
                  <td>{group}</td>
                  {courses.map((c) => (
                    <td key={c.name}>
                      <input
                        type="checkbox"
                        aria-label={`${group} läser ${c.name}`}
                        checked={selected === null || selected.includes(c.name)}
                        onChange={(e) => handleToggleGroupCourse(group, selected, c.name, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
