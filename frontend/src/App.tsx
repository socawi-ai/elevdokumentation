import { Routes, Route, Link } from "react-router-dom";
import StudentListPage from "./pages/StudentListPage";
import StudentFormPage from "./pages/StudentFormPage";
import StudentImportPage from "./pages/StudentImportPage";

export default function App() {
  return (
    <div>
      <header>
        <Link to="/">StudentRacker</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<StudentListPage />} />
          <Route path="/students/new" element={<StudentFormPage />} />
          <Route path="/students/import" element={<StudentImportPage />} />
          <Route path="/students/:id/edit" element={<StudentFormPage />} />
        </Routes>
      </main>
    </div>
  );
}
