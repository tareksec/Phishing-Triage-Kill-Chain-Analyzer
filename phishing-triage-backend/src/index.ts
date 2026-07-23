import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { testConnection } from "./db";
import analyzeRouter from "./routes/analyze";
import analysesRouter from "./routes/analyses";
import aiAnalyzeRouter from "./routes/aiAnalyze";
import aiChatRouter from "./routes/aiChat";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "phishing-triage-backend", phase: 3 });
});

app.use("/api", analyzeRouter);
app.use("/api", analysesRouter);
app.use("/api", aiAnalyzeRouter);
app.use("/api", aiChatRouter);

// --- Production: serve the frontend build from public/ ---
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Central error handler (e.g. multer file-type rejections)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled error]", err);
  res.status(400).json({ error: err.message || "Unexpected error" });
});

// SPA fallback: any non-API route serves index.html so React Router works
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, async () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  try {
    await testConnection();
  } catch (err) {
    console.error("[db] connection failed — check .env DB credentials and that MySQL is running:", err);
  }
});
