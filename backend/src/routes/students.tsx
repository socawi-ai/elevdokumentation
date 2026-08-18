import { Router } from "express";
import { renderToStream } from "@react-pdf/renderer";
import { prisma } from "../db.js";
import { StudentPdfDocument, AllStudentsPdfDocument } from "../pdf/StudentPdfDocument.js";

export const studentsRouter = Router();

async function getCourseSettingsMap(): Promise<Record<string, boolean>> {
  const rows = await prisma.courseSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.course, r.showNationalTest]));
}

studentsRouter.get("/", async (_req, res) => {
  const students = await prisma.student.findMany({ orderBy: { lastName: "asc" } });
  res.json(students);
});

studentsRouter.get("/pdf/all", async (_req, res) => {
  const students = await prisma.student.findMany({ orderBy: { lastName: "asc" } });
  if (students.length === 0) {
    res.status(400).json({ error: "Inga elever att skriva ut" });
    return;
  }
  const assignments = await prisma.assignment.findMany({ orderBy: { createdAt: "asc" } });
  const courseSettings = await getCourseSettingsMap();
  const stream = await renderToStream(
    <AllStudentsPdfDocument students={students} assignments={assignments} courseSettings={courseSettings} />,
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="alla-elever.pdf"`);
  stream.pipe(res);
});

studentsRouter.get("/:id", async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) {
    res.status(404).json({ error: "Eleven hittades inte" });
    return;
  }
  res.json(student);
});

studentsRouter.get("/:id/pdf", async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) {
    res.status(404).json({ error: "Eleven hittades inte" });
    return;
  }
  const assignments = await prisma.assignment.findMany({ orderBy: { createdAt: "asc" } });
  const courseSettings = await getCourseSettingsMap();
  const stream = await renderToStream(
    <StudentPdfDocument student={student} assignments={assignments} courseSettings={courseSettings} />,
  );
  const safeName = `${student.firstName}-${student.lastName}`.replace(/[^\w-]+/g, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${safeName}.pdf"`);
  stream.pipe(res);
});

studentsRouter.post("/", async (req, res) => {
  const { firstName, lastName, group } = req.body;
  if (!firstName || !lastName || !group) {
    res.status(400).json({ error: "Förnamn, efternamn och klass krävs" });
    return;
  }
  const student = await prisma.student.create({
    data: { firstName, lastName, group },
  });
  res.status(201).json(student);
});

studentsRouter.post("/import", async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    res.status(400).json({ error: "Ingen data att importera" });
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
  const result = await prisma.student.createMany({ data: valid });
  res.status(201).json({ count: result.count });
});

studentsRouter.put("/:id", async (req, res) => {
  const { firstName, lastName, group } = req.body;
  if (!firstName || !lastName || !group) {
    res.status(400).json({ error: "Förnamn, efternamn och klass krävs" });
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
});

studentsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Eleven hittades inte" });
  }
});
