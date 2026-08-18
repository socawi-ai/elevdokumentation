import { Router } from "express";
import { prisma } from "../db.js";

export const studentsRouter = Router();

studentsRouter.get("/", async (_req, res) => {
  const students = await prisma.student.findMany({ orderBy: { lastName: "asc" } });
  res.json(students);
});

studentsRouter.get("/:id", async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(student);
});

studentsRouter.post("/", async (req, res) => {
  const { firstName, lastName, birthDate, notes } = req.body;
  if (!firstName || !lastName) {
    res.status(400).json({ error: "firstName and lastName are required" });
    return;
  }
  const student = await prisma.student.create({
    data: {
      firstName,
      lastName,
      birthDate: birthDate ? new Date(birthDate) : null,
      notes: notes ?? null,
    },
  });
  res.status(201).json(student);
});

studentsRouter.put("/:id", async (req, res) => {
  const { firstName, lastName, birthDate, notes } = req.body;
  if (!firstName || !lastName) {
    res.status(400).json({ error: "firstName and lastName are required" });
    return;
  }
  try {
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        firstName,
        lastName,
        birthDate: birthDate ? new Date(birthDate) : null,
        notes: notes ?? null,
      },
    });
    res.json(student);
  } catch {
    res.status(404).json({ error: "Student not found" });
  }
});

studentsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Student not found" });
  }
});
