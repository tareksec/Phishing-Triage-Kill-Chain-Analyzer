-- Phishing Triage & Kill Chain Analyzer — Phase 1 schema
-- Import this directly into the selected database: techvrs_phishing_triage

CREATE TABLE IF NOT EXISTS analyses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,

  -- Sender identity
  sender_email VARCHAR(255),
  sender_display_name VARCHAR(255),
  sender_domain VARCHAR(255),
  reply_to_email VARCHAR(255),
  reply_to_mismatch BOOLEAN DEFAULT FALSE,
  display_name_domain_mismatch BOOLEAN DEFAULT FALSE,

  -- Authentication results (parsed from headers only, no external calls)
  spf_result VARCHAR(20),
  dkim_result VARCHAR(20),
  dmarc_result VARCHAR(20),

  -- Content
  subject VARCHAR(998),
  extracted_urls JSON,
  extracted_attachments JSON,
  received_chain JSON,

  -- AI analysis (populated in Phase 2 via POST /api/analyses/:id/ai-analyze)
  ai_threat_level VARCHAR(20) DEFAULT NULL,
  ai_kill_chain_stage VARCHAR(50) DEFAULT NULL,
  ai_mitre_technique VARCHAR(20) DEFAULT NULL,
  ai_confidence DECIMAL(3,2) DEFAULT NULL,
  ai_red_flags JSON DEFAULT NULL,
  ai_explanation TEXT DEFAULT NULL,
  ai_model_used VARCHAR(100) DEFAULT NULL,

  -- IOC enrichment (urlscan.io lookups, Phase 2)
  url_reputation JSON DEFAULT NULL,
  urlscan_reputation JSON DEFAULT NULL,

  risk_score DECIMAL(4,2) DEFAULT NULL,
  risk_score_breakdown JSON DEFAULT NULL,

  raw_headers TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_sender_domain (sender_domain),
  INDEX idx_created_at (created_at)
);