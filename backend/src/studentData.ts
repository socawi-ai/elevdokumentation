import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { COURSES, NATIONAL_TEST_COURSES, NATIONAL_TEST_DELPROV, type CourseName } from "./courses.js";

export interface StudentDataBundle {
  assignmentGrades: Record<string, string>;
  nationalTestGrades: Record<string, Record<string, string>>;
  courseNotes: Record<string, { notes: string; summaryGrade: string }>;
}

export interface StudentDataBundleInput {
  assignmentGrades: Record<string, string>;
  nationalTestGrades: Record<string, Record<string, string>>;
  courseNotes: Record<string, { notes: string; summaryGrade: string }>;
}

function emptyBundle(): StudentDataBundle {
  return { assignmentGrades: {}, nationalTestGrades: {}, courseNotes: {} };
}

export async function getStudentDataBundles(studentIds: string[]): Promise<Map<string, StudentDataBundle>> {
  const map = new Map<string, StudentDataBundle>();
  if (studentIds.length === 0) return map;
  for (const id of studentIds) map.set(id, emptyBundle());

  const [assignmentGrades, nationalTestGrades, courseNotes] = await Promise.all([
    prisma.assignmentGrade.findMany({ where: { studentId: { in: studentIds } } }),
    prisma.nationalTestGrade.findMany({ where: { studentId: { in: studentIds } } }),
    prisma.courseNote.findMany({ where: { studentId: { in: studentIds } } }),
  ]);

  for (const g of assignmentGrades) {
    map.get(g.studentId)!.assignmentGrades[g.assignmentId] = g.grade;
  }
  for (const g of nationalTestGrades) {
    const bundle = map.get(g.studentId)!;
    if (!bundle.nationalTestGrades[g.course]) bundle.nationalTestGrades[g.course] = {};
    bundle.nationalTestGrades[g.course][g.delprov] = g.grade;
  }
  for (const n of courseNotes) {
    map.get(n.studentId)!.courseNotes[n.course] = { notes: n.notes, summaryGrade: n.summaryGrade };
  }

  return map;
}

export async function getStudentDataBundle(studentId: string): Promise<StudentDataBundle> {
  const map = await getStudentDataBundles([studentId]);
  return map.get(studentId) ?? emptyBundle();
}

export function validateStudentDataBundleInput(
  input: unknown,
): { ok: true; value: StudentDataBundleInput } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Ogiltig data" };
  }
  const raw = input as Record<string, unknown>;
  const assignmentGrades = raw.assignmentGrades ?? {};
  const nationalTestGrades = raw.nationalTestGrades ?? {};
  const courseNotes = raw.courseNotes ?? {};

  if (typeof assignmentGrades !== "object" || assignmentGrades === null) {
    return { ok: false, error: "Ogiltig data" };
  }
  for (const grade of Object.values(assignmentGrades as Record<string, unknown>)) {
    if (typeof grade !== "string") return { ok: false, error: "Ogiltig data" };
  }

  if (typeof nationalTestGrades !== "object" || nationalTestGrades === null) {
    return { ok: false, error: "Ogiltig data" };
  }
  for (const [course, delprovMap] of Object.entries(nationalTestGrades as Record<string, unknown>)) {
    if (!(NATIONAL_TEST_COURSES as readonly string[]).includes(course)) {
      return { ok: false, error: "Ogiltig kurs eller delprov" };
    }
    if (typeof delprovMap !== "object" || delprovMap === null) {
      return { ok: false, error: "Ogiltig data" };
    }
    const validDelprov: readonly string[] = NATIONAL_TEST_DELPROV[course as CourseName] ?? [];
    for (const [delprov, grade] of Object.entries(delprovMap as Record<string, unknown>)) {
      if (!validDelprov.includes(delprov)) return { ok: false, error: "Ogiltig kurs eller delprov" };
      if (typeof grade !== "string") return { ok: false, error: "Ogiltig data" };
    }
  }

  if (typeof courseNotes !== "object" || courseNotes === null) {
    return { ok: false, error: "Ogiltig data" };
  }
  for (const [course, data] of Object.entries(courseNotes as Record<string, unknown>)) {
    if (!(COURSES as readonly string[]).includes(course)) {
      return { ok: false, error: "Ogiltig kurs" };
    }
    if (typeof data !== "object" || data === null) return { ok: false, error: "Ogiltig data" };
    const { notes, summaryGrade } = data as { notes?: unknown; summaryGrade?: unknown };
    if (
      (notes !== undefined && typeof notes !== "string") ||
      (summaryGrade !== undefined && typeof summaryGrade !== "string")
    ) {
      return { ok: false, error: "Ogiltig data" };
    }
  }

  return {
    ok: true,
    value: {
      assignmentGrades: assignmentGrades as Record<string, string>,
      nationalTestGrades: nationalTestGrades as Record<string, Record<string, string>>,
      courseNotes: courseNotes as Record<string, { notes: string; summaryGrade: string }>,
    },
  };
}

export async function saveStudentDataBundle(
  studentId: string,
  input: StudentDataBundleInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const assignmentIds = Object.keys(input.assignmentGrades);
  if (assignmentIds.length > 0) {
    const existing = await prisma.assignment.findMany({
      where: { id: { in: assignmentIds } },
      select: { id: true },
    });
    if (existing.length !== assignmentIds.length) {
      return { ok: false, error: "Ogiltigt uppgifts-id" };
    }
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (const [assignmentId, gradeRaw] of Object.entries(input.assignmentGrades)) {
    const grade = gradeRaw.trim();
    if (grade === "") {
      operations.push(prisma.assignmentGrade.deleteMany({ where: { studentId, assignmentId } }));
    } else {
      operations.push(
        prisma.assignmentGrade.upsert({
          where: { studentId_assignmentId: { studentId, assignmentId } },
          update: { grade },
          create: { studentId, assignmentId, grade },
        }),
      );
    }
  }

  for (const [course, delprovMap] of Object.entries(input.nationalTestGrades)) {
    for (const [delprov, gradeRaw] of Object.entries(delprovMap)) {
      const grade = gradeRaw.trim();
      if (grade === "") {
        operations.push(prisma.nationalTestGrade.deleteMany({ where: { studentId, course, delprov } }));
      } else {
        operations.push(
          prisma.nationalTestGrade.upsert({
            where: { studentId_course_delprov: { studentId, course, delprov } },
            update: { grade },
            create: { studentId, course, delprov, grade },
          }),
        );
      }
    }
  }

  for (const [course, data] of Object.entries(input.courseNotes)) {
    const notes = data.notes ?? "";
    const summaryGrade = (data.summaryGrade ?? "").trim();
    if (notes.trim() === "" && summaryGrade === "") {
      operations.push(prisma.courseNote.deleteMany({ where: { studentId, course } }));
    } else {
      operations.push(
        prisma.courseNote.upsert({
          where: { studentId_course: { studentId, course } },
          update: { notes, summaryGrade },
          create: { studentId, course, notes, summaryGrade },
        }),
      );
    }
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  return { ok: true };
}
