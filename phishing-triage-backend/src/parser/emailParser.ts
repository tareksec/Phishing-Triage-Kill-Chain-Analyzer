import { simpleParser, ParsedMail, HeaderValue } from "mailparser";
import crypto from "crypto";
import {
  ParsedEmail,
  ReceivedHop,
  ExtractedAttachment,
} from "../types";
import { parseAuthenticationResults, domainFromEmail, displayNameDomainMismatch } from "../utils/authHeaders";
import { extractUrlsFromText, extractUrlsFromHtml, mergeUrls } from "../utils/urlExtractor";

/** Pulls every "Received:" hop out of the raw header block, in order. */
function parseReceivedChain(rawHeaders: string): ReceivedHop[] {
  const hops: ReceivedHop[] = [];
  // Raw headers are unfolded by mailparser's headerLines, but we also
  // parse the raw block directly to preserve original hop order top-to-bottom.
  const regex = /^Received:\s*([\s\S]*?)(?=^\S+:|\Z)/gim;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(rawHeaders)) !== null) {
    const raw = match[1].replace(/\r?\n\s+/g, " ").trim();
    const fromMatch = raw.match(/from\s+([^\s;]+)/i);
    const byMatch = raw.match(/by\s+([^\s;]+)/i);
    const dateMatch = raw.match(/;\s*(.+)$/);

    hops.push({
      index: index++,
      raw,
      from: fromMatch ? fromMatch[1] : undefined,
      by: byMatch ? byMatch[1] : undefined,
      date: dateMatch ? dateMatch[1].trim() : undefined,
    });
  }

  return hops;
}

/** Collects every "Authentication-Results" header (there can be several, from different hops). */
function collectAuthResultsHeaders(headers: Map<string, HeaderValue>): string[] {
  const raw = headers.get("authentication-results");
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((r) => String(r));
  return [String(raw)];
}

function getHeaderString(headers: Map<string, HeaderValue>, key: string): string | undefined {
  const v = headers.get(key);
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(String).join(" ; ");
  return String(v);
}

async function hashBuffer(buf: Buffer): Promise<string> {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Parses a raw .eml buffer into a normalized ParsedEmail object.
 * This is the single entry point used by the /api/analyze route.
 */
export async function parseEml(filename: string, buffer: Buffer): Promise<ParsedEmail> {
  const mail: ParsedMail = await simpleParser(buffer, {
    skipHtmlToText: false,
  });

  const rawHeaders = mail.headerLines
    .map((h) => `${h.key}: ${h.line.slice(h.key.length + 1).trim()}`)
    .join("\n");

  // --- Sender identity ---
  const fromAddr = mail.from?.value?.[0];
  const senderEmail = fromAddr?.address?.toLowerCase() ?? null;
  const senderDisplayName = fromAddr?.name ?? null;
  const senderDomain = domainFromEmail(senderEmail);

  const replyToAddr = mail.replyTo?.value?.[0];
  const replyToEmail = replyToAddr?.address?.toLowerCase() ?? null;
  const replyToMismatch = !!(replyToEmail && senderEmail && replyToEmail !== senderEmail);

  const nameDomainMismatch = displayNameDomainMismatch(senderDisplayName, senderDomain);

  // --- Auth results (SPF/DKIM/DMARC) — header-only, no external lookups ---
  const authResultsHeaders = collectAuthResultsHeaders(mail.headers);
  const receivedSpf = getHeaderString(mail.headers, "received-spf");
  const { spf, dkim, dmarc } = parseAuthenticationResults({
    authResults: authResultsHeaders,
    receivedSpf,
  });

  // --- Body + URLs ---
  const bodyText = mail.text ?? null;
  const bodyHtml = typeof mail.html === "string" ? mail.html : null;

  const urlsFromText = extractUrlsFromText(bodyText);
  const urlsFromHtml = extractUrlsFromHtml(bodyHtml);
  const extractedUrls = mergeUrls(urlsFromText, urlsFromHtml);

  // --- Attachments ---
  const extractedAttachments: ExtractedAttachment[] = [];
  for (const att of mail.attachments || []) {
    extractedAttachments.push({
      filename: att.filename || "unnamed",
      contentType: att.contentType || "application/octet-stream",
      sizeBytes: att.size ?? att.content?.length ?? 0,
      sha256: await hashBuffer(att.content as Buffer),
    });
  }

  // --- Received chain (hop analysis) ---
  const receivedChain = parseReceivedChain(rawHeaders);

  return {
    filename,
    senderEmail,
    senderDisplayName,
    senderDomain,
    replyToEmail,
    replyToMismatch,
    displayNameDomainMismatch: nameDomainMismatch,
    spfResult: spf,
    dkimResult: dkim,
    dmarcResult: dmarc,
    subject: mail.subject ?? null,
    bodyText,
    bodyHtml,
    extractedUrls,
    extractedAttachments,
    receivedChain,
    rawHeaders,
  };
}
