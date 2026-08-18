import { Routes, Route, Link } from "react-router-dom";
import StudentListPage from "./pages/StudentListPage";
import StudentFormPage from "./pages/StudentFormPage";
import StudentImportPage from "./pages/StudentImportPage";
import AssignmentsPage from "./pages/AssignmentsPage";

export default function App() {
  return (
    <div>
      <header>
        <Link to="/">StudentRacker</Link> <Link to="/uppgifter">Uppgifter</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<StudentListPage />} />
          <Route path="/students/new" element={<StudentFormPage />} />
          <Route path="/students/import" element={<StudentImportPage />} />
          <Route path="/students/:id/edit" element={<StudentFormPage />} />
          <Route path="/uppgifter" element={<AssignmentsPage />} />
        </Routes>
      </main>
    </div>
  );
}
