import { Router, Request, Response } from "express";
import { pool } from "../db";
import { enrichUrls } from "../services/virustotalService";
import { analyzeWithAI, AiAnalysisError } from "../services/openrouterService";
import { buildRuleSignals, computeRiskScore } from "../utils/riskScoring";
import { ExtractedAttachment, ExtractedUrl } from "../types";
import { enrichUrlsWithUrlscan } from "../services/urlscanService";

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
 * POST /api/analyses/:id/ai-analyze
 * ?enrich=true (default) — also runs urlscan.io enrichment before the AI call
 *
 * Loads the stored analysis, optionally enriches its URLs, sends the
 * structured data to OpenRouter (with automatic model rotation), computes
 * the hybrid risk score, and persists everything back onto the row.
 */
router.post("/analyses/:id/ai-analyze", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const enrichEnabled = String(req.query.enrich ?? "true") !== "false";

  try {
    const [rows] = await pool.query(`SELECT * FROM analyses WHERE id = ?`, [id]);
    const row = (rows as any[])[0];
    if (!row) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    const extractedUrls = parseJsonColumn<ExtractedUrl[]>(row.extracted_urls, []);
    const extractedAttachments = parseJsonColumn<ExtractedAttachment[]>(row.extracted_attachments, []);

    // --- Step 1: IOC enrichment (optional, VirusTotal & urlscan) ---
    const [urlReputation, urlscanReputation] = enrichEnabled && extractedUrls.length > 0
      ? await Promise.all([
          enrichUrls(extractedUrls),
          enrichUrlsWithUrlscan(extractedUrls)
        ])
      : [[], []];

    // --- Step 2: AI analysis via OpenRouter (with model rotation) ---
    const { result: ai, modelUsed } = await analyzeWithAI({
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
      urlReputation,
      urlscanReputation,
    });

    // --- Step 3: Hybrid risk score (rule-based signals + AI confidence) ---
    const signals = buildRuleSignals(
      {
        spfResult: row.spf_result,
        dkimResult: row.dkim_result,
        dmarcResult: row.dmarc_result,
        replyToMismatch: !!row.reply_to_mismatch,
        displayNameDomainMismatch: !!row.display_name_domain_mismatch,
        urls: extractedUrls,
        attachments: extractedAttachments,
      },
      urlReputation,
      urlscanReputation
    );
    const scoreBreakdown = computeRiskScore(signals, ai);

    // --- Step 4: persist ---
    await pool.execute(
      `UPDATE analyses SET
        ai_threat_level = ?,
        ai_kill_chain_stage = ?,
        ai_mitre_technique = ?,
        ai_confidence = ?,
        ai_red_flags = ?,
        ai_explanation = ?,
        ai_model_used = ?,
        url_reputation = ?,
        urlscan_reputation = ?,
        risk_score = ?,
        risk_score_breakdown = ?
      WHERE id = ?`,
      [
        ai.threat_level,
        ai.kill_chain_stage,
        ai.mitre_technique,
        ai.confidence,
        JSON.stringify(ai.red_flags),
        ai.explanation,
        modelUsed,
        JSON.stringify(urlReputation),
        JSON.stringify(urlscanReputation),
        scoreBreakdown.finalScore,
        JSON.stringify(scoreBreakdown),
        id,
      ]
    );

    return res.json({
      id,
      ai: { ...ai, modelUsed },
      urlReputation,
      urlscanReputation,
      riskScore: scoreBreakdown,
    });
  } catch (err: any) {
    if (err instanceof AiAnalysisError) {
      console.error("[POST /api/analyses/:id/ai-analyze] AI error:", err.message, err.attemptedModels);
      return res.status(502).json({
        error: "AI analysis failed",
        detail: err.message,
        attemptedModels: err.attemptedModels,
      });
    }
    console.error("[POST /api/analyses/:id/ai-analyze] error:", err);
    return res.status(500).json({ error: "Failed to run AI analysis", detail: err.message });
  }
});

export default router;
