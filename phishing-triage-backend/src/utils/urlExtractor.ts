import { ExtractedUrl } from "../types";

const URL_REGEX = /\bhttps?:\/\/[^\s"'<>()\]]+/gi;
// Matches <a ... href="...">anchor text</a>, tolerant of attribute order/case.
const ANCHOR_REGEX = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** Extracts raw http(s) URLs from plain-text email body. */
export function extractUrlsFromText(text: string | null): ExtractedUrl[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  return matches.map((url) => ({
    url,
    domain: safeDomain(url),
    textHrefMismatch: false,
    source: "body" as const,
  }));
}

/**
 * Extracts URLs from HTML, including anchor-text-vs-href mismatches
 * (classic phishing tell: link text says "paypal.com" but href points
 * elsewhere).
 */
export function extractUrlsFromHtml(html: string | null): ExtractedUrl[] {
  if (!html) return [];
  const results: ExtractedUrl[] = [];
  let match: RegExpExecArray | null;

  ANCHOR_REGEX.lastIndex = 0;
  while ((match = ANCHOR_REGEX.exec(html)) !== null) {
    const href = match[1].trim();
    if (!/^https?:\/\//i.test(href)) continue;

    const displayText = stripTags(match[2]);
    const textLooksLikeUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(displayText);

    let textHrefMismatch = false;
    if (textLooksLikeUrl) {
      const hrefDomain = safeDomain(href);
      const textDomain = displayText
        .replace(/^https?:\/\//i, "")
        .split(/[/\s]/)[0]
        .toLowerCase();
      textHrefMismatch = textDomain !== "" && textDomain !== hrefDomain;
    }

    results.push({
      url: href,
      domain: safeDomain(href),
      displayText: displayText || undefined,
      textHrefMismatch,
      source: "html",
    });
  }

  // Also catch any bare URLs in the HTML that aren't inside <a> tags
  // (e.g. plain-text-looking links some phishing kits use).
  const bare = html.match(URL_REGEX) || [];
  for (const url of bare) {
    if (!results.some((r) => r.url === url)) {
      results.push({
        url,
        domain: safeDomain(url),
        textHrefMismatch: false,
        source: "html",
      });
    }
  }

  return results;
}

/** Merges + de-duplicates URL lists from text and HTML sources. */
export function mergeUrls(...lists: ExtractedUrl[][]): ExtractedUrl[] {
  const seen = new Map<string, ExtractedUrl>();
  for (const list of lists) {
    for (const item of list) {
      const existing = seen.get(item.url);
      // Prefer the entry that carries mismatch info / display text.
      if (!existing || (item.textHrefMismatch && !existing.textHrefMismatch)) {
        seen.set(item.url, item);
      }
    }
  }
  return Array.from(seen.values());
}
