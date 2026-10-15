import { handle, sendJson } from "./http";

export interface Assignment {
  id: string;
  course: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  gradeCount: number;
}

export function listAssignments(): Promise<Assignment[]> {
  return fetch("/api/assignments").then((res) => handle(res));
}

export function createAssignment(data: { course: string; name: string }): Promise<Assignment> {
  return sendJson("/api/assignments", "POST", data);
}

export function renameAssignment(id: string, name: string): Promise<Assignment> {
  return sendJson(`/api/assignments/${id}`, "PUT", { name });
}

export function reorderAssignments(ids: string[]): Promise<void> {
  return sendJson("/api/assignments/reorder", "PUT", { ids });
}

export function deleteAssignment(id: string): Promise<void> {
  return fetch(`/api/assignments/${id}`, { method: "DELETE" }).then((res) => handle(res));
}
