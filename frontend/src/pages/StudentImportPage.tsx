import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { importStudents, listStudents, type Student } from "../api/students";

type RowStatus = "ok" | "invalid" | "duplicate";

interface ParsedRow {
  firstName: string;
  lastName: string;
  group: string;
  status: RowStatus;
  message?: string;
}

function normalizeKey(firstName: string, lastName: string, group: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${group.trim().toLowerCase()}`;
}

function parsePastedText(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Accepts a real tab (pasted from a spreadsheet, or typed via the Tab key
  // in the textarea below), a comma, or two-or-more spaces as the column
  // separator — so rows can also be typed by hand without a spreadsheet.
  const rows = lines.map((line) => line.split(/\t|,\s*|\s{2,}/).map((cell) => cell.trim()));

  if (rows.length > 0) {
    const [c0, c1, c2] = rows[0].map((c) => c.toLowerCase());
    if (c0 === "förnamn" && c1 === "efternamn" && (c2 === "klass" || c2 === "grupp")) {
      rows.shift();
    }
  }

  return rows.map((cols): ParsedRow => {
    const [firstName = "", lastName = "", group = ""] = cols;
    if (!firstName || !lastName || !group) {
      return { firstName, lastName, group, status: "invalid", message: "Saknar förnamn, efternamn eller klass" };
    }
    return { firstName, lastName, group, status: "ok" };
  });
}

function markDuplicates(rows: ParsedRow[], existing: Student[]): ParsedRow[] {
  const existingKeys = new Set(existing.map((s) => normalizeKey(s.firstName, s.lastName, s.group)));
  const seen = new Set<string>();
  return rows.map((row) => {
    if (row.status !== "ok") return row;
    const key = normalizeKey(row.firstName, row.lastName, row.group);
    if (existingKeys.has(key) || seen.has(key)) {
      return { ...row, status: "duplicate", message: "Eleven finns redan" };
    }
    seen.add(key);
    return row;
  });
}

export default function StudentImportPage() {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    listStudents().then(setExistingStudents);
  }, []);

  const rows = useMemo(() => markDuplicates(parsePastedText(text), existingStudents), [text, existingStudents]);
  const validRows = rows.filter((r) => r.status === "ok");
  const invalidCount = rows.filter((r) => r.status === "invalid").length;
  const duplicateCount = rows.filter((r) => r.status === "duplicate").length;

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = text.slice(0, start) + "\t" + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 1;
    });
  }

  async function handleImport() {
    setImporting(true);
    try {
      await importStudents(validRows.map(({ firstName, lastName, group }) => ({ firstName, lastName, group })));
      navigate("/");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h1>Importera elever</h1>
      <p className="hint">
        Klistra in listan här — kopierad direkt från ett kalkylark med kolumnerna Förnamn, Efternamn, Klass (en elev
        per rad). Du kan även skriva för hand: tryck Tab för att hoppa till nästa kolumn, eller skriv kommatecken
        eller flera mellanslag mellan kolumnerna. Elever som redan finns (samma namn och klass) markeras som
        dubbletter och hoppas över automatiskt.
      </p>
      <textarea
        rows={10}
        style={{ width: "100%" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleTextareaKeyDown}
        placeholder={"Anna\tAndersson\tTE23A\nErik\tEriksson\tTE23A"}
      />

      {rows.length > 0 && (
        <>
          <p className="hint" style={{ marginTop: "1rem" }}>
            {validRows.length} giltiga rader
            {invalidCount > 0 && <> — {invalidCount} ogiltiga rader hoppas över</>}
            {duplicateCount > 0 && <> — {duplicateCount} dubbletter hoppas över</>}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Förnamn</th>
                  <th>Efternamn</th>
                  <th>Klass</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={row.status === "invalid" ? "row-invalid" : row.status === "duplicate" ? "row-duplicate" : undefined}
                  >
                    <td>{row.firstName}</td>
                    <td>{row.lastName}</td>
                    <td>{row.group}</td>
                    <td>
                      {row.status === "ok" && <span className="badge badge-ok">OK</span>}
                      {row.status === "invalid" && <span className="badge badge-error">{row.message}</span>}
                      {row.status === "duplicate" && <span className="badge badge-warning">{row.message}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p style={{ marginTop: "1.25rem" }}>
        <button className="btn btn-primary" onClick={handleImport} disabled={validRows.length === 0 || importing}>
          {importing ? "Importerar…" : `Importera ${validRows.length} elever`}
        </button>
      </p>
    </div>
  );
}
