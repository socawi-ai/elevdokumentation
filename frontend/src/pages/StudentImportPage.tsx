import { useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { importStudents } from "../api/students";

interface ParsedRow {
  firstName: string;
  lastName: string;
  group: string;
  valid: boolean;
  error?: string;
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

  return rows.map((cols) => {
    const [firstName = "", lastName = "", group = ""] = cols;
    if (!firstName || !lastName || !group) {
      return { firstName, lastName, group, valid: false, error: "Saknar förnamn, efternamn eller klass" };
    }
    return { firstName, lastName, group, valid: true };
  });
}

export default function StudentImportPage() {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  const rows = useMemo(() => parsePastedText(text), [text]);
  const validRows = rows.filter((r) => r.valid);
  const invalidCount = rows.length - validRows.length;

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
      <p>
        Klistra in listan här — kopierad direkt från ett kalkylark med kolumnerna Förnamn, Efternamn, Klass (en elev
        per rad). Du kan även skriva för hand: tryck Tab för att hoppa till nästa kolumn, eller skriv kommatecken
        eller flera mellanslag mellan kolumnerna.
      </p>
      <textarea
        rows={10}
        style={{ width: "100%", fontFamily: "monospace" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleTextareaKeyDown}
        placeholder={"Anna\tAndersson\tTE23A\nErik\tEriksson\tTE23A"}
      />

      {rows.length > 0 && (
        <>
          <p>
            {validRows.length} giltiga rader
            {invalidCount > 0 && <> — {invalidCount} ogiltiga rader hoppas över</>}
          </p>
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
                <tr key={i} style={{ background: row.valid ? undefined : "#fdd" }}>
                  <td>{row.firstName}</td>
                  <td>{row.lastName}</td>
                  <td>{row.group}</td>
                  <td>{row.valid ? "OK" : row.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p>
        <button onClick={handleImport} disabled={validRows.length === 0 || importing}>
          {importing ? "Importerar…" : `Importera ${validRows.length} elever`}
        </button>
      </p>
    </div>
  );
}
