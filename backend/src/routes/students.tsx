import { Router } from "express";
import type { Response } from "express";
import type { Student } from "@prisma/client";
import { renderToStream } from "@react-pdf/renderer";
import { prisma } from "../db.js";
import { AllStudentsPdfDocument } from "../pdf/StudentPdfDocument.js";
import { getStudentDataBundle, getStudentDataBundles, saveStudentDataBundle, validateStudentDataBundleInput } from "../studentData.js";
import { asyncHandler } from "../asyncHandler.js";
import { coursesForGroup, getGroupCourseMap, groupTakesCourse, listCourses } from "../courses.js";
import { ASSIGNMENT_ORDER } from "./assignments.js";

export const studentsRouter = Router();

const MAX_PDF_STUDENTS = 500;

async function sendStudentsPdf(res: Response, students: Student[], filename: string): Promise<void> {
  const [assignments, courses, groupCourseMap, dataByStudentId] = await Promise.all([
    prisma.assignment.findMany({ orderBy: ASSIGNMENT_ORDER }),
    listCourses(),
    getGroupCourseMap(),
    getStudentDataBundles(students.map((s) => s.id)),
  ]);
  const stream = await renderToStream(
    <AllStudentsPdfDocument
      students={students}
      assignments={assignments}
      coursesForGroup={(group) => coursesForGroup(courses, groupCourseMap, group)}
      dataByStudentId={dataByStudentId}
    />,
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  stream.pipe(res);
}

// Prints the given students in the given order. Accepts ids either as a
// GET query string (?ids=a,b,c) or a POSTed form field — the frontend posts
// a form for big filtered lists, since 500 ids would overflow a URL.
async function sendSelectedPdf(rawIds: unknown, res: Response): Promise<void> {
  const ids = typeof rawIds === "string" ? rawIds.split(",").filter(Boolean) : [];
  if (ids.length === 0) {
    res.status(400).json({ error: "Inga elever valda" });
    return;
  }
  if (ids.length > MAX_PDF_STUDENTS) {
    res.status(400).json({ error: "För många elever valda" });
    return;
  }
  const students = await prisma.student.findMany({ where: { id: { in: ids } } });
  if (students.length === 0) {
    res.status(400).json({ error: "Inga elever valda" });
    return;
  }
  const byId = new Map(students.map((s) => [s.id, s]));
  const orderedStudents = ids.map((id) => byId.get(id)).filter((s): s is Student => Boolean(s));
  await sendStudentsPdf(res, orderedStudents, "valda-elever.pdf");
}

function normalizeKey(firstName: string, lastName: string, group: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${group.trim().toLowerCase()}`;
}

type StatusFilter = "active" | "archived" | "all";

function parseStatus(value: unknown): StatusFilter {
  return value === "archived" || value === "all" ? value : "active";
}

function statusWhere(status: StatusFilter) {
  return status === "all" ? {} : { archived: status === "archived" };
}

// SQLite doesn't support Prisma's case-insensitive `mode` filter, so duplicate
// detection just fetches everyone and compares in JS — fine at class-list
// scale (tens to low hundreds of students), consistent with how the rest of
// this app avoids pagination/indexing machinery it doesn't need yet. Archived
// students are excluded so a graduated student never blocks a new/edited
// active one from taking the same name + klass.
async function findDuplicateStudent(
  firstName: string,
  lastName: string,
  group: string,
  excludeId?: string,
): Promise<boolean> {
  const key = normalizeKey(firstName, lastName, group);
  const students = await prisma.student.findMany({
    where: { archived: false, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return students.some((s) => normalizeKey(s.firstName, s.lastName, s.group) === key);
}

const DUPLICATE_ERROR = "En elev med det namnet finns redan i den klassen";

studentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = parseStatus(req.query.status);
    const students = await prisma.student.findMany({ where: statusWhere(status), orderBy: { lastName: "asc" } });
    res.json(students);
  }),
);

studentsRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const status = parseStatus(req.query.status);
    const group = typeof req.query.group === "string" && req.query.group.trim() !== "" ? req.query.group : undefined;

    const students = await prisma.student.findMany({
      where: { ...statusWhere(status), ...(group ? { group } : {}) },
      select: { id: true, group: true },
    });
    const studentIds = students.map((s) => s.id);

    const activeStudents = await prisma.student.findMany({ where: { archived: false }, select: { group: true } });
    const groups = [...new Set(activeStudents.map((s) => s.group))].sort((a, b) => a.localeCompare(b, "sv"));

    const [assignments, courses, groupCourseMap] = await Promise.all([
      prisma.assignment.findMany(),
      listCourses(),
      getGroupCourseMap(),
    ]);
    const assignmentIdsByCourse = new Map<string, string[]>();
    for (const a of assignments) {
      if (!assignmentIdsByCourse.has(a.course)) assignmentIdsByCourse.set(a.course, []);
      assignmentIdsByCourse.get(a.course)!.push(a.id);
    }

    const [assignmentGrades, courseNotes] =
      studentIds.length === 0
        ? [[], []]
        : await Promise.all([
            prisma.assignmentGrade.findMany({ where: { studentId: { in: studentIds }, grade: { not: "" } } }),
            prisma.courseNote.findMany({ where: { studentId: { in: studentIds }, summaryGrade: { not: "" } } }),
          ]);

    const groupByStudentId = new Map(students.map((s) => [s.id, s.group]));
    const filledByAssignmentId = new Map<string, number>();
    const courseByAssignmentId = new Map(assignments.map((a) => [a.id, a.course]));
    for (const g of assignmentGrades) {
      // Only count grades from students whose klass takes the course, so
      // "filled" can never exceed "possible".
      const course = courseByAssignmentId.get(g.assignmentId);
      if (!course || !groupTakesCourse(groupCourseMap, groupByStudentId.get(g.studentId) ?? "", course)) continue;
      filledByAssignmentId.set(g.assignmentId, (filledByAssignmentId.get(g.assignmentId) ?? 0) + 1);
    }

    const byCourse: Record<
      string,
      {
        totalStudents: number;
        studentsWithSummaryGrade: number;
        summaryGradeTally: Record<string, number>;
        assignmentGradesFilled: number;
        assignmentGradesPossible: number;
      }
    > = {};

    for (const { name: course } of courses) {
      const totalStudents = students.filter((s) => groupTakesCourse(groupCourseMap, s.group, course)).length;
      const courseAssignmentIds = assignmentIdsByCourse.get(course) ?? [];
      const assignmentGradesFilled = courseAssignmentIds.reduce(
        (sum, id) => sum + (filledByAssignmentId.get(id) ?? 0),
        0,
      );
      const notesForCourse = courseNotes.filter(
        (n) => n.course === course && groupTakesCourse(groupCourseMap, groupByStudentId.get(n.studentId) ?? "", course),
      );
      const summaryGradeTally: Record<string, number> = {};
      for (const n of notesForCourse) {
        summaryGradeTally[n.summaryGrade] = (summaryGradeTally[n.summaryGrade] ?? 0) + 1;
      }
      byCourse[course] = {
        totalStudents,
        studentsWithSummaryGrade: notesForCourse.length,
        summaryGradeTally,
        assignmentGradesFilled,
        assignmentGradesPossible: courseAssignmentIds.length * totalStudents,
      };
    }

    res.json({ groups, byCourse });
  }),
);

studentsRouter.get(
  "/pdf/all",
  asyncHandler(async (req, res) => {
    const status = parseStatus(req.query.status);
    const students = await prisma.student.findMany({ where: statusWhere(status), orderBy: { lastName: "asc" } });
    if (students.length === 0) {
      res.status(400).json({ error: "Inga elever att skriva ut" });
      return;
    }
    await sendStudentsPdf(res, students, "alla-elever.pdf");
  }),
);

studentsRouter.get(
  "/pdf/selected",
  asyncHandler(async (req, res) => {
    await sendSelectedPdf(req.query.ids, res);
  }),
);

studentsRouter.post(
  "/pdf/selected",
  asyncHandler(async (req, res) => {
    await sendSelectedPdf(req.body?.ids, res);
  }),
);

// Everything the grade grid needs for one course in one request: the active
// students (optionally one klass) whose klass takes the course, plus their
// grades for that course.
studentsRouter.get(
  "/grid",
  asyncHandler(async (req, res) => {
    const course = typeof req.query.course === "string" ? req.query.course : "";
    const group = typeof req.query.group === "string" && req.query.group.trim() !== "" ? req.query.group : undefined;
    if (!(await prisma.course.findUnique({ where: { name: course } }))) {
      res.status(400).json({ error: "Ogiltig kurs" });
      return;
    }
    const [allStudents, groupCourseMap, assignments] = await Promise.all([
      prisma.student.findMany({ where: { archived: false, ...(group ? { group } : {}) }, orderBy: { lastName: "asc" } }),
      getGroupCourseMap(),
      prisma.assignment.findMany({ where: { course }, select: { id: true } }),
    ]);
    const students = allStudents.filter((s) => groupTakesCourse(groupCourseMap, s.group, course));
    const bundles = await getStudentDataBundles(students.map((s) => s.id));
    const assignmentIds = new Set(assignments.map((a) => a.id));

    const grades: Record<
      string,
      { assignmentGrades: Record<string, string>; nationalTestGrades: Record<string, string>; summaryGrade: string }
    > = {};
    for (const s of students) {
      const bundle = bundles.get(s.id)!;
      grades[s.id] = {
        assignmentGrades: Object.fromEntries(
          Object.entries(bundle.assignmentGrades).filter(([id]) => assignmentIds.has(id)),
        ),
        nationalTestGrades: bundle.nationalTestGrades[course] ?? {},
        summaryGrade: bundle.courseNotes[course]?.summaryGrade ?? "",
      };
    }
    res.json({ students, grades });
  }),
);

studentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) {
      res.status(404).json({ error: "Eleven hittades inte" });
      return;
    }
    res.json(student);
  }),
);

studentsRouter.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) {
      res.status(404).json({ error: "Eleven hittades inte" });
      return;
    }
    const safeName = `${student.firstName}-${student.lastName}`.replace(/[^\w-]+/g, "_");
    await sendStudentsPdf(res, [student], `${safeName}.pdf`);
  }),
);

studentsRouter.get(
  "/:id/data",
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) {
      res.status(404).json({ error: "Eleven hittades inte" });
      return;
    }
    const data = await getStudentDataBundle(student.id);
    res.json(data);
  }),
);

studentsRouter.put(
  "/:id/data",
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) {
      res.status(404).json({ error: "Eleven hittades inte" });
      return;
    }
    const validated = validateStudentDataBundleInput(req.body, await listCourses());
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    const result = await saveStudentDataBundle(student.id, validated.value);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const data = await getStudentDataBundle(student.id);
    res.json(data);
  }),
);

studentsRouter.post(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    try {
      const student = await prisma.student.update({ where: { id: req.params.id }, data: { archived: true } });
      res.json(student);
    } catch {
      res.status(404).json({ error: "Eleven hittades inte" });
    }
  }),
);

studentsRouter.post(
  "/:id/unarchive",
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) {
      res.status(404).json({ error: "Eleven hittades inte" });
      return;
    }
    if (await findDuplicateStudent(student.firstName, student.lastName, student.group, student.id)) {
      res.status(409).json({ error: "Kan inte återaktivera: en aktiv elev med samma namn och klass finns redan" });
      return;
    }
    const updated = await prisma.student.update({ where: { id: req.params.id }, data: { archived: false } });
    res.json(updated);
  }),
);

studentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { firstName, lastName, group } = req.body;
    if (typeof firstName !== "string" || typeof lastName !== "string" || typeof group !== "string") {
      res.status(400).json({ error: "Förnamn, efternamn och klass krävs" });
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !group.trim()) {
      res.status(400).json({ error: "Förnamn, efternamn och klass krävs" });
      return;
    }
    if (await findDuplicateStudent(firstName, lastName, group)) {
      res.status(409).json({ error: DUPLICATE_ERROR });
      return;
    }
    const student = await prisma.student.create({
      data: { firstName, lastName, group },
    });
    res.status(201).json(student);
  }),
);

studentsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: "Ingen data att importera" });
      return;
    }
    if (students.length > 500) {
      res.status(400).json({ error: "För många elever i en import (max 500)" });
      return;
    }
    const valid = students
      .filter(
        (s): s is { firstName: string; lastName: string; group: string } =>
          typeof s?.firstName === "string" &&
          s.firstName.trim() !== "" &&
          typeof s?.lastName === "string" &&
          s.lastName.trim() !== "" &&
          typeof s?.group === "string" &&
          s.group.trim() !== "",
      )
      .map((s) => ({ firstName: s.firstName.trim(), lastName: s.lastName.trim(), group: s.group.trim() }));

    if (valid.length === 0) {
      res.status(400).json({ error: "Ingen giltig data att importera" });
      return;
    }

    const existing = await prisma.student.findMany({ where: { archived: false } });
    const seenKeys = new Set(existing.map((s) => normalizeKey(s.firstName, s.lastName, s.group)));
    const toCreate: typeof valid = [];
    let duplicates = 0;
    for (const s of valid) {
      const key = normalizeKey(s.firstName, s.lastName, s.group);
      if (seenKeys.has(key)) {
        duplicates++;
        continue;
      }
      seenKeys.add(key);
      toCreate.push(s);
    }

    if (toCreate.length === 0) {
      res.status(400).json({ error: "Alla rader var redan tillagda elever" });
      return;
    }
    const result = await prisma.student.createMany({ data: toCreate });
    res.status(201).json({ count: result.count, duplicates });
  }),
);

studentsRouter.post(
  "/bulk-archive",
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Inga elever valda" });
      return;
    }
    if (ids.length > 500) {
      res.status(400).json({ error: "För många elever valda" });
      return;
    }
    const idList = ids.filter((id): id is string => typeof id === "string");
    const result = await prisma.student.updateMany({ where: { id: { in: idList } }, data: { archived: true } });
    res.json({ updated: result.count });
  }),
);

studentsRouter.put(
  "/bulk-klass",
  asyncHandler(async (req, res) => {
    const { ids, group } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Inga elever valda" });
      return;
    }
    if (ids.length > 500) {
      res.status(400).json({ error: "För många elever i en gruppändring (max 500)" });
      return;
    }
    if (typeof group !== "string" || !group.trim()) {
      res.status(400).json({ error: "Klass krävs" });
      return;
    }
    const trimmedGroup = group.trim();
    const idSet = new Set(ids.filter((id): id is string => typeof id === "string"));

    const [targets, others] = await Promise.all([
      prisma.student.findMany({ where: { id: { in: [...idSet] } } }),
      prisma.student.findMany({ where: { id: { notIn: [...idSet] }, archived: false } }),
    ]);

    const occupied = new Set(others.map((s) => normalizeKey(s.firstName, s.lastName, trimmedGroup)));
    const targetById = new Map(targets.map((s) => [s.id, s]));
    const notFound = idSet.size - targets.length;

    const toUpdate: string[] = [];
    let skipped = 0;
    for (const id of idSet) {
      const student = targetById.get(id);
      if (!student) continue;
      const key = normalizeKey(student.firstName, student.lastName, trimmedGroup);
      if (occupied.has(key)) {
        skipped++;
        continue;
      }
      occupied.add(key);
      toUpdate.push(id);
    }

    if (toUpdate.length > 0) {
      await prisma.student.updateMany({ where: { id: { in: toUpdate } }, data: { group: trimmedGroup } });
    }

    res.json({ updated: toUpdate.length, skipped, notFound });
  }),
);

studentsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { firstName, lastName, group } = req.body;
    if (typeof firstName !== "string" || typeof lastName !== "string" || typeof group !== "string") {
      res.status(400).json({ error: "Förnamn, efternamn och klass krävs" });
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !group.trim()) {
      res.status(400).json({ error: "Förnamn, efternamn och klass krävs" });
      return;
    }
    if (await findDuplicateStudent(firstName, lastName, group, req.params.id)) {
      res.status(409).json({ error: DUPLICATE_ERROR });
      return;
    }
    try {
      const student = await prisma.student.update({
        where: { id: req.params.id },
        data: { firstName, lastName, group },
      });
      res.json(student);
    } catch {
      res.status(404).json({ error: "Eleven hittades inte" });
    }
  }),
);

studentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      await prisma.student.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch {
      res.status(404).json({ error: "Eleven hittades inte" });
    }
  }),
);
