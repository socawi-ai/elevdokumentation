import type { Student } from "../api/students";

interface Props {
  student: Student;
}

export default function PrintableStudentSheet({ student }: Props) {
  return (
    <div style={{ border: "1px solid #000", padding: "2rem", maxWidth: "600px" }}>
      <h1>Student Record</h1>
      <p>
        <strong>First name:</strong> {student.firstName}
      </p>
      <p>
        <strong>Last name:</strong> {student.lastName}
      </p>
      <p>
        <strong>Birth date:</strong> {student.birthDate ?? "—"}
      </p>
      <p>
        <strong>Notes:</strong> {student.notes ?? "—"}
      </p>
    </div>
  );
}
