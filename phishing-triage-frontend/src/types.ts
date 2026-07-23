/* ----------------------------------------------------------------
   Shared types — mirrors the backend AnalysisRecord / API responses
   ---------------------------------------------------------------- */

export type AuthResult = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'unknown';
export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'benign';
export type KillChainStage =
  | 'reconnaissance'
  | 'weaponization'
  | 'delivery'
  | 'exploitation'
  | 'installation'
  | 'c2'
  | 'actions_on_objectives';

export interface ExtractedUrl {
  url: string;
  domain: string;
  displayText?: string;
  textHrefMismatch: boolean;
  source: 'body' | 'html';
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

export interface UrlReputation {
  url: string;
  domain: string;
  status: 'clean' | 'unknown' | 'malicious';
  score: number | null;
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

export interface RiskScoreBreakdown {
  ruleScore: number;
  aiScore: number;
  aiConfidence: number;
  finalScore: number;
}

/** Full detail record from GET /api/analyses/:id */
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
  ai_threat_level: ThreatLevel | null;
  ai_kill_chain_stage: KillChainStage | null;
  ai_mitre_technique: string | null;
  ai_confidence: number | null;
  ai_red_flags: string[] | null;
  ai_explanation: string | null;
  ai_model_used?: string | null;
  url_reputation: UrlReputation[] | null;
  urlscan_reputation: UrlscanReputation[] | null;
  risk_score: number | null;
  risk_score_breakdown: RiskScoreBreakdown | null;
  raw_headers: string;
  created_at: string;
}

/** List item from GET /api/analyses (lightweight, no raw_headers) */
export interface AnalysisListItem {
  id: number;
  filename: string;
  sender_email: string | null;
  sender_domain: string | null;
  subject: string | null;
  spf_result: AuthResult | null;
  dkim_result: AuthResult | null;
  dmarc_result: AuthResult | null;
  reply_to_mismatch: boolean;
  display_name_domain_mismatch: boolean;
  ai_threat_level: ThreatLevel | null;
  ai_kill_chain_stage: KillChainStage | null;
  risk_score: number | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AiAnalyzeResponse {
  id: number;
  ai: {
    threat_level: ThreatLevel;
    kill_chain_stage: KillChainStage;
    mitre_technique: string;
    confidence: number;
    red_flags: string[];
    explanation: string;
    modelUsed: string;
  };
  urlReputation: UrlReputation[];
  urlscanReputation: UrlscanReputation[];
  riskScore: RiskScoreBreakdown;
}
