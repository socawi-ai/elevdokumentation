import { handle, sendJson } from "./http";

export interface StudentDataBundle {
  assignmentGrades: Record<string, string>;
  nationalTestGrades: Record<string, Record<string, string>>;
  courseNotes: Record<string, { notes: string; summaryGrade: string }>;
}

// Only the keys present are saved; a courseNotes entry may omit a field to
// leave it unchanged.
export interface StudentDataPatch {
  assignmentGrades?: Record<string, string>;
  nationalTestGrades?: Record<string, Record<string, string>>;
  courseNotes?: Record<string, { notes?: string; summaryGrade?: string }>;
}

export function getStudentData(id: string): Promise<StudentDataBundle> {
  return fetch(`/api/students/${id}/data`).then((res) => handle(res));
}

export function saveStudentData(id: string, data: StudentDataPatch): Promise<StudentDataBundle> {
  return sendJson(`/api/students/${id}/data`, "PUT", data);
}
