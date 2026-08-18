export interface StudentDataBundle {
  assignmentGrades: Record<string, string>;
  nationalTestGrades: Record<string, Record<string, string>>;
  courseNotes: Record<string, { notes: string; summaryGrade: string }>;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function getStudentData(id: string): Promise<StudentDataBundle> {
  return fetch(`/api/students/${id}/data`).then((res) => handle(res));
}

export function saveStudentData(id: string, data: StudentDataBundle): Promise<StudentDataBundle> {
  return fetch(`/api/students/${id}/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => handle(res));
}
