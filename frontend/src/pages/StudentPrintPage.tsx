import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import { getStudent, type Student } from "../api/students";
import PrintableStudentSheet from "../components/PrintableStudentSheet";

export default function StudentPrintPage() {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef });

  useEffect(() => {
    if (id) getStudent(id).then(setStudent);
  }, [id]);

  if (!student) return <p>Loading…</p>;

  return (
    <div>
      <button className="no-print" onClick={handlePrint}>
        Print
      </button>
      <div ref={contentRef}>
        <PrintableStudentSheet student={student} />
      </div>
    </div>
  );
}
