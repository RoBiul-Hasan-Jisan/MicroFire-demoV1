import Anthropic from "@anthropic-ai/sdk";
import { experiments, findings } from "@/lib/data";
import { ANSWER_SCHEMA, buildEvidence, checkAnswer, isRawAnswer, SYSTEM_PROMPT, userMessage } from "@/lib/ask-core";

const MAX_QUESTION = 400;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.ASK_RATE_LIMIT ?? 8); // raised only for security scans

// ponytail: per-instance memory, resets on cold start; use a shared store (KV) if abuse appears.
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limited(ip)) return json({ error: "Too many questions. Wait a minute and try again." }, 429);

  // Cross-site HTML forms cannot send application/json without a CORS preflight, so this blocks CSRF-style posts.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return json({ error: "Send the question as application/json." }, 415);

  let question: unknown;
  try {
    question = (await request.json())?.question;
  } catch {
    return json({ error: "Send JSON like {\"question\": \"...\"}." }, 400);
  }
  if (typeof question !== "string" || question.trim().length < 3 || question.length > MAX_QUESTION)
    return json({ error: `Ask a question between 3 and ${MAX_QUESTION} characters.` }, 400);

  const q = question.trim();
  const { items, outside } = buildEvidence(q, experiments, findings);
  const base = { evidence: items, outside };

  if (items.length === 0)
    return json({ ...base, mode: "evidence-only", reason: "No test or finding in the atlas matches this question." });
  if (!process.env.ANTHROPIC_API_KEY)
    return json({ ...base, mode: "evidence-only", reason: "The AI summary is switched off on this deployment. The matching evidence is below." });

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: ANSWER_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage(q, items, outside) }],
    });

    if (response.stop_reason === "refusal")
      return json({ ...base, mode: "evidence-only", reason: "The model declined this question. The matching evidence is below." });

    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (!isRawAnswer(parsed))
      return json({ ...base, mode: "evidence-only", reason: "The AI answer could not be read. The matching evidence is below." });

    return json({ ...base, mode: "ai", summary: parsed.summary, claims: checkAnswer(parsed, items) });
  } catch (error) {
    const reason =
      error instanceof Anthropic.RateLimitError
        ? "The AI service is busy."
        : error instanceof Anthropic.AuthenticationError
          ? "The AI service key is not valid."
          : error instanceof Anthropic.APIConnectionError
            ? "The AI service could not be reached."
            : error instanceof Anthropic.APIError
              ? `The AI service returned an error (${error.status}).`
              : "The AI answer failed.";
    console.error("ask: model call failed", error instanceof Anthropic.APIError ? error.status : error);
    return json({ ...base, mode: "evidence-only", reason: `${reason} The matching evidence is below.` });
  }
}
