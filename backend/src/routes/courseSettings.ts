import { Router } from "express";
import { prisma } from "../db.js";
import { NATIONAL_TEST_COURSES } from "../courses.js";
import { asyncHandler } from "../asyncHandler.js";

export const courseSettingsRouter = Router();

courseSettingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.courseSetting.findMany();
    const byCourse = new Map(rows.map((r) => [r.course, r.showNationalTest]));
    const settings = NATIONAL_TEST_COURSES.map((course) => ({
      course,
      showNationalTest: byCourse.get(course) ?? false,
    }));
    res.json(settings);
  }),
);

courseSettingsRouter.put(
  "/:course",
  asyncHandler(async (req, res) => {
    const course = req.params.course;
    const { showNationalTest } = req.body;
    if (!(NATIONAL_TEST_COURSES as readonly string[]).includes(course)) {
      res.status(400).json({ error: "Ogiltig kurs" });
      return;
    }
    if (typeof showNationalTest !== "boolean") {
      res.status(400).json({ error: "showNationalTest måste vara true eller false" });
      return;
    }
    const setting = await prisma.courseSetting.upsert({
      where: { course },
      update: { showNationalTest },
      create: { course, showNationalTest },
    });
    res.json(setting);
  }),
);
