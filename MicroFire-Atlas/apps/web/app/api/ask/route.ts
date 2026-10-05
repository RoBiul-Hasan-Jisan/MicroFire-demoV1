import Anthropic from "@anthropic-ai/sdk";
import { experiments, findings, saffireRuns, luciRuns } from "@/lib/data";
import { ANSWER_SCHEMA, buildEvidence, checkAnswer, isRawAnswer, SYSTEM_PROMPT, userMessage } from "@/lib/ask-core";

const MAX_QUESTION = 400;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.ASK_RATE_LIMIT ?? 8); // raised only for security scans
const CACHE_MS = 6 * 60 * 60_000;
const CACHE_MAX = 200;

// ponytail: per-instance memory, resets on cold start; use a shared store (KV) if abuse appears.
const hits = new Map<string, number[]>();
// Same question, same evidence, same answer: a short cache keeps a busy demo inside its API quota.
const answers = new Map<string, { at: number; body: Record<string, unknown> }>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

type Synthesis = { ok: true; parsed: unknown; provider: string } | { ok: false; reason: string };

/** OpenAI Chat Completions with a strict JSON schema. Model is configurable; the default is a small, fast model. */
async function viaOpenAI(user: string): Promise<Synthesis> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "evidence_answer", strict: true, schema: ANSWER_SCHEMA } },
      max_completion_tokens: 4000,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    console.error("ask: openai", res.status);
    return { ok: false, reason: res.status === 429 ? "The AI service is busy." : res.status === 401 ? "The AI service key is not valid." : `The AI service returned an error (${res.status}).` };
  }
  const data = await res.json();
  const choice = data?.choices?.[0];
  if (choice?.message?.refusal) return { ok: false, reason: "The model declined this question." };
  try {
    return { ok: true, parsed: JSON.parse(choice?.message?.content ?? ""), provider: "openai" };
  } catch {
    return { ok: false, reason: "The AI answer could not be read." };
  }
}

async function viaAnthropic(user: string): Promise<Synthesis> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ANSWER_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return { ok: false, reason: "The model declined this question." };
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return { ok: true, parsed: JSON.parse(text), provider: "anthropic" };
  } catch {
    return { ok: false, reason: "The AI answer could not be read." };
  }
}

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
  const { items, outside } = buildEvidence(q, experiments, findings, saffireRuns, luciRuns);
  const base = { evidence: items, outside };

  if (items.length === 0)
    return json({ ...base, mode: "evidence-only", reason: "No test or finding in the atlas matches this question." });
  const provider = process.env.OPENAI_API_KEY ? viaOpenAI : process.env.ANTHROPIC_API_KEY ? viaAnthropic : null;
  if (!provider)
    return json({ ...base, mode: "evidence-only", aiStatus: "coming-soon", reason: "AI synthesis is coming soon. The matching NASA evidence is below." });

  const cacheKey = q.toLowerCase().replace(/\s+/g, " ");
  const cached = answers.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return json({ ...cached.body, cached: true });

  try {
    const out = await provider(userMessage(q, items, outside));
    if (!out.ok) return json({ ...base, mode: "evidence-only", reason: `${out.reason} The matching evidence is below.` });
    if (!isRawAnswer(out.parsed))
      return json({ ...base, mode: "evidence-only", reason: "The AI answer could not be read. The matching evidence is below." });
    const body = { ...base, mode: "ai", provider: out.provider, summary: out.parsed.summary, claims: checkAnswer(out.parsed, items, q) };
    if (answers.size >= CACHE_MAX) answers.delete(answers.keys().next().value!);
    answers.set(cacheKey, { at: Date.now(), body });
    return json(body);
  } catch (error) {
    const reason =
      error instanceof Anthropic.RateLimitError
        ? "The AI service is busy."
        : error instanceof Anthropic.AuthenticationError
          ? "The AI service key is not valid."
          : error instanceof Anthropic.APIConnectionError || (error instanceof Error && error.name === "TimeoutError")
            ? "The AI service could not be reached."
            : error instanceof Anthropic.APIError
              ? `The AI service returned an error (${error.status}).`
              : "The AI answer failed.";
    console.error("ask: model call failed", error instanceof Anthropic.APIError ? error.status : error);
    return json({ ...base, mode: "evidence-only", reason: `${reason} The matching evidence is below.` });
  }
}
