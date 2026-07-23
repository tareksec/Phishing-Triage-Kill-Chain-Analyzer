/* ----------------------------------------------------------------
   API Client — thin fetch wrapper for the phishing-triage backend
   Base URL defaults to '' (same origin) in production, or uses the
   Vite dev proxy (/api → localhost:4000/api).
   ---------------------------------------------------------------- */

import type {
  AnalysisRecord,
  AnalysisListItem,
  PaginatedResponse,
  AiAnalyzeResponse,
} from '../types';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** POST /api/analyze — upload a .eml file */
export async function uploadEmail(file: File): Promise<AnalysisRecord> {
  const form = new FormData();
  form.append('file', file);
  return request<AnalysisRecord>('/api/analyze', { method: 'POST', body: form });
}

/** POST /api/analyze — upload raw email text as a .eml blob */
export async function uploadRawEmail(
  rawText: string,
  filename = 'pasted-email.eml'
): Promise<AnalysisRecord> {
  const blob = new Blob([rawText], { type: 'message/rfc822' });
  const file = new File([blob], filename, { type: 'message/rfc822' });
  return uploadEmail(file);
}

/** POST /api/analyses/:id/ai-analyze — trigger AI + IOC enrichment */
export async function runAiAnalysis(
  id: number,
  enrich = true
): Promise<AiAnalyzeResponse> {
  return request<AiAnalyzeResponse>(
    `/api/analyses/${id}/ai-analyze?enrich=${enrich}`,
    { method: 'POST' }
  );
}

/** GET /api/analyses — paginated history list */
export async function getAnalyses(
  page = 1,
  pageSize = 20,
  filters?: { threatLevel?: string; dateFrom?: string; dateTo?: string; search?: string }
): Promise<PaginatedResponse<AnalysisListItem>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters?.threatLevel) params.set('threat_level', filters.threatLevel);
  if (filters?.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters?.dateTo) params.set('date_to', filters.dateTo);
  if (filters?.search) params.set('search', filters.search);
  return request<PaginatedResponse<AnalysisListItem>>(`/api/analyses?${params}`);
}

/** GET /api/analyses/:id — full detail record */
export async function getAnalysis(id: number): Promise<AnalysisRecord> {
  return request<AnalysisRecord>(`/api/analyses/${id}`);
}

/** POST /api/analyses/:id/chat — send a chat message */
export async function sendChatMessage(
  id: number,
  message: string,
  history: { role: string; content: string }[],
  apiKey?: string
): Promise<{ reply: string; modelUsed: string }> {
  return request<{ reply: string; modelUsed: string }>(`/api/analyses/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, apiKey }),
  });
}
