import express from "express";
import cors from "cors";
import { studentsRouter } from "./routes/students.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/students", studentsRouter);
