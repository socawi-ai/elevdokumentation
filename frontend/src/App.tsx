import { Routes, Route, Link } from "react-router-dom";
import StudentListPage from "./pages/StudentListPage";
import StudentFormPage from "./pages/StudentFormPage";
import StudentPrintPage from "./pages/StudentPrintPage";

export default function App() {
  return (
    <div>
      <header className="no-print">
        <Link to="/">StudentRacker</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<StudentListPage />} />
          <Route path="/students/new" element={<StudentFormPage />} />
          <Route path="/students/:id/edit" element={<StudentFormPage />} />
          <Route path="/students/:id/print" element={<StudentPrintPage />} />
        </Routes>
      </main>
    </div>
  );
}
