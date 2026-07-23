import { Router, Request, Response } from "express";
import { pool } from "../db";
import { generateReportPdf } from "../services/reportGenerator";

const router = Router();

function parseJsonFields(row: any) {
  return {
    ...row,
    extracted_urls: safeJson(row.extracted_urls),
    extracted_attachments: safeJson(row.extracted_attachments),
    received_chain: safeJson(row.received_chain),
    ai_red_flags: safeJson(row.ai_red_flags),
    url_reputation: safeJson(row.url_reputation),
    urlscan_reputation: safeJson(row.urlscan_reputation),
    risk_score_breakdown: safeJson(row.risk_score_breakdown),
  };
}

function safeJson(value: any) {
  if (value == null) return null;
  if (typeof value !== "string") return value; // mysql2 may already auto-parse JSON columns
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * GET /api/analyses?page=1&pageSize=20
 * Paginated history list, most recent first. Excludes heavy raw_headers
 * from the list view to keep payloads small.
 */
router.get("/analyses", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
    const offset = (page - 1) * pageSize;

    // --- Build dynamic WHERE clause from query params ---
    const conditions: string[] = [];
    const params: any[] = [];

    const threatLevel = String(req.query.threat_level ?? "").trim();
    if (threatLevel) {
      conditions.push("ai_threat_level = ?");
      params.push(threatLevel);
    }

    const dateFrom = String(req.query.date_from ?? "").trim();
    if (dateFrom) {
      conditions.push("created_at >= ?");
      params.push(`${dateFrom} 00:00:00`);
    }

    const dateTo = String(req.query.date_to ?? "").trim();
    if (dateTo) {
      conditions.push("created_at <= ?");
      params.push(`${dateTo} 23:59:59`);
    }

    const search = String(req.query.search ?? "").trim();
    if (search) {
      conditions.push("(subject LIKE ? OR sender_email LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT id, filename, sender_email, sender_domain, subject,
              spf_result, dkim_result, dmarc_result,
              reply_to_mismatch, display_name_domain_mismatch,
              ai_threat_level, ai_kill_chain_stage, risk_score, created_at
       FROM analyses
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM analyses ${whereClause}`,
      params
    );
    const total = (countRows as any[])[0]?.total ?? 0;

    return res.json({
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/analyses] error:", err);
    return res.status(500).json({ error: "Failed to fetch analyses", detail: err.message });
  }
});

/**
 * GET /api/analyses/:id
 * Full detail record, including raw headers and parsed JSON fields.
 */
router.get("/analyses/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const [rows] = await pool.query(`SELECT * FROM analyses WHERE id = ?`, [id]);
    const row = (rows as any[])[0];

    if (!row) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    return res.json(parseJsonFields(row));
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch analysis", detail: err.message });
  }
});

/**
 * GET /api/analyses/:id/report.pdf
 * Generates a PDF report for the given analysis ID using md-to-pdf.
 */
router.get("/analyses/:id/report.pdf", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const [rows] = await pool.query(`SELECT * FROM analyses WHERE id = ?`, [id]);
    const row = (rows as any[])[0];

    if (!row) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    const data = parseJsonFields(row);
    const pdfBuffer = await generateReportPdf(data);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="phishing-report-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error("[GET /api/analyses/:id/report.pdf] error:", err);
    return res.status(500).json({ error: "Failed to generate PDF report", detail: err.message });
  }
});

export default router;
