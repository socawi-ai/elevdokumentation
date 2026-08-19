import { Router } from "express";
import { renderToStream } from "@react-pdf/renderer";
import { prisma } from "../db.js";
import { StudentPdfDocument, AllStudentsPdfDocument } from "../pdf/StudentPdfDocument.js";
import { getStudentDataBundle, getStudentDataBundles, saveStudentDataBundle, validateStudentDataBundleInput } from "../studentData.js";
import { asyncHandler } from "../asyncHandler.js";

export const studentsRouter = Router();

async function getCourseSettingsMap(): Promise<Record<string, boolean>> {
  const rows = await prisma.courseSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.course, r.showNationalTest]));
}

function normalizeKey(firstName: string, lastName: string, group: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${group.trim().toLowerCase()}`;
}

// SQLite doesn't support Prisma's case-insensitive `mode` filter, so duplicate
// detection just fetches everyone and compares in JS — fine at class-list
// scale (tens to low hundreds of students), consistent with how the rest of
// this app avoids pagination/indexing machinery it doesn't need yet.
async function findDuplicateStudent(
  firstName: string,
  lastName: string,
  group: string,
  excludeId?: string,
): Promise<boolean> {
  const key = normalizeKey(firstName, lastName, group);
  const students = await prisma.student.findMany(excludeId ? { where: { id: { not: excludeId } } } : undefined);
  return students.some((s) => normalizeKey(s.firstName, s.lastName, s.group) === key);
}

const DUPLICATE_ERROR = "En elev med det namnet finns redan i den klassen";

studentsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const students = await prisma.student.findMany({ orderBy: { lastName: "asc" } });
    res.json(students);
  }),
);

studentsRouter.get(
  "/pdf/all",
  asyncHandler(async (_req, res) => {
    const students = await prisma.student.findMany({ orderBy: { lastName: "asc" } });
    if (students.length === 0) {
      res.status(400).json({ error: "Inga elever att skriva ut" });
      return;
    }
    const assignments = await prisma.assignment.findMany({ orderBy: { createdAt: "asc" } });
    const courseSettings = await getCourseSettingsMap();
    const dataByStudentId = await getStudentDataBundles(students.map((s) => s.id));
    const stream = await renderToStream(
      <AllStudentsPdfDocument
        students={students}
        assignments={assignments}
        courseSettings={courseSettings}
        dataByStudentId={dataByStudentId}
      />,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="alla-elever.pdf"`);
    stream.pipe(res);
  }),
);

studentsRouter.get(
  "/pdf/selected",
  asyncHandler(async (req, res) => {
    const idsParam = req.query.ids;
    const ids = typeof idsParam === "string" ? idsParam.split(",").filter(Boolean) : [];
    if (ids.length === 0) {
      res.status(400).json({ error: "Inga elever valda" });
      return;
    }
    if (ids.length > 200) {
      res.status(400).json({ error: "För många elever valda" });
      return;
    }
    const students = await prisma.student.findMany({ where: { id: { in: ids } } });
    if (students.length === 0) {
      res.status(400).json({ error: "Inga elever valda" });
      return;
    }
    const byId = new Map(students.map((s) => [s.id, s]));
    const orderedStudents = ids.map((id) => byId.get(id)).filter((s): s is (typeof students)[number] => Boolean(s));

    const assignments = await prisma.assignment.findMany({ orderBy: { createdAt: "asc" } });
    const courseSettings = await getCourseSettingsMap();
    const dataByStudentId = await getStudentDataBundles(orderedStudents.map((s) => s.id));
    const stream = await renderToStream(
      <AllStudentsPdfDocument
        students={orderedStudents}
        assignments={assignments}
        courseSettings={courseSettings}
        dataByStudentId={dataByStudentId}
      />,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="valda-elever.pdf"`);
    stream.pipe(res);
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
    const assignments = await prisma.assignment.findMany({ orderBy: { createdAt: "asc" } });
    const courseSettings = await getCourseSettingsMap();
    const data = await getStudentDataBundle(student.id);
    const stream = await renderToStream(
      <StudentPdfDocument student={student} assignments={assignments} courseSettings={courseSettings} data={data} />,
    );
    const safeName = `${student.firstName}-${student.lastName}`.replace(/[^\w-]+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}.pdf"`);
    stream.pipe(res);
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
    const validated = validateStudentDataBundleInput(req.body);
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

    const existing = await prisma.student.findMany();
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
