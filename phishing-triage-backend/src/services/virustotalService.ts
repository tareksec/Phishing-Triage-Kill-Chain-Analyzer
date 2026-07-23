import { ExtractedUrl, UrlReputation } from "../types";

const VIRUSTOTAL_URL_ENDPOINT = "https://www.virustotal.com/api/v3/urls";

/**
 * Enriches a list of extracted URLs with VirusTotal reputation data.
 * Will passively lookup URLs by default. 
 * Due to rate limits on free VT keys (4 req/min usually), we map promises carefully.
 */
export async function enrichUrls(urls: ExtractedUrl[]): Promise<UrlReputation[]> {
  if (urls.length === 0) return [];

  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    console.log("[enrichUrls] skipped: VIRUSTOTAL_API_KEY not set");
    return [];
  }

  // Deduplicate URLs before lookup to save API quota
  const uniqueUrls = Array.from(new Set(urls.map((u) => u.url)));

  const results: UrlReputation[] = [];

  for (const url of uniqueUrls) {
    try {
      // VirusTotal v3 requires URLs to be base64url encoded without padding
      const id = Buffer.from(url).toString('base64url');
      const domain = new URL(url).hostname;

      const res = await fetch(`${VIRUSTOTAL_URL_ENDPOINT}/${id}`, {
        method: "GET",
        headers: {
          "x-apikey": apiKey,
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        if (res.status === 404) {
           results.push({
            url,
            domain,
            status: 'unknown',
            score: null,
            scanId: null,
            resultUrl: null,
            error: "No prior scan found on VirusTotal"
          });
          continue;
        }
        throw new Error(`VirusTotal HTTP ${res.status}`);
      }

      const json = await res.json();
      const stats = json?.data?.attributes?.last_analysis_stats;
      
      if (!stats) {
        results.push({
          url,
          domain,
          status: 'unknown',
          score: null,
          scanId: null,
          resultUrl: null,
          error: "No analysis stats available"
        });
        continue;
      }

      const maliciousCount = stats.malicious || 0;
      const suspiciousCount = stats.suspicious || 0;
      const harmlessCount = stats.harmless || 0;
      const undetectedCount = stats.undetected || 0;
      const timeoutCount = stats.timeout || 0;
      
      const totalVotes = maliciousCount + suspiciousCount + harmlessCount + undetectedCount + timeoutCount;

      let status: 'clean' | 'unknown' | 'malicious' = 'unknown';
      if (maliciousCount > 0 || suspiciousCount > 0) {
        status = 'malicious';
      } else if (totalVotes > 0) {
        status = 'clean';
      }

      results.push({
        url,
        domain,
        status,
        score: maliciousCount, // Number of engines flagging it as malicious
        scanId: json.data?.id || null,
        resultUrl: `https://www.virustotal.com/gui/url/${id}`,
      });

    } catch (err: any) {
      console.error(`[enrichUrls] VT error for ${url}:`, err.message);
      results.push({
        url,
        domain: url,
        status: 'unknown',
        score: null,
        scanId: null,
        resultUrl: null,
        error: err.message,
      });
    }
  }

  return results;
}
