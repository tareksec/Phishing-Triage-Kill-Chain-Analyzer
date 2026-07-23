import { z } from "zod";
import { AiAnalysisResult, ExtractedAttachment, ExtractedUrl, UrlReputation } from "../types";

const OPENAI_ENDPOINT = process.env.OPENAI_BASE_URL
  ? (process.env.OPENAI_BASE_URL.endsWith('/chat/completions')
    ? process.env.OPENAI_BASE_URL
    : `${process.env.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`)
  : "https://openrouter.ai/api/v1/chat/completions";

// Sensible free-tier defaults; override via OPENAI_MODELS (comma-separated)
// in .env. Order = priority. On a rate limit or transient failure, the next
// model in the list is tried automatically (same rotation approach used in
// the Wazuh alert-triage project).
const DEFAULT_MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2-7b-instruct:free",
];

function getModelList(): string[] {
  const fromEnv = process.env.OPENAI_MODELS;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.split(",").map((m) => m.trim()).filter(Boolean);
  }
  return DEFAULT_MODELS;
}

const AiResultSchema = z.object({
  threat_level: z.enum(["critical", "high", "medium", "low", "benign"]),
  kill_chain_stage: z.enum([
    "reconnaissance",
    "weaponization",
    "delivery",
    "exploitation",
    "installation",
    "c2",
    "actions_on_objectives",
  ]),
  mitre_technique: z.string().regex(/^T\d{4}(\.\d{3})?$/, "must look like T1566 or T1566.002"),
  confidence: z.number().min(0).max(1),
  red_flags: z.array(z.string()).max(15),
  explanation: z.string().min(1).max(1000),
});

const SYSTEM_PROMPT = `You are a SOC (Security Operations Center) analyst performing phishing triage.
You will be given structured, already-parsed data from a single email (headers, authentication
results, extracted URLs, attachment metadata, and optional threat-intel enrichment). Analyze it
and respond with ONLY a JSON object in exactly this shape, with no markdown fences, no preamble,
and no trailing text:

{
  "threat_level": "critical" | "high" | "medium" | "low" | "benign",
  "kill_chain_stage": "reconnaissance" | "weaponization" | "delivery" | "exploitation" | "installation" | "c2" | "actions_on_objectives",
  "mitre_technique": "TXXXX or TXXXX.XXX (MITRE ATT&CK technique ID)",
  "confidence": 0.0 to 1.0,
  "red_flags": ["short phrase", "short phrase", ...],
  "explanation": "2-3 sentence explanation of the verdict"
}

Base your verdict on concrete evidence in the data (auth failures, sender/display-name mismatches,
link/anchor-text mismatches, risky attachment types, and any reputation/enrichment data provided).
Do not invent evidence that isn't present in the input. If the email looks legitimate, say so with
threat_level "benign" or "low" rather than defaulting to a high severity.`;

interface EmailForAi {
  senderEmail: string | null;
  senderDisplayName: string | null;
  senderDomain: string | null;
  replyToEmail: string | null;
  replyToMismatch: boolean;
  displayNameDomainMismatch: boolean;
  spfResult: string | null;
  dkimResult: string | null;
  dmarcResult: string | null;
  subject: string | null;
  extractedUrls: ExtractedUrl[];
  extractedAttachments: ExtractedAttachment[];
  urlReputation?: UrlReputation[];
  urlscanReputation?: any[];
}

function buildUserPrompt(data: EmailForAi): string {
  // Keep this compact and structured rather than dumping raw headers/HTML —
  // cheaper, faster, and less likely to distract smaller free-tier models.
  const payload = {
    sender: {
      email: data.senderEmail,
      displayName: data.senderDisplayName,
      domain: data.senderDomain,
    },
    replyTo: data.replyToEmail,
    replyToMismatch: data.replyToMismatch,
    displayNameDomainMismatch: data.displayNameDomainMismatch,
    authentication: {
      spf: data.spfResult,
      dkim: data.dkimResult,
      dmarc: data.dmarcResult,
    },
    subject: data.subject,
    urls: data.extractedUrls.map((u) => ({
      url: u.url,
      domain: u.domain,
      displayText: u.displayText,
      textHrefMismatch: u.textHrefMismatch,
    })),
    attachments: data.extractedAttachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
    })),
    urlReputation: data.urlReputation ?? [],
    urlscanReputation: data.urlscanReputation ?? [],
  };

  return `Parsed email data:\n${JSON.stringify(payload, null, 2)}\n\nRespond with the JSON object only.`;
}

/** Strips ```json fences some models add despite instructions not to. */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

