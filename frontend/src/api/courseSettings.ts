export interface CourseSetting {
  course: string;
  showNationalTest: boolean;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function listCourseSettings(): Promise<CourseSetting[]> {
  return fetch("/api/course-settings").then((res) => handle(res));
}

export function setCourseSetting(course: string, showNationalTest: boolean): Promise<CourseSetting> {
  return fetch(`/api/course-settings/${encodeURIComponent(course)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ showNationalTest }),
  }).then((res) => handle(res));
}
