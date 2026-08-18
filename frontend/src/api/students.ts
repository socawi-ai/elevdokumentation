export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  group: string;
  createdAt: string;
  updatedAt: string;
}

export type StudentInput = Pick<Student, "firstName" | "lastName" | "group">;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export function listStudents(): Promise<Student[]> {
  return fetch("/api/students").then((res) => handle(res));
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
