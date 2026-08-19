import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import StudentListPage from "./pages/StudentListPage";
import StudentFormPage from "./pages/StudentFormPage";
import StudentImportPage from "./pages/StudentImportPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import StatsPage from "./pages/StatsPage";
import { getEffectiveTheme, getStoredTheme, setTheme, type Theme } from "./theme";

function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getEffectiveTheme);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemChange() {
      if (!getStoredTheme()) setThemeState(getEffectiveTheme());
    }
    mq.addEventListener("change", handleSystemChange);
    return () => mq.removeEventListener("change", handleSystemChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={toggle}
      aria-label={theme === "dark" ? "Byt till ljust läge" : "Byt till mörkt läge"}
      title={theme === "dark" ? "Byt till ljust läge" : "Byt till mörkt läge"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

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
          <ThemeToggle />
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
      <footer className="app-footer">v0.3</footer>
    </div>
  );
}
