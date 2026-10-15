import { handle, sendJson } from "./http";

export interface Course {
  name: string;
  sortOrder: number;
  page: 1 | 2;
  nationalTestDelprov: string[];
  showNationalTest: boolean;
}

export interface GroupCourses {
  group: string;
  // null = the klass takes every course
  courses: string[] | null;
}

export function listCourses(): Promise<Course[]> {
  return fetch("/api/courses").then((res) => handle(res));
}

export function createCourse(name: string, page: 1 | 2): Promise<Course> {
  return sendJson("/api/courses", "POST", { name, page });
}

export function updateCourse(
  name: string,
  data: Partial<Pick<Course, "name" | "page" | "nationalTestDelprov" | "showNationalTest">>,
): Promise<Course> {
  return sendJson(`/api/courses/${encodeURIComponent(name)}`, "PUT", data);
}

export function deleteCourse(name: string): Promise<void> {
  return fetch(`/api/courses/${encodeURIComponent(name)}`, { method: "DELETE" }).then((res) => handle(res));
}

export function reorderCourses(names: string[]): Promise<Course[]> {
  return sendJson("/api/courses/reorder", "PUT", { names });
}

export function listGroupCourses(): Promise<GroupCourses[]> {
  return fetch("/api/group-courses").then((res) => handle(res));
}

export function setGroupCourses(group: string, courses: string[] | null): Promise<GroupCourses> {
  return sendJson(`/api/group-courses/${encodeURIComponent(group)}`, "PUT", { courses });
}
