import {
  AiAnalysisResult,
  AnalysisRecord,
  ParsedEmail,
  RiskScoreBreakdown,
  RuleSignals,
  ThreatLevel,
  UrlReputation,
} from "../types";

const RISKY_ATTACHMENT_EXTENSIONS = [
  ".exe", ".scr", ".js", ".vbs", ".bat", ".cmd", ".ps1",
  ".jar", ".docm", ".xlsm", ".pptm", ".hta", ".msi", ".lnk",
];

/** Derives the rule-based signal set from a parsed/stored email record. */
export function buildRuleSignals(
  data: {
    spfResult: string | null;
    dkimResult: string | null;
    dmarcResult: string | null;
    replyToMismatch: boolean;
    displayNameDomainMismatch: boolean;
    urls: { textHrefMismatch: boolean }[];
    attachments: { filename: string }[];
  },
  urlReputations: UrlReputation[] = [],
  urlscanReputations: any[] = []
): RuleSignals {
  const riskyAttachmentCount = data.attachments.filter((a) =>
    RISKY_ATTACHMENT_EXTENSIONS.some((ext) => a.filename.toLowerCase().endsWith(ext))
  ).length;

  return {
    spfFail: data.spfResult === "fail",
    spfSoftfail: data.spfResult === "softfail",
    dkimFail: data.dkimResult === "fail",
    dkimNone: data.dkimResult === "none",
    dmarcFail: data.dmarcResult === "fail",
    replyToMismatch: data.replyToMismatch,
    displayNameDomainMismatch: data.displayNameDomainMismatch,
    anyUrlTextHrefMismatch: data.urls.some((u) => u.textHrefMismatch),
    riskyAttachmentCount,
    manyUrls: data.urls.length > 3,
    anyMaliciousUrlReputation: urlReputations.some((r) => r.status === 'malicious' || r.malicious === true),
    anyMaliciousUrlscanReputation: urlscanReputations.some((r) => r.status === 'malicious'),
  };
}

/**
 * Converts rule signals into a 0-70 point score. Capped at 70 so the AI
 * component (0-100, scaled by its own confidence) always has room to move
 * the needle — this keeps the final score a genuine blend rather than
 * letting either side dominate.
 */
export function computeRuleScore(signals: RuleSignals): number {
  let score = 0;
  if (signals.spfFail) score += 15;
  else if (signals.spfSoftfail) score += 8;

  if (signals.dkimFail) score += 10;
  else if (signals.dkimNone) score += 5;

  if (signals.dmarcFail) score += 15;
  if (signals.replyToMismatch) score += 10;
  if (signals.displayNameDomainMismatch) score += 15;
  if (signals.anyUrlTextHrefMismatch) score += 20;
  if (signals.manyUrls) score += 5;
  score += Math.min(signals.riskyAttachmentCount, 2) * 15;
  
  if (signals.anyMaliciousUrlReputation && signals.anyMaliciousUrlscanReputation) {
    score += 40; // Both independent sources flagged it
  } else if (signals.anyMaliciousUrlReputation || signals.anyMaliciousUrlscanReputation) {
    score += 25; // One source flagged it
  }

  return Math.min(score, 70);
}

const THREAT_LEVEL_SCORE: Record<ThreatLevel, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
  benign: 0,
};

/**
 * Hybrid final score: half rule-based (deterministic, auditable), half
 * AI-derived (scaled by the model's own stated confidence so an
 * unconfident "critical" verdict doesn't dominate a clean rule profile).
 *
 * final = ruleScore * 0.5 + (threatLevelScore * confidence) * 0.5
 *
 * Deliberately simple and explainable — the point of a portfolio project
 * is being able to justify every number, not maximize sophistication.
 */
export function computeRiskScore(
  signals: RuleSignals,
  ai: AiAnalysisResult
): RiskScoreBreakdown {
  const ruleScore = computeRuleScore(signals);
  const aiScore = THREAT_LEVEL_SCORE[ai.threat_level] ?? 50;
  const confidence = Math.min(Math.max(ai.confidence, 0), 1);

  const rawFinal = ruleScore * 0.5 + aiScore * confidence * 0.5;
  const finalScore = Math.min(Math.round(rawFinal * 100) / 100, 99.99);

  return { ruleScore, aiScore, aiConfidence: confidence, finalScore };
}
