import { Router, Request, Response } from "express";
import multer from "multer";
import { parseEml } from "../parser/emailParser";
import { pool } from "../db";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okExt = file.originalname.toLowerCase().endsWith(".eml");
    const okMime =
      file.mimetype === "message/rfc822" ||
      file.mimetype === "application/octet-stream" ||
      file.mimetype === "text/plain";
    if (okExt && okMime) return cb(null, true);
    if (okExt) return cb(null, true); // some browsers send generic mimetypes for .eml
    cb(new Error("Only .eml files are accepted"));
  },
});

/**
 * POST /api/analyze
 * multipart/form-data, field name: "file"
 * Parses the uploaded .eml, persists the result, and returns the full record.
 */
router.post("/analyze", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Use field name 'file'." });
    }

    const parsed = await parseEml(req.file.originalname, req.file.buffer);

    const [result] = await pool.execute(
      `INSERT INTO analyses (
        filename, sender_email, sender_display_name, sender_domain,
        reply_to_email, reply_to_mismatch, display_name_domain_mismatch,
        spf_result, dkim_result, dmarc_result,
        subject, extracted_urls, extracted_attachments, received_chain,
        raw_headers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parsed.filename,
        parsed.senderEmail,
        parsed.senderDisplayName,
        parsed.senderDomain,
        parsed.replyToEmail,
        parsed.replyToMismatch,
        parsed.displayNameDomainMismatch,
        parsed.spfResult,
        parsed.dkimResult,
        parsed.dmarcResult,
        parsed.subject,
        JSON.stringify(parsed.extractedUrls),
        JSON.stringify(parsed.extractedAttachments),
        JSON.stringify(parsed.receivedChain),
        parsed.rawHeaders,
      ]
    );

    const insertId = (result as any).insertId;

    return res.status(201).json({
      id: insertId,
      ...parsed,
    });
  } catch (err: any) {
    console.error("[POST /api/analyze] error:", err);
    return res.status(500).json({ error: "Failed to analyze email", detail: err.message });
  }
});

export default router;
