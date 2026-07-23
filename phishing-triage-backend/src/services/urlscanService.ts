import { ExtractedUrl } from "../types";
import { UrlscanReputation } from "../types";

const URLSCAN_SEARCH_ENDPOINT = "https://urlscan.io/api/v1/search/";
const DELAY_BETWEEN_REQUESTS_MS = 250; 
const MAX_DOMAINS_PER_EMAIL = 10; 

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Looks up whether urlscan.io has a public scan for this domain, 
 * via the search endpoint.
 */
async function searchExistingScan(domain: string): Promise<UrlscanReputation> {
  try {
    const q = encodeURIComponent(`domain:"${domain}"`);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    
    if (process.env.URLSCAN_API_KEY) {
      headers["API-Key"] = process.env.URLSCAN_API_KEY;
    }

    const res = await fetch(`${URLSCAN_SEARCH_ENDPOINT}?q=${q}&size=1`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { status: 'unknown' };
      }
      return { status: 'unknown', error: `urlscan search HTTP ${res.status}` };
    }

    const json: any = await res.json();
    const hit = json?.results?.[0];
    
    if (!hit) {
      return { status: 'unknown' }; 
    }

    const verdictMalicious = hit?.page?.verdicts?.overall?.malicious ?? hit?.verdicts?.overall?.malicious ?? null;
    
    let status: 'clean' | 'unknown' | 'malicious' = 'unknown';
    if (verdictMalicious === true) {
      status = 'malicious';
    } else if (verdictMalicious === false) {
      status = 'clean';
    }

    return {
      status
    };
  } catch (err: any) {
    console.error(`[enrichUrlsWithUrlscan] error for ${domain}:`, err.message);
    return { status: 'unknown', error: err.message };
  }
}

/**
 * Enriches a list of extracted URLs with urlscan.io reputation data.
 * De-duplicates by domain (one lookup per domain, not per URL) and caps
 * the number of domains checked per email.
 */
export async function enrichUrlsWithUrlscan(urls: ExtractedUrl[]): Promise<UrlscanReputation[]> {
  const uniqueDomains = Array.from(new Set(urls.map((u) => u.domain))).slice(0, MAX_DOMAINS_PER_EMAIL);
  const results: UrlscanReputation[] = [];

  for (const domain of uniqueDomains) {
    if (results.length > 0) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
    const reputation = await searchExistingScan(domain);
    results.push({ ...reputation, domain }); // Attach domain for matching later if needed
  }

  // Map the domain results back to the individual URLs
  return urls.map(u => {
    const domainResult = results.find(r => r.domain === u.domain);
    return {
      url: u.url,
      domain: u.domain,
      status: domainResult?.status || 'unknown',
      error: domainResult?.error
    };
  });
}

