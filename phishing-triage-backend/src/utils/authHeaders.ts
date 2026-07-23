import { AuthResult } from "../types";

/**
 * Normalizes a raw spf/dkim/dmarc token (e.g. "pass", "Fail", "SOFTFAIL")
 * into our AuthResult union.
 */
function normalizeResult(raw: string | undefined): AuthResult {
  if (!raw) return "unknown";
  const v = raw.trim().toLowerCase();
  if (["pass", "fail", "softfail", "neutral", "none"].includes(v)) {
    return v as AuthResult;
  }
  return "unknown";
}

/**
 * Parses the "Authentication-Results" header, which most receiving mail
 * servers add and typically looks like:
 *
 *   Authentication-Results: mx.google.com;
 *     spf=pass (google.com: domain of x@y.com designates 1.2.3.4 as permitted sender) smtp.mailfrom=x@y.com;
 *     dkim=pass header.i=@y.com;
 *     dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=y.com
 *
 * Falls back to a dedicated "Received-SPF" header for SPF if present.
 */
export function parseAuthenticationResults(headers: {
  authResults?: string[];
  receivedSpf?: string;
}): { spf: AuthResult; dkim: AuthResult; dmarc: AuthResult } {
  let spf: AuthResult = "none";
  let dkim: AuthResult = "none";
  let dmarc: AuthResult = "none";

  const combined = (headers.authResults || []).join(" ; ");

  const spfMatch = combined.match(/\bspf=([a-zA-Z]+)/i);
  const dkimMatch = combined.match(/\bdkim=([a-zA-Z]+)/i);
  const dmarcMatch = combined.match(/\bdmarc=([a-zA-Z]+)/i);

  if (spfMatch) spf = normalizeResult(spfMatch[1]);
  if (dkimMatch) dkim = normalizeResult(dkimMatch[1]);
  if (dmarcMatch) dmarc = normalizeResult(dmarcMatch[1]);

  // Fallback: dedicated Received-SPF header, e.g. "pass (domain ... )"
  if (spf === "none" && headers.receivedSpf) {
    const m = headers.receivedSpf.match(/^\s*([a-zA-Z]+)/);
    if (m) spf = normalizeResult(m[1]);
  }

  return { spf, dkim, dmarc };
}

/** Extracts the domain portion of an email address, lowercased. */
export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).trim().toLowerCase().replace(/[>\s]+$/, "");
}

/**
 * Very lightweight display-name spoofing heuristic for Phase 1:
 * flags cases where the display name contains a well-known brand/domain
 * token that does NOT match the actual sending domain
 * (e.g. From: "PayPal Support" <billing@paypa1-secure.ru>).
 * This is intentionally simple — real typosquat/Levenshtein scoring
 * and a brand list can be added in a later phase.
 */
export function displayNameDomainMismatch(
  displayName: string | null,
  senderDomain: string | null
): boolean {
  if (!displayName || !senderDomain) return false;

  const nameTokens = displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4); // ignore short/noisy tokens

  if (nameTokens.length === 0) return false;

  const domainRoot = senderDomain.split(".").slice(-2, -1)[0] || senderDomain;

  // If none of the meaningful name tokens appear anywhere in the sending
  // domain, and the display name looks like it's impersonating an org
  // (contains a token that itself looks like a brand, e.g. ends in common
  // corp suffixes or is a recognizable word), flag a soft mismatch.
  const anyTokenInDomain = nameTokens.some((t) => senderDomain.includes(t));
  if (anyTokenInDomain) return false;

  // If the display name literally contains a domain-like string
  // (e.g. "Microsoft Security <...>" vs domain "secure-alerts.info"),
  // treat lack of overlap with domainRoot as a mismatch signal.
  return true;
}
