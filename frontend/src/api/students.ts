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

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export function listStudents(status: StatusFilter = "active"): Promise<Student[]> {
  return fetch(`/api/students?status=${status}`).then((res) => handle(res));
}

export function getStudent(id: string): Promise<Student> {
  return fetch(`/api/students/${id}`).then((res) => handle(res));
}

export function createStudent(data: StudentInput): Promise<Student> {
  return fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => handle(res));
}

export function updateStudent(id: string, data: StudentInput): Promise<Student> {
  return fetch(`/api/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => handle(res));
}

export function deleteStudent(id: string): Promise<void> {
  return fetch(`/api/students/${id}`, { method: "DELETE" }).then((res) => handle(res));
}

export function importStudents(students: StudentInput[]): Promise<{ count: number; duplicates: number }> {
  return fetch("/api/students/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ students }),
  }).then((res) => handle(res));
}

export function archiveStudent(id: string): Promise<Student> {
  return fetch(`/api/students/${id}/archive`, { method: "POST" }).then((res) => handle(res));
}

export function unarchiveStudent(id: string): Promise<Student> {
  return fetch(`/api/students/${id}/unarchive`, { method: "POST" }).then((res) => handle(res));
}

export function bulkArchiveStudents(ids: string[]): Promise<{ updated: number }> {
  return fetch("/api/students/bulk-archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  }).then((res) => handle(res));
}

export function bulkUpdateGroup(
  ids: string[],
  group: string,
): Promise<{ updated: number; skipped: number; notFound: number }> {
  return fetch("/api/students/bulk-klass", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, group }),
  }).then((res) => handle(res));
}

export function getStudentStats(group?: string): Promise<StudentStats> {
  const params = group ? `?group=${encodeURIComponent(group)}` : "";
  return fetch(`/api/students/stats${params}`).then((res) => handle(res));
}
