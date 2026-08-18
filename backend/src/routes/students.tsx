import { Router } from "express";
import { renderToStream } from "@react-pdf/renderer";
import { prisma } from "../db.js";
import { StudentPdfDocument } from "../pdf/StudentPdfDocument.js";

export const studentsRouter = Router();

studentsRouter.get("/", async (_req, res) => {
  const students = await prisma.student.findMany({ orderBy: { lastName: "asc" } });
  res.json(students);
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
  const stream = await renderToStream(<StudentPdfDocument student={student} />);
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
