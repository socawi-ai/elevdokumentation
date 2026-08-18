import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler } from "express";
import { studentsRouter } from "./routes/students.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { courseSettingsRouter } from "./routes/courseSettings.js";

export const app = express();

// No CORS middleware: the frontend always talks to this API same-origin —
// in dev, Vite's dev server proxies /api to this backend server-side (the
// browser only ever sees http://localhost:5173); in production, this same
// server serves the built frontend below, so /api is same-origin there too.
// A real cross-origin caller was never a supported use case.
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/students", studentsRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/course-settings", courseSettingsRouter);

// Anything under /api that didn't match a route above is a 404, not a
// frontend page — must come before the static/SPA-fallback handling below.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Serve the built frontend (frontend/dist) when it exists — i.e. in a real
// deployment, after `npm run build`. In dev, nobody runs that build, so this
// is skipped entirely and Vite's own dev server serves the frontend instead.
const frontendDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// Must be registered last. Catches errors forwarded via asyncHandler from
// every route above, so a bad request or an unexpected Prisma error returns
// a generic 500 instead of crashing the process (Express 4 does not catch
// rejected promises from async handlers on its own).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internt serverfel" });
};
app.use(errorHandler);
