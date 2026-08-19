import { useEffect, useState } from "react";
import { COURSES, NATIONAL_TEST_COURSES } from "../courses";
import { getStudentStats, type StudentStats } from "../api/students";

export default function StatsPage() {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState("");

  function refresh() {
    setLoading(true);
    getStudentStats(groupFilter || undefined)
      .then(setStats)
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [groupFilter]);

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
        {COURSES.map((course) => {
          const c = stats.byCourse[course];
          if (!c || c.totalStudents === 0) {
            return (
              <div className="course-card" key={course}>
                <h2>{course}</h2>
                <p className="hint">Inga elever att visa statistik för.</p>
              </div>
            );
          }
          const isNationalTestCourse = (NATIONAL_TEST_COURSES as readonly string[]).includes(course);
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
