import { Router, Request, Response } from "express";
import { pool } from "../db";
import { chatWithAI, AiAnalysisError } from "../services/openrouterService";
import { ExtractedAttachment, ExtractedUrl } from "../types";

const router = Router();

function parseJsonColumn<T>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * POST /api/analyses/:id/chat
 * Request body: { message: string, history: any[], apiKey?: string }
 */
router.post("/analyses/:id/chat", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const { message, history, apiKey } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const [rows] = await pool.query(`SELECT * FROM analyses WHERE id = ?`, [id]);
    const row = (rows as any[])[0];
    if (!row) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    const extractedUrls = parseJsonColumn<ExtractedUrl[]>(row.extracted_urls, []);
    const extractedAttachments = parseJsonColumn<ExtractedAttachment[]>(row.extracted_attachments, []);

    const emailData = {
      senderEmail: row.sender_email,
      senderDisplayName: row.sender_display_name,
      senderDomain: row.sender_domain,
      replyToEmail: row.reply_to_email,
      replyToMismatch: !!row.reply_to_mismatch,
      displayNameDomainMismatch: !!row.display_name_domain_mismatch,
      spfResult: row.spf_result,
      dkimResult: row.dkim_result,
      dmarcResult: row.dmarc_result,
      subject: row.subject,
      extractedUrls,
      extractedAttachments,
      urlReputation: parseJsonColumn(row.url_reputation, []),
    };

    const { reply, modelUsed } = await chatWithAI(emailData, history || [], message, apiKey);

    return res.json({ reply, modelUsed });
  } catch (err: any) {
    if (err instanceof AiAnalysisError) {
      console.error("[POST /api/analyses/:id/chat] AI error:", err.message);
      const isAuthErr = err.message.includes("401");
      return res.status(isAuthErr ? 401 : 502).json({
        error: "AI chat failed",
        detail: err.message,
      });
    }
    console.error("[POST /api/analyses/:id/chat] error:", err);
    return res.status(500).json({ error: "Failed to run AI chat", detail: err.message });
  }
});

export default router;
