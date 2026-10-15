import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { listCourses, toCourseConfig } from "../courses.js";
import { asyncHandler } from "../asyncHandler.js";

export const coursesRouter = Router();

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function isNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

function parseDelprovInput(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const names: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") return null;
    const name = v.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

coursesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listCourses());
  }),
);

coursesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, page } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Kursens namn krävs" });
      return;
    }
    const last = await prisma.course.findFirst({ orderBy: { sortOrder: "desc" } });
    try {
      const course = await prisma.course.create({
        data: { name: name.trim(), page: page === 2 ? 2 : 1, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
      res.status(201).json(toCourseConfig(course));
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      res.status(409).json({ error: "En kurs med det namnet finns redan" });
    }
  }),
);

// Must be registered before "/:name" so "reorder" isn't taken as a course name.
coursesRouter.put(
  "/reorder",
  asyncHandler(async (req, res) => {
    const { names } = req.body;
    if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
      res.status(400).json({ error: "Ogiltig ordning" });
      return;
    }
    await prisma.$transaction(
      (names as string[]).map((name, i) => prisma.course.updateMany({ where: { name }, data: { sortOrder: i } })),
    );
    res.json(await listCourses());
  }),
);

coursesRouter.put(
  "/:name",
  asyncHandler(async (req, res) => {
    const { name, page, nationalTestDelprov, showNationalTest } = req.body;
    const data: Prisma.CourseUpdateInput = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "Kursens namn krävs" });
        return;
      }
      data.name = name.trim();
    }
    if (page !== undefined) {
      if (page !== 1 && page !== 2) {
        res.status(400).json({ error: "Sida måste vara 1 eller 2" });
        return;
      }
      data.page = page;
    }
    let delprov: string[] | null = null;
    if (nationalTestDelprov !== undefined) {
      delprov = parseDelprovInput(nationalTestDelprov);
      if (!delprov) {
        res.status(400).json({ error: "Ogiltiga delprov" });
        return;
      }
      data.nationalTestDelprov = JSON.stringify(delprov);
      if (delprov.length === 0) data.showNationalTest = false;
    }
    if (showNationalTest !== undefined) {
      if (typeof showNationalTest !== "boolean") {
        res.status(400).json({ error: "showNationalTest måste vara true eller false" });
        return;
      }
      if (delprov === null || delprov.length > 0) data.showNationalTest = showNationalTest;
    }

    try {
      // Renaming cascades to assignments, grades, notes and klass settings via
      // the foreign keys' ON UPDATE CASCADE.
      const course = await prisma.course.update({ where: { name: req.params.name }, data });
      if (delprov !== null) {
        // Grades for a delprov that no longer exists would never be shown or
        // editable again — drop them rather than leave them orphaned.
        await prisma.nationalTestGrade.deleteMany({ where: { course: course.name, delprov: { notIn: delprov } } });
      }
      res.json(toCourseConfig(course));
    } catch (err) {
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "En kurs med det namnet finns redan" });
        return;
      }
      if (isNotFound(err)) {
        res.status(404).json({ error: "Kursen hittades inte" });
        return;
      }
      throw err;
    }
  }),
);

coursesRouter.delete(
  "/:name",
  asyncHandler(async (req, res) => {
    try {
      await prisma.course.delete({ where: { name: req.params.name } });
      res.status(204).end();
    } catch (err) {
      if (!isNotFound(err)) throw err;
      res.status(404).json({ error: "Kursen hittades inte" });
    }
  }),
);