export class AiAnalysisError extends Error {
  constructor(message: string, public readonly attemptedModels: string[]) {
    super(message);
    this.name = "AiAnalysisError";
  }
}

/**
 * Calls OpenRouter with automatic model rotation: if a model is rate-limited
 * (HTTP 429), errors out, or returns output that fails JSON/schema
 * validation, the next model in OPENAI_MODELS is tried.
 */
export async function analyzeWithAI(
  data: EmailForAi
): Promise<{ result: AiAnalysisResult; modelUsed: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiAnalysisError("OPENAI_API_KEY is not set", []);
  }

  const models = getModelList();
  const userPrompt = buildUserPrompt(data);
  const attempted: string[] = [];
  let lastError: string = "unknown error";

  if (process.env.NODE_ENV !== "production") {
    console.log(`[AI DEBUG] endpoint = ${OPENAI_ENDPOINT}`);
  }

  for (const model of models) {
    attempted.push(model);
    try {
      const requestBody = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        stream: false,
      };

      if (process.env.NODE_ENV !== "production") {
        console.log(`[AI DEBUG] requesting model=${model}`);
        console.log(`[AI DEBUG] body: ${JSON.stringify(requestBody)}`);
      }

      const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (process.env.NODE_ENV !== "production") {
        console.log(`[AI DEBUG] status=${res.status}`);
        console.log(`[AI DEBUG] headers:`, Object.fromEntries(res.headers.entries()));
      }

      if (res.status === 429) {
        lastError = `${model}: rate limited (429)`;
        continue; // rotate to next model
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "no body");
        lastError = `${model}: HTTP ${res.status} - ${errText}`;
        console.error(`[AI API Error] ${lastError}`);
        continue;
      }

      const json: any = await res.json();
      const content: string | undefined = json?.choices?.[0]?.message?.content;
      if (!content) {
        lastError = `${model}: empty response`;
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(content));
      } catch {
        lastError = `${model}: response was not valid JSON`;
        continue;
      }

      const validated = AiResultSchema.safeParse(parsed);
      if (!validated.success) {
        lastError = `${model}: schema validation failed — ${validated.error.message}`;
        continue;
      }

      return { result: validated.data, modelUsed: model };
    } catch (err: any) {
      lastError = `${model}: ${err.message}`;
      continue;
    }
  }

  throw new AiAnalysisError(
    `All models failed or were rate-limited. Last error: ${lastError}`,
    attempted
  );
}

/**
 * Chat with the AI using the email context and history.
 */
export async function chatWithAI(
  data: EmailForAi,
  history: { role: string; content: string }[],
  newMessage: string,
  customApiKey?: string
): Promise<{ reply: string; modelUsed: string }> {
  const apiKey = customApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiAnalysisError("API Key is missing (no custom key provided, and no system default).", []);
  }

  const models = getModelList();

  const systemPrompt = `You are a helpful SOC analyst assistant. You are chatting with the user about a parsed phishing email.
Base your answers on the provided email context. If you don't know something, say so. Keep your answers concise and helpful.`;

  const contextPrompt = buildUserPrompt(data);

  let lastError: string = "unknown error";
  const attempted: string[] = [];

  for (const model of models) {
    attempted.push(model);
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "system", content: contextPrompt }, // Feed the email data as system context
        ...history.map(msg => ({ role: msg.role === "user" ? "user" : "assistant", content: msg.content })),
        { role: "user", content: newMessage }
      ];

      const res = await fetch(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          stream: false,
        }),
      });

      if (res.status === 429) {
        lastError = `${model}: rate limited (429)`;
        continue;
      }

      if (res.status === 401) {
        lastError = `${model}: Unauthorized (401). Please check your API key.`;
        // If custom key is invalid, don't rotate to other models, just fail fast
        if (customApiKey) {
          throw new AiAnalysisError(`Invalid API Key provided: ${lastError}`, attempted);
        }
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "no body");
        lastError = `${model}: HTTP ${res.status} - ${errText}`;
        console.error(`[AI API Error] ${lastError}`);
        continue;
      }

      const json: any = await res.json();
      const content: string | undefined = json?.choices?.[0]?.message?.content;
      if (!content) {
        lastError = `${model}: empty response`;
        continue;
      }

      return { reply: content.trim(), modelUsed: model };
    } catch (err: any) {
      if (err instanceof AiAnalysisError) throw err;
      lastError = `${model}: ${err.message}`;
      continue;
    }
  }

  throw new AiAnalysisError(
    `All models failed or were rate-limited. Last error: ${lastError}`,
    attempted
  );
}