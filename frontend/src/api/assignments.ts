export interface Assignment {
  id: string;
  course: string;
  name: string;
  createdAt: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export function listAssignments(): Promise<Assignment[]> {
  return fetch("/api/assignments").then((res) => handle(res));
}

export function createAssignment(data: { course: string; name: string }): Promise<Assignment> {
  return fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => handle(res));
}

export function deleteAssignment(id: string): Promise<void> {
  return fetch(`/api/assignments/${id}`, { method: "DELETE" }).then((res) => handle(res));
}
