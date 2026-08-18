import { Router } from "express";
import { prisma } from "../db.js";
import { COURSES } from "../courses.js";

export const assignmentsRouter = Router();

assignmentsRouter.get("/", async (_req, res) => {
  const assignments = await prisma.assignment.findMany({ orderBy: { createdAt: "asc" } });
  res.json(assignments);
});

assignmentsRouter.post("/", async (req, res) => {
  const { course, name } = req.body;
  if (typeof course !== "string" || !(COURSES as readonly string[]).includes(course)) {
    res.status(400).json({ error: "Ogiltig kurs" });
    return;
  }
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Uppgiftens namn krävs" });
    return;
  }
  const assignment = await prisma.assignment.create({ data: { course, name: name.trim() } });
  res.status(201).json(assignment);
});

assignmentsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.assignment.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Uppgiften hittades inte" });
  }
});
