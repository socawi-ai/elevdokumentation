import express from "express";
import cors from "cors";
import { studentsRouter } from "./routes/students.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { courseSettingsRouter } from "./routes/courseSettings.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/students", studentsRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/course-settings", courseSettingsRouter);
