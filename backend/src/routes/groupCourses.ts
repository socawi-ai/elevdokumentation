import { Router } from "express";
import { prisma } from "../db.js";
import { getGroupCourseMap } from "../courses.js";
import { asyncHandler } from "../asyncHandler.js";

export const groupCoursesRouter = Router();

// Every klass that has an active student, with its explicit course list, or
// null when the klass takes every course (the default).
groupCoursesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [students, map] = await Promise.all([
      prisma.student.findMany({ where: { archived: false }, select: { group: true } }),
      getGroupCourseMap(),
    ]);
    const groups = [...new Set(students.map((s) => s.group))].sort((a, b) => a.localeCompare(b, "sv"));
    res.json(groups.map((group) => ({ group, courses: map.has(group) ? [...map.get(group)!] : null })));
  }),
);

groupCoursesRouter.put(
  "/:group",
  asyncHandler(async (req, res) => {
    const group = req.params.group;
    const { courses } = req.body;
    if (courses !== null && (!Array.isArray(courses) || courses.some((c) => typeof c !== "string"))) {
      res.status(400).json({ error: "Ogiltig kurslista" });
      return;
    }
    const allCourses = await prisma.course.findMany({ select: { name: true } });
    const known = new Set(allCourses.map((c) => c.name));
    const selected = courses === null ? null : [...new Set(courses as string[])].filter((c) => known.has(c));
    if (selected !== null && selected.length === 0) {
      res.status(400).json({ error: "Klassen måste läsa minst en kurs" });
      return;
    }

    // Selecting every course is stored as "no rows" so courses added later
    // automatically apply to this klass too.
    const isAll = selected === null || selected.length === known.size;
    await prisma.$transaction([
      prisma.groupCourse.deleteMany({ where: { group } }),
      ...(isAll ? [] : selected!.map((course) => prisma.groupCourse.create({ data: { group, course } }))),
    ]);
    res.json({ group, courses: isAll ? null : selected });
  }),
);
