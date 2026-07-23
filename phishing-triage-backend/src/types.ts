export type AuthResult = "pass" | "fail" | "softfail" | "neutral" | "none" | "unknown";

export interface ExtractedUrl {
  url: string;
  domain: string;
  displayText?: string; // anchor text, if link text != href (mismatch indicator)
  textHrefMismatch: boolean;
  source: "body" | "html";
}

export interface ExtractedAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}

export interface ReceivedHop {
  index: number;
  raw: string;
  from?: string;
  by?: string;
  date?: string;
}

export interface ParsedEmail {
  filename: string;

  senderEmail: string | null;
  senderDisplayName: string | null;
  senderDomain: string | null;

  replyToEmail: string | null;
  replyToMismatch: boolean;

  displayNameDomainMismatch: boolean;

  spfResult: AuthResult;
  dkimResult: AuthResult;
  dmarcResult: AuthResult;

  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;

  extractedUrls: ExtractedUrl[];
  extractedAttachments: ExtractedAttachment[];
  receivedChain: ReceivedHop[];

  rawHeaders: string;
}

export interface AnalysisRecord {
  id: number;
  filename: string;
  sender_email: string | null;
  sender_display_name: string | null;
  sender_domain: string | null;
  reply_to_email: string | null;
  reply_to_mismatch: boolean;
  display_name_domain_mismatch: boolean;
  spf_result: AuthResult | null;
  dkim_result: AuthResult | null;
  dmarc_result: AuthResult | null;
  subject: string | null;
  extracted_urls: ExtractedUrl[];
  extracted_attachments: ExtractedAttachment[];
  received_chain: ReceivedHop[];
  ai_threat_level: string | null;
  ai_kill_chain_stage: string | null;
  ai_mitre_technique: string | null;
  ai_confidence: number | null;
  ai_red_flags: string[] | null;
  ai_explanation: string | null;
  url_reputation: UrlReputation[] | null;
  urlscan_reputation: UrlscanReputation[] | null;
  risk_score: number | null;
  raw_headers: string;
  created_at: string;
}

// --- Phase 2: AI + enrichment types ---

export type ThreatLevel = "critical" | "high" | "medium" | "low" | "benign";

export type KillChainStage =
  | "reconnaissance"
  | "weaponization"
  | "delivery"
  | "exploitation"
  | "installation"
  | "c2"
  | "actions_on_objectives";

/** Structured output we require from the AI model, per the system prompt. */
export interface AiAnalysisResult {
  threat_level: ThreatLevel;
  kill_chain_stage: KillChainStage;
  mitre_technique: string; // e.g. "T1566.002"
  confidence: number; // 0.0 - 1.0
  red_flags: string[];
  explanation: string;
}

/** Reputation info pulled from urlscan.io for a single extracted URL. */
export interface UrlReputation {
  url: string;
  domain: string;
  status: 'clean' | 'unknown' | 'malicious';
  score: number | null; // urlscan verdicts score, if available
  scanId: string | null;
  resultUrl: string | null;
  error?: string;
  malicious?: boolean | null; // deprecated fallback
}

export interface UrlscanReputation {
  url?: string;
  domain?: string;
  status: 'clean' | 'unknown' | 'malicious';
  error?: string;
}

/** Rule-based signals fed into the hybrid risk scorer, alongside the AI result. */
export interface RuleSignals {
  spfFail: boolean;
  spfSoftfail: boolean;
  dkimFail: boolean;
  dkimNone: boolean;
  dmarcFail: boolean;
  replyToMismatch: boolean;
  displayNameDomainMismatch: boolean;
  anyUrlTextHrefMismatch: boolean;
  riskyAttachmentCount: number;
  manyUrls: boolean; // more than 3 distinct URLs
  anyMaliciousUrlReputation: boolean;
  anyMaliciousUrlscanReputation?: boolean;
}

export interface RiskScoreBreakdown {
  ruleScore: number; // 0-70
  aiScore: number; // 0-100, derived from threat_level
  aiConfidence: number; // 0-1
  finalScore: number; // 0-99.99, stored in DB
}

