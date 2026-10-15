import type { Course as CourseRow } from "@prisma/client";
import { prisma } from "./db.js";

export interface CourseConfig {
  name: string;
  sortOrder: number;
  page: 1 | 2;
  nationalTestDelprov: string[];
  showNationalTest: boolean;
}

function parseDelprov(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

export function toCourseConfig(row: CourseRow): CourseConfig {
  return {
    name: row.name,
    sortOrder: row.sortOrder,
    page: row.page === 2 ? 2 : 1,
    nationalTestDelprov: parseDelprov(row.nationalTestDelprov),
    showNationalTest: row.showNationalTest,
  };
}

export async function listCourses(): Promise<CourseConfig[]> {
  const rows = await prisma.course.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows.map(toCourseConfig);
}

// Explicit klass → courses configuration. A klass missing from the map takes
// every course (see the GroupCourse model).
export async function getGroupCourseMap(): Promise<Map<string, Set<string>>> {
  const rows = await prisma.groupCourse.findMany();
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.group)) map.set(r.group, new Set());
    map.get(r.group)!.add(r.course);
  }
  return map;
}

export function coursesForGroup(
  courses: CourseConfig[],
  groupCourseMap: Map<string, Set<string>>,
  group: string,
): CourseConfig[] {
  const selected = groupCourseMap.get(group);
  return selected ? courses.filter((c) => selected.has(c.name)) : courses;
}

export function groupTakesCourse(groupCourseMap: Map<string, Set<string>>, group: string, course: string): boolean {
  const selected = groupCourseMap.get(group);
  return !selected || selected.has(course);
}
