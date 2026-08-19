import { Routes, Route, NavLink } from "react-router-dom";
import StudentListPage from "./pages/StudentListPage";
import StudentFormPage from "./pages/StudentFormPage";
import StudentImportPage from "./pages/StudentImportPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import StatsPage from "./pages/StatsPage";

export default function App() {
  return (
    <div>
      <header className="app-header">
        <NavLink to="/" className="brand">
          Elevdokumentation
        </NavLink>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : undefined)}>
            Elever
          </NavLink>
          <NavLink to="/uppgifter" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Uppgifter
          </NavLink>
          <NavLink to="/statistik" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Statistik
          </NavLink>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<StudentListPage />} />
          <Route path="/students/new" element={<StudentFormPage />} />
          <Route path="/students/import" element={<StudentImportPage />} />
          <Route path="/students/:id/edit" element={<StudentFormPage />} />
          <Route path="/uppgifter" element={<AssignmentsPage />} />
          <Route path="/statistik" element={<StatsPage />} />
        </Routes>
      </main>
      <footer className="app-footer">v0.2</footer>
    </div>
  );
}
