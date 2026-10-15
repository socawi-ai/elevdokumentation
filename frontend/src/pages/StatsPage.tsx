import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStudentStats, type StudentStats } from "../api/students";
import { errorMessage } from "../api/http";
import { useCourses } from "../coursesContext";

export default function StatsPage() {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState("");
  const [error, setError] = useState("");
  const { courses } = useCourses();

  function refresh() {
    setLoading(true);
    setError("");
    getStudentStats(groupFilter || undefined)
      .then(setStats)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [groupFilter]);

  if (error) return <p className="hint" style={{ color: "var(--color-danger)" }}>{error}</p>;
  if (loading || !stats) return <p className="loading-state">Laddar…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Statistik</h1>
      </div>
      <div className="list-filters">
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
          <option value="">Alla klasser</option>
          {stats.groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div className="course-grid">
        {courses.map(({ name: course, nationalTestDelprov }) => {
          const c = stats.byCourse[course];
          if (!c || c.totalStudents === 0) {
            return (
              <div className="course-card" key={course}>
                <h2>{course}</h2>
                <p className="hint">
                  {groupFilter ? `${groupFilter} läser inte kursen.` : "Inga elever att visa statistik för."}
                </p>
              </div>
            );
          }
          const isNationalTestCourse = nationalTestDelprov.length > 0;
          const gridParams = new URLSearchParams({ course });
          if (groupFilter) gridParams.set("klass", groupFilter);
          const tallyEntries = Object.entries(c.summaryGradeTally).sort(
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sv"),
          );
          return (
            <div className="course-card" key={course}>
              <h2>{course}</h2>
              {isNationalTestCourse && (
                <>
                  <p className="hint">
                    {c.studentsWithSummaryGrade} av {c.totalStudents} elever har betyg på nationella provet
                  </p>
                  {tallyEntries.length > 0 ? (
                    <ul className="assignment-list">
                      {tallyEntries.map(([grade, count]) => (
                        <li key={grade}>
                          <span>{grade}</span>
                          <span>{count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">Inget betyg på nationella provet satt ännu.</p>
                  )}
                </>
              )}
              {c.assignmentGradesPossible > 0 && (
                <p className="hint">
                  {c.assignmentGradesFilled} av {c.assignmentGradesPossible} uppgiftsbetyg ifyllda
                </p>
              )}
              <Link className="btn btn-sm" to={`/betyg?${gridParams}`}>
                {c.assignmentGradesFilled < c.assignmentGradesPossible ? "Fyll i saknade betyg →" : "Öppna betyg →"}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
