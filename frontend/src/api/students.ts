import { handle, sendJson } from "./http";

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  group: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StudentInput = Pick<Student, "firstName" | "lastName" | "group">;

export type StatusFilter = "active" | "archived" | "all";

export interface CourseStats {
  totalStudents: number;
  studentsWithSummaryGrade: number;
  summaryGradeTally: Record<string, number>;
  assignmentGradesFilled: number;
  assignmentGradesPossible: number;
}

export interface StudentStats {
  groups: string[];
  byCourse: Record<string, CourseStats>;
}

export function listStudents(status: StatusFilter = "active"): Promise<Student[]> {
  return fetch(`/api/students?status=${status}`).then((res) => handle(res));
}

export function getStudent(id: string): Promise<Student> {
  return fetch(`/api/students/${id}`).then((res) => handle(res));
}

export function createStudent(data: StudentInput): Promise<Student> {
  return sendJson("/api/students", "POST", data);
}

export function updateStudent(id: string, data: StudentInput): Promise<Student> {
  return sendJson(`/api/students/${id}`, "PUT", data);
}

export function deleteStudent(id: string): Promise<void> {
  return fetch(`/api/students/${id}`, { method: "DELETE" }).then((res) => handle(res));
}

export function importStudents(students: StudentInput[]): Promise<{ count: number; duplicates: number }> {
  return sendJson("/api/students/import", "POST", { students });
}

export function archiveStudent(id: string): Promise<Student> {
  return fetch(`/api/students/${id}/archive`, { method: "POST" }).then((res) => handle(res));
}

export function unarchiveStudent(id: string): Promise<Student> {
  return fetch(`/api/students/${id}/unarchive`, { method: "POST" }).then((res) => handle(res));
}

export function bulkArchiveStudents(ids: string[]): Promise<{ updated: number }> {
  return sendJson("/api/students/bulk-archive", "POST", { ids });
}

export function bulkUpdateGroup(
  ids: string[],
  group: string,
): Promise<{ updated: number; skipped: number; notFound: number }> {
  return sendJson("/api/students/bulk-klass", "PUT", { ids, group });
}

export function getStudentStats(group?: string): Promise<StudentStats> {
  const params = group ? `?group=${encodeURIComponent(group)}` : "";
  return fetch(`/api/students/stats${params}`).then((res) => handle(res));
}

export interface GradeGrid {
  students: Student[];
  grades: Record<
    string,
    { assignmentGrades: Record<string, string>; nationalTestGrades: Record<string, string>; summaryGrade: string }
  >;
}

export function getGradeGrid(course: string, group?: string): Promise<GradeGrid> {
  const params = new URLSearchParams({ course });
  if (group) params.set("group", group);
  return fetch(`/api/students/grid?${params}`).then((res) => handle(res));
}

// Opens the merged PDF for these students (in this order) in a new tab. Posts
// a form instead of linking to a URL, since a few hundred ids would overflow
// the URL length limit.
export function openStudentsPdf(ids: string[]): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/students/pdf/selected";
  form.target = "_blank";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "ids";
  input.value = ids.join(",");
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
