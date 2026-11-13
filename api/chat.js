// Max's brain. Runs as a Vercel function and asks one of three AIs:
//  - "free" (default): Pollinations, a free public AI service. No key, no card, no setup.
//  - Cloudflare Workers AI: used when CF_ACCOUNT_ID and CF_API_TOKEN are set in Vercel.
//  - Vercel AI Gateway (Claude Haiku 5.5): used when MAX_BRAIN=gateway or AI_GATEWAY_API_KEY
//    is set. Needs a card on the Vercel team.
import { getVercelOidcToken } from "@vercel/oidc";

const CF = process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN;
const GATEWAY = !CF && (process.env.MAX_BRAIN === "gateway" || process.env.AI_GATEWAY_API_KEY);
const FREE = !CF && !GATEWAY;
const MODEL = process.env.MAX_MODEL || (CF ? "@cf/meta/llama-3.3-70b-instruct-fp8-fast" : GATEWAY ? "anthropic/claude-haiku-5.5" : "openai-fast");
const URL_ = CF
  ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`
  : GATEWAY ? "https://ai-gateway.vercel.sh/v1/chat/completions"
  : "https://text.pollinations.ai/openai";

const MODES = {
  teach: "TEACH ME. Explain the idea in small steps with a simple example or analogy for the level. Then ask ONE short question to check understanding.",
  quiz: "QUIZ ME. Ask one question at a time and wait. When the student answers, say if it is right, explain why in one or two sentences, then ask the next, slightly harder question. Keep score like (Score: 2/3).",
  hint: "HINTS ONLY. Never give the final answer. Give one small hint or guiding question so the student does the work.",
};
const LEVELS = ["Kid (8–11)", "Middle school", "High school", "College", "Adult beginner"];

const system = (subject, level, mode) => `You are Max, a warm, patient, encouraging tutor. Student level: ${level}.${subject ? " Subject: " + subject + "." : ""}
Mode: ${MODES[mode]}
Rules: keep replies short (usually under 150 words). Use short paragraphs, bullet lists and **bold** key words. Be kind about mistakes: point to the exact wrong step and let them retry. Guide homework instead of just giving answers. Use simple Markdown only (bold, lists, \`code\`, code blocks); no tables or LaTeX, write math in plain text like 3x + 5 = 20. If the student attached a file, its text is in their message between <file> tags: use it to teach them. If you are not sure about a fact, say so.`;

const VOICE = "\nThis turn is a SPOKEN conversation: your reply will be read aloud. Answer in 1 to 3 short, natural sentences. No Markdown, no lists, no emoji, no code blocks. Say math in words.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const mode = MODES[body.mode] ? body.mode : "teach";
  const level = LEVELS.includes(body.level) ? body.level : "High school";
  const subject = String(body.subject || "").slice(0, 80);
  let budget = GATEWAY ? 120000 : 24000; // characters of conversation we'll send, newest first
  const messages = [];
  for (const m of (Array.isArray(body.messages) ? body.messages : []).slice(-20).reverse()) {
    if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) continue;
    const content = m.content.slice(0, Math.max(0, budget));
    if (!content) break;
    budget -= content.length;
    messages.unshift({ role: m.role, content });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "Send a message for Max to answer." });
  }

  let token;
  try {
    token = FREE ? "" : CF ? process.env.CF_API_TOKEN : process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken());
  } catch {
    return res.status(500).json({ error: "Max's cloud brain isn't set up: this must run on Vercel (or set AI_GATEWAY_API_KEY)." });
  }

  const ask = (model) => fetch(URL_, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: true, max_tokens: body.voice ? 300 : 1200, messages: [{ role: "system", content: system(subject, level, mode) + (body.voice ? VOICE : "") }, ...messages] }),
  }).catch((e) => ({ ok: false, status: 502, text: async () => String(e) }));
  let upstream = await ask(MODEL);
  // The free service's fast model can be missing or busy: fall back to its standard one.
  if (FREE && !upstream.ok && MODEL !== "openai") upstream = await ask("openai");

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("AI error", upstream.status, detail.slice(0, 500));
    let reason = "";
    try { const j = JSON.parse(detail); reason = j.error?.message || j.errors?.[0]?.message || j.message || ""; } catch { reason = detail.slice(0, 300); }
    const msg = upstream.status === 429 && !/credit|billing|payment|fund/i.test(reason) ? "Max is getting a lot of questions right now. Wait a moment and try again."
      : FREE ? (upstream.status === 429 ? "Max's free AI is busy. Wait a few seconds and try again." : "Max's free AI didn't answer. Try again in a moment.")
      : CF && /limit|neuron|quota/i.test(reason) ? "Max has used today's free AI. He'll be back tomorrow."
      : CF && (upstream.status === 401 || upstream.status === 403) ? "Max's Cloudflare token isn't working. Check CF_API_TOKEN and CF_ACCOUNT_ID in Vercel."
      : /credit|card|billing|payment|fund|quota/i.test(reason) || upstream.status === 402 ? "Max needs free AI set up. Add CF_ACCOUNT_ID and CF_API_TOKEN in Vercel (see the README), or add a card in Vercel's AI Gateway tab."
      : upstream.status === 401 || upstream.status === 403 ? "Max's server isn't allowed to use AI Gateway yet. Open the AI Gateway tab in Vercel and turn it on."
      : "Max's server didn't get an answer. Try again.";
    return res.status(502).json({ error: msg + (reason ? ` (Vercel said: ${reason.slice(0, 200)})` : ` (error ${upstream.status})`) });
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const text = JSON.parse(data).choices?.[0]?.delta?.content;
          if (text) res.write(text);
        } catch {}
      }
    }
  } catch (e) {
    console.error("stream error", e);
    res.write("\n\n⚠️ Max got cut off. Try again.");
  }
  res.end();
}
