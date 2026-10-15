import { Router } from "express";
import { prisma } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";

export const assignmentsRouter = Router();

export const ASSIGNMENT_ORDER = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];

assignmentsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const assignments = await prisma.assignment.findMany({
      orderBy: ASSIGNMENT_ORDER,
      include: { _count: { select: { grades: true } } },
    });
    res.json(assignments.map(({ _count, ...a }) => ({ ...a, gradeCount: _count.grades })));
  }),
);

assignmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { course, name } = req.body;
    if (typeof course !== "string" || !(await prisma.course.findUnique({ where: { name: course } }))) {
      res.status(400).json({ error: "Ogiltig kurs" });
      return;
    }
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Uppgiftens namn krävs" });
      return;
    }
    const last = await prisma.assignment.findFirst({ where: { course }, orderBy: { sortOrder: "desc" } });
    const assignment = await prisma.assignment.create({
      data: { course, name: name.trim(), sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    res.status(201).json({ ...assignment, gradeCount: 0 });
  }),
);

// Must be registered before "/:id".
assignmentsRouter.put(
  "/reorder",
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      res.status(400).json({ error: "Ogiltig ordning" });
      return;
    }
    await prisma.$transaction(
      (ids as string[]).map((id, i) => prisma.assignment.updateMany({ where: { id }, data: { sortOrder: i } })),
    );
    res.status(204).end();
  }),
);

assignmentsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Uppgiftens namn krävs" });
      return;
    }
    try {
      const assignment = await prisma.assignment.update({ where: { id: req.params.id }, data: { name: name.trim() } });
      res.json(assignment);
    } catch {
      res.status(404).json({ error: "Uppgiften hittades inte" });
    }
  }),
);

assignmentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    try {
      await prisma.assignment.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch {
      res.status(404).json({ error: "Uppgiften hittades inte" });
    }
  }),
);
