-- Phase 2 migration: run this ONLY if you already created the `analyses`
-- table from Phase 1's schema.sql. If you're setting up fresh, just run
-- the updated schema.sql instead — it already includes these columns.

USE phishing_triage;

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2) DEFAULT NULL AFTER ai_mitre_technique,
  ADD COLUMN IF NOT EXISTS ai_red_flags JSON DEFAULT NULL AFTER ai_confidence,
  ADD COLUMN IF NOT EXISTS ai_model_used VARCHAR(100) DEFAULT NULL AFTER ai_explanation,
  ADD COLUMN IF NOT EXISTS url_reputation JSON DEFAULT NULL AFTER ai_model_used,
  ADD COLUMN IF NOT EXISTS risk_score_breakdown JSON DEFAULT NULL AFTER risk_score;
