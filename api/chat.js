// Max's brain. Runs as a Vercel function and asks one of these AIs:
//  - "free" (default): Pollinations, a free public AI service. No key, no card, no setup.
//  - Your own AI router or provider: set MAX_AI_URL, MAX_AI_KEY and MAX_MODEL in Vercel. Works with
//    anything that speaks the OpenAI chat format: OmniRoute, OpenRouter, Groq, and others.
//    MAX_MODEL can list several models separated by commas; they are tried in order.
//  - Cloudflare Workers AI: used when CF_ACCOUNT_ID and CF_API_TOKEN are set.
//  - Vercel AI Gateway (Claude): used when MAX_BRAIN=gateway or AI_GATEWAY_API_KEY is set.

const OWN = (process.env.MAX_AI_URL || "").trim().replace(/\/+$/, "");
const CF = !OWN && process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN;
const GATEWAY = !OWN && !CF && (process.env.MAX_BRAIN === "gateway" || process.env.AI_GATEWAY_API_KEY);
const FREE = !OWN && !CF && !GATEWAY;
const MODELS = (process.env.MAX_MODEL || "").split(",").map((x) => x.trim()).filter(Boolean);
const MODEL = MODELS[0] || (CF ? "@cf/meta/llama-3.3-70b-instruct-fp8-fast" : GATEWAY ? "anthropic/claude-haiku-5.5" : "openai-fast");
const URL_ = OWN ? (/\/chat\/completions$/.test(OWN) ? OWN : OWN + "/chat/completions")
  : CF ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`
  : GATEWAY ? "https://ai-gateway.vercel.sh/v1/chat/completions"
  : "https://text.pollinations.ai/openai";

const MODES = {
  chat: "Teach by default: explain the idea in small steps with a simple example or analogy for the level, then ask ONE short question to check understanding. If the student asks to be quizzed, ask one question at a time and wait; when they answer, say if it is right and why in one or two sentences, then ask the next, slightly harder question, keeping score like (Score: 2/3). If the student asks for hints only, never give the final answer: give one small hint or guiding question so they do the work.",
  teach: "TEACH ME. Explain the idea in small steps with a simple example or analogy for the level. Then ask ONE short question to check understanding.",
  quiz: "QUIZ ME. Ask one question at a time and wait. When the student answers, say if it is right, explain why in one or two sentences, then ask the next, slightly harder question. Keep score like (Score: 2/3).",
  code: "CODE",
  site: "SITE",
  hint: "HINTS ONLY. Never give the final answer. Give one small hint or guiding question so the student does the work.",
};
const LEVELS = ["Kid (8–11)", "Middle school", "High school", "College", "Adult beginner"];

const CODER = (subject, level) => `You are Max, a friendly tutor who is also a skilled programmer. Student level: ${level}.${subject ? " Subject: " + subject + "." : ""}
When asked to build or fix something, write complete, working, runnable code, not fragments or placeholders.
- Put code in fenced blocks with the language name, like \`\`\`python.
- For anything that runs in a browser (a web page, game, animation, calculator), give ONE self-contained file in a single \`\`\`html block, with its CSS and JavaScript inside it and no outside libraries or images. The student can press Run to try it, so it must work as is and fit a phone screen.
- For plain JavaScript, use console.log to show results; the student can press Run to see them.
- After the code, explain how it works in 2 to 4 short sentences for the student's level, and suggest one thing to try changing.
- When the student shares broken code, say what the bug is, then give the full corrected code.
If the student attached a file, its text is in their message between <file> tags.`;

const SITE = (level, repo, paths) => `You are Max, a friendly tutor and skilled programmer. You are editing the student's own website, which lives in the GitHub repository ${repo}. Student level: ${level}.
Files in the repository:
${paths.join("\n") || "(unknown)"}
You work like a careful software engineer: look first, then make the smallest correct change, then it gets checked.

Looking around (reply with ONLY these lines, nothing else, when you need to look):
- READ: path/one.html, path/two.css        opens whole files (up to 4 per line)
- READ: path/big.js:120-300                opens only those lines of a big file
- SEARCH: some text                        finds that text in every file and shows file:line for each match
Open files appear in the conversation between <file name="PATH"> tags. You cannot see a file until it is open.
Always open the part of a file you are going to change. Never change text you have not seen. Open related files too (the CSS or JavaScript a page uses) when the change touches them. Use exact paths from the list above.

Making the change. First say in one or two short sentences what you will change and where. Then use one of these blocks per file:

1. An edit block, for changing part of an existing file. Best for small changes, and the only way for big files:
\`\`\`edit:PATH
<<<<<<< FIND
the exact lines that are in the file now
=======
the new lines that replace them
>>>>>>> REPLACE
\`\`\`
The FIND lines must be copied exactly from the open file, be enough lines to be unique, and stay short. One block can hold several FIND/REPLACE parts.

2. A file block, for a new file or to rewrite a small file completely:
\`\`\`file:PATH
the complete contents of the file
\`\`\`
A file block replaces the whole file, so never shorten or skip parts and never write "rest unchanged" or "...".

Rules:
- Change only what the student asked for. Keep the existing style, names and structure.
- Your change is applied to a copy and checked automatically before the student sees it. If you are told about a problem, fix exactly that and give all your blocks again.
- After the blocks, add one sentence on how the student can check the change on the live site.
- If the student only asks a question about the site, just answer it without any file block.`;

const system = (subject, level, mode, site) => mode === "site" && site ? SITE(level, site.repo, site.paths) : mode === "code" || mode === "site" ? CODER(subject, level) : `You are Max, a warm, patient, encouraging tutor. Student level: ${level}.${subject ? " Subject: " + subject + "." : ""}
Mode: ${MODES[mode]}
Rules: keep replies short (usually under 150 words). Use short paragraphs, bullet lists and **bold** key words. Be kind about mistakes: point to the exact wrong step and let them retry. Guide homework instead of just giving answers. Use simple Markdown only (bold, lists, \`code\`, code blocks); no tables or LaTeX, write math in plain text like 3x + 5 = 20. If the student attached a file, its text is in their message between <file> tags: use it to teach them. If you are not sure about a fact, say so.`;

// Who Max is, for every mode. Students type casually, and "you" must mean Max, not a letter.
const ABOUT = `

About you: you are Max, an AI tutor inside the Max Tutor app. You teach step by step, quiz students, give hints, write and run code, and can edit a student's website on GitHub. You are friendly, patient and encouraging. Students type casually: "u" means "you", "ur" means "your", "r" means "are". When a student says "explain you", "who u are" or "about you", they mean YOU, Max, never the letter U. If they ask for a website or text about you, write it about Max: who he is, what he can do (teach, quiz, hints, code, edit websites), and how he helps students learn.`;

const VOICE = "\nThis turn is a SPOKEN conversation: your reply will be read aloud. Answer in 1 to 3 short, natural sentences. No Markdown, no lists, no emoji, no code blocks. Say math in words.";

// The free service lists its models; pick the strongest ones it offers without an account.
const WANT_HARD = ["openai-large", "qwen-coder", "deepseek", "mistral", "openai"];
const WANT_HIGH = ["openai", "openai-large"];
const WANT_EASY = ["openai-fast", "openai"];
let modelCache = { at: 0, names: null };
async function freeModels(hard, tier) {
  const want = hard ? WANT_HARD : tier === "high" ? WANT_HIGH : WANT_EASY;
  if (Date.now() - modelCache.at > 10 * 60 * 1000) {
    modelCache.at = Date.now();
    try {
      const r = await fetch("https://text.pollinations.ai/models", { signal: AbortSignal.timeout(3000) });
      const list = await r.json();
      modelCache.names = (Array.isArray(list) ? list : [])
        .filter((m) => !m || typeof m === "string" || !m.tier || m.tier === "anonymous")
        .map((m) => (typeof m === "string" ? m : m.name)).filter(Boolean);
    } catch { modelCache.names = null; }
  }
  const have = modelCache.names;
  const picked = have && have.length ? want.filter((m) => have.includes(m)) : want;
  return [...new Set([...picked, "openai"])].slice(0, 4);
}

/* Max's built-in router. People connect AI providers in Max's settings (a free key each, or their
   connected GitHub account); every question is tried on those, strongest first, then on the free AI. */
const PRESETS = {
  anthropic: { name: "Claude", url: "https://api.anthropic.com/v1", fixed: true, needMax: true, hard: ["claude-fable-5-2", "claude-opus-5-5"], high: ["claude-opus-5-5", "claude-sonnet-5-5"], mid: ["claude-sonnet-5-5", "claude-haiku-5-5"], quick: ["claude-haiku-5-5", "claude-sonnet-5-5"] },
  gemini: { name: "Gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai", fallback: ["gemini-2.5-flash"] },
  github: { name: "GitHub Models", url: "https://models.github.ai/inference", list: "https://models.github.ai/catalog/models", fallback: ["openai/gpt-4.1", "openai/gpt-4o-mini"] },
  openrouter: { name: "OpenRouter", url: "https://openrouter.ai/api/v1", only: /:free$/, fallback: ["meta-llama/llama-3.3-70b-instruct:free"] },
  groq: { name: "Groq", url: "https://api.groq.com/openai/v1", many: 5, fallback: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"] },
  aimlapi: { name: "AI/ML API", url: "https://api.aimlapi.com/v1", fallback: ["gpt-4o"] },
  mistral: { name: "Mistral", url: "https://api.mistral.ai/v1", fallback: ["mistral-large-latest"] },
};
const NOT_CHAT = /embed|whisper|tts|guard|image|rerank|moderation|audio|dall|imagen|veo|aqa|learnlm|live|native|robotics|computer-use|transcribe|realtime|ocr|speech/i;
const STRONG = [/gpt-5(?!.*(nano|mini|chat))/i, /claude.*(opus|sonnet)/i, /gemini-[\d.]+-pro/i, /gpt-4\.1$/i, /kimi-k2/i, /qwen.*coder/i, /deepseek.*(v3|chat|r1)/i, /gpt-oss-120b/i,
  /gemini-[\d.]+-flash(?!-lite)/i, /llama-3\.3-70b/i, /mistral-large/i, /codestral/i, /gpt-4o$/i, /gpt-4\.1-mini|gpt-5-mini/i];
// Three tiers, like Haiku / Sonnet / Opus: small and fast models answer easy things (voice, short chat),
// mid models teach and quiz, and the biggest ones with the most thinking write code and edit websites.
const LIGHT = [/haiku/i, /llama-3\.1-8b/i, /ministral-[38]b/i, /mistral-nemo/i, /flash-lite/i, /gpt-.*nano/i, /gpt-.*mini|gpt-4o-mini/i, /gpt-oss-20b/i, /gemini-[\d.]+-flash(?!-lite)/i, /mistral-small/i, /llama-3\.3-70b/i];
// Between Sonnet and Ultra: strong, but not the very top models.
const HIGH = [/claude.*opus/i, /gpt-oss-120b/i, /gpt-4\.1$/i, /gemini-[\d.]+-flash(?!-lite)/i, /qwen.*(coder|32b|max)/i, /mistral-large|codestral/i, /deepseek.*(v3|chat)/i, /llama-3\.3-70b/i, /gpt-4o$/i, /kimi-k2/i];
// Codex: the very best models for code, ahead of everything else.
const BEST = [/codex/i, /gpt-5(?!.*(nano|mini|chat))/i, /claude.*opus/i, /gemini-[\d.]+-pro/i, ...STRONG];
const QUICK = [/claude.*sonnet/i, /gemini-[\d.]+-flash(?!-lite)/i, /gpt-4\.1-mini|gpt-4o-mini|gpt-5-mini/i, /llama-3\.3-70b/i, /gpt-oss-20b/i, /mistral-small/i, /flash-lite/i, ...STRONG];
const pickCache = new Map();
const noCredit = new Map(); // provider+key -> { at, msg }: refused the key or out of credit; skipped for a few minutes
const NO_CREDIT_MS = 3 * 60 * 1000;

// Providers the owner switched on for everybody, with a key saved in Vercel's Environment Variables
// (AIMLAPI_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY). An optional
// <NAME>_MODEL variable (for example AIMLAPI_MODEL) picks a model; otherwise Max picks the strongest.
const SHARED = { anthropic: "ANTHROPIC_API", aimlapi: "AIMLAPI", gemini: "GEMINI_API", openrouter: "OPENROUTER_API", groq: "GROQ_API", mistral: "MISTRAL_API" };
function sharedBrains() {
  const out = [];
  for (const [id, name] of Object.entries(SHARED)) {
    const key = (process.env[name + "_KEY"] || "").trim();
    if (key) out.push({ ...PRESETS[id], id, key, model: (process.env[name + "_MODEL"] || "").trim() });
  }
  return out;
}
function readBrains(body) { // -> { brains } or { error }
  const list = Array.isArray(body.brains) ? body.brains.slice(0, 4) : [];
  if (body.brain && typeof body.brain.url === "string" && body.brain.url.trim()) list.unshift({ id: "custom", ...body.brain });
  const brains = [];
  for (const b of list) {
    const key = String(b?.key || "").trim().slice(0, 400), model = String(b?.model || "").trim().slice(0, 300);
    if (PRESETS[b?.id]) { if (key) brains.push({ ...PRESETS[b.id], id: b.id, key, model }); continue; }
    if (b?.id !== "custom" || !String(b.url || "").trim()) continue;
    let u; try { u = new URL(String(b.url).trim()); } catch { return { error: "That AI address isn't a valid web address. It should look like https://something/v1" }; }
    const host = u.hostname;
    if (u.protocol !== "https:" || !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || /\.(local|internal|lan|home)$/.test(host))
      return { error: "Max's server can only reach an AI address on the internet that starts with https://. An address like localhost or 192.168… only works on your own network, so the router needs a public address first." };
    brains.push({ id: "custom", name: "Your router", url: (u.origin + u.pathname).replace(/\/+$/, "").replace(/\/chat\/completions$/, ""), key, model: model || "auto" });
  }
  return { brains: brains.slice(0, 4) };
}
// Which of a provider's models to try: the person's choice, or the strongest ones its model list offers.
async function brainModels(b, tier) {
  const hard = tier === "heavy" || tier === "best";
  if (b.model) return b.model.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3);
  if (b.fixed) return b[{ best: "hard", heavy: "hard", high: "high", standard: "mid", light: "quick" }[tier]] || b.quick; // this provider's models are known, so no lookup
  const cacheKey = `${b.id}:${b.key.slice(-8)}:${tier}`, hit = pickCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.models;
  let models = b.fallback || [];
  try {
    const r = await fetch(b.list || b.url + "/models", { headers: { Authorization: `Bearer ${b.key}` }, signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    const ids = (Array.isArray(j) ? j : j.data || j.models || []).filter((x) => !x.type || /chat|text|language|llm/i.test(String(x.type))).map((x) => String(x.id || x.name || "").replace(/^models\//, "")).filter((id) => id && !NOT_CHAT.test(id) && (!b.only || b.only.test(id)));
    const want = tier === "best" ? BEST : tier === "heavy" ? STRONG : tier === "high" ? [...HIGH, ...STRONG] : tier === "light" ? [...LIGHT, ...QUICK] : QUICK, rank = (id) => { const i = want.findIndex((re) => re.test(id)); return i < 0 ? 999 : i; };
    const sorted = ids.map((id) => [rank(id), id]).filter(([n]) => n < 999).sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? 1 : -1)).map(([, id]) => id);
    const picked = [...new Set(sorted)].slice(0, b.many || 3);
    if (picked.length) models = picked; else if (ids.length && !models.length) models = ids.slice(0, 2);
  } catch {}
  pickCache.set(cacheKey, { at: Date.now(), models });
  return models;
}

// Runs at the edge so a long answer (a whole web page) can keep streaming for minutes.
export const config = { runtime: "edge" };

// What an AI error means for the student.
function explain(status, detail, mine) {
  let reason = "";
  try { const j = JSON.parse(detail); reason = j.error?.message || j.errors?.[0]?.message || j.message || (typeof j.error === "string" ? j.error : ""); } catch { reason = String(detail || "").slice(0, 300); }
  if (mine) return (status === 402 || /credit|fund|balance|billing|payment/i.test(reason) ? `${mine.name} has no credit left. Add funds on its website.`
    : status === 401 || status === 403 ? `${mine.name} refused the key. Check it in Max's settings.`
    : status === 404 ? `${mine.name} doesn't know that address or model. Check them in Max's settings.`
    : status === 429 ? `${mine.name} says it is busy or out of free use for now.`
    : `${mine.name} didn't answer properly.`) + (reason ? ` (it said: ${reason.slice(0, 200)})` : ` (error ${status})`);
  const msg = status === 429 && !/credit|billing|payment|fund/i.test(reason) ? (FREE ? "Max's free AI is busy. Wait a few seconds and try again." : "Max is getting a lot of questions right now. Wait a moment and try again.")
    : FREE ? "Max's free AI didn't answer. Try again in a moment."
    : OWN ? (status === 401 || status === 403 ? "Max's AI key was refused. Check MAX_AI_KEY in Vercel." : status === 404 ? "Max's AI address or model name is wrong. Check MAX_AI_URL and MAX_MODEL in Vercel." : "Max's AI didn't answer. Try again in a moment.")
    : CF && /limit|neuron|quota/i.test(reason) ? "Max has used today's free AI. He'll be back tomorrow."
    : CF && (status === 401 || status === 403) ? "Max's Cloudflare token isn't working. Check CF_API_TOKEN and CF_ACCOUNT_ID in Vercel."
    : /credit|card|billing|payment|fund|quota/i.test(reason) || status === 402 ? "Max's AI needs a card in Vercel's AI Gateway tab, or remove MAX_BRAIN to use the free AI."
    : status === 401 || status === 403 ? "Max's server isn't allowed to use AI Gateway yet. Open the AI Gateway tab in Vercel and turn it on."
    : "Max's server didn't get an answer. Try again.";
  return msg + (reason ? ` (the AI service said: ${reason.slice(0, 200)})` : ` (error ${status})`);
}

export default async function handler(req) {
  const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method !== "POST") return json(405, { error: "Use POST." });

  const body = await req.json().catch(() => ({}));
  const mode = MODES[body.mode] ? body.mode : "chat";
  const level = LEVELS.includes(body.level) ? body.level : "High school";
  const subject = String(body.subject || "").slice(0, 80);
  const site = body.site && /^[\w.-]+\/[\w.-]+$/.test(String(body.site.repo || ""))
    ? { repo: String(body.site.repo), paths: (Array.isArray(body.site.paths) ? body.site.paths : []).slice(0, 150).map((x) => String(x).slice(0, 200).replace(/[\r\n`]/g, "")) }
    : null;
  let budget = GATEWAY ? 120000 : mode === "site" ? 60000 : 24000; // characters of conversation we'll send, newest first
  const messages = [];
  for (const m of (Array.isArray(body.messages) ? body.messages : []).slice(-20).reverse()) {
    if ((m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) continue;
    const content = m.content.slice(0, Math.max(0, budget));
    if (!content) break;
    budget -= content.length;
    messages.unshift({ role: m.role, content });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return json(400, { error: "Send a message for Max to answer." });

  const read = readBrains(body);
  if (read.error) return json(400, { error: read.error });
  // The person's own providers first, then the ones the owner saved for everybody.
  const brains = [...read.brains, ...(body.test ? [] : sharedBrains().filter((e) => !read.brains.some((b) => b.id === e.id)))].slice(0, 6);
  if (body.test && !brains.length) return json(400, { error: "Enter a key first." });
  const token = FREE ? "" : OWN ? process.env.MAX_AI_KEY || "" : CF ? process.env.CF_API_TOKEN : process.env.AI_GATEWAY_API_KEY || req.headers.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN || "";
  if (!brains.length && OWN && !MODELS.length) return json(500, { error: "Max's own AI is half set up: add MAX_MODEL in Vercel with the model name to use." });
  if (!brains.length && !FREE && !OWN && !token) return json(500, { error: "Max's AI isn't set up: set AI_GATEWAY_API_KEY, or remove MAX_BRAIN to use the free AI." });

  // How big a brain the student asked for: Haiku (light), Sonnet (standard) or Ultra (heavy). Code is always heavy.
  const tier = body.voice ? "light" : mode === "code" || mode === "site" ? (body.tier === "best" ? "best" : "heavy") : { light: "light", standard: "standard", high: "high", heavy: "heavy" }[body.tier] || "standard";
  const hard = mode === "code" || mode === "site" || tier === "heavy" || tier === "best";
  // Which provider answers first for each size. AI/ML API (when it has credit) or else Mistral runs Haiku, Sonnet,
  // Opus and Codex, and Groq runs Ultra and Code. Anything else you connected, and finally the free AI, follows as a
  // backup. A provider that isn't connected, or has no credit, is simply skipped.
  const lower = ["aimlapi", "mistral", "openrouter"];
  const prefer = { light: lower, standard: lower, high: lower, heavy: ["groq"], best: ["aimlapi", "openrouter", "mistral"] }[tier];
  const rankOf = (b) => (b.id === "custom" ? 0 : prefer.includes(b.id) ? 1 + prefer.indexOf(b.id) : 9);
  brains.sort((x, y) => rankOf(x) - rankOf(y));
  const stop = new AbortController();
  req.signal?.addEventListener("abort", () => stop.abort());
  const room = body.voice ? 300 : mode === "site" ? 16000 : mode === "code" ? 12000 : tier === "best" ? 6000 : tier === "heavy" ? 4000 : tier === "high" ? 2500 : tier === "light" ? 800 : 1500;
  // A route is one model at one provider. Connected providers choose their own answer length.
  const ask = (rt, extra = {}) => fetch(rt.url, {
    method: "POST", signal: stop.signal,
    headers: { ...(rt.token ? { Authorization: `Bearer ${rt.token}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify({ model: rt.model, stream: true, ...(rt.effort ? { reasoning_effort: rt.effort } : {}), ...(rt.own && !rt.own.needMax ? (body.voice ? { max_tokens: 300 } : {}) : { max_tokens: room }), ...extra, messages: [{ role: "system", content: system(subject, level, mode, site) + ABOUT + (body.voice ? VOICE : "") }, ...messages] }),
  });

  // The answer is sent as plain text. Notes for the page (which model, errors, keep-alive pings) travel
  // inside it as small JSON records wrapped in \u0001 characters, which the page takes back out.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(out) {
      const note = (o) => { try { out.enqueue(enc.encode("\u0001" + JSON.stringify(o) + "\u0001")); } catch {} };
      const ping = setInterval(() => note({ ping: 1 }), 8000); // keeps the connection open while the AI thinks
      let wrote = false, lastError = "";
      try {
        // Routes to try, in order: the providers this person connected, then Max's default AI.
        const routes = [];
        // Models that can think (gpt-oss) are told how hard to: a little for easy things, the most for code and websites.
        const effort = (model) => (/gpt-oss/i.test(model) ? { light: "low", standard: "medium", high: "medium", heavy: "high", best: "high" }[tier] : undefined);
        const skipNow = new Map(), keyOf = (b) => b.id + b.key.slice(-6);
        const live = brains.filter((b) => { const hit = noCredit.get(keyOf(b)); if (hit && Date.now() - hit.at < NO_CREDIT_MS) { skipNow.set(b.id, hit.msg); return false; } return true; });
        for (const b of live) for (const model of await brainModels(b, tier)) routes.push({ url: b.url + "/chat/completions", token: b.key, model, label: `${b.name} · ${model}`, own: b, effort: effort(model) });
        if (!body.test) {
          let tries = [MODEL];
          if (MODELS.length) tries = MODELS.slice(0, 4);
          else if (GATEWAY) tries = hard ? ["anthropic/claude-sonnet-5.5", MODEL] : [MODEL];
          else if (FREE) tries = await freeModels(hard, tier);
          for (const model of tries) routes.push({ url: URL_, token, model, label: model, own: null });
        }
        // Some models think silently first and can use up all their room before writing anything.
        // When that happens on the default AI, ask the same model again with less thinking and more room.
        const plan = routes.flatMap((rt) => rt.own ? [[rt, {}]] : [[rt, {}], [rt, { reasoning_effort: "low", max_tokens: Math.max(room * 2, 8000) }], [rt, { max_tokens: Math.max(room * 3, 12000) }]]);
        let skipRetries = null;
        const failed = new Map(skipNow); // provider -> why it couldn't answer, so the student can see why a backup answered
        const dead = new Set(); // providers that refused the key or have no credit left: no point trying their other models
        for (const [rt, extra] of plan) {
          const retry = Object.keys(extra).length > 0, mine = rt.own, model = rt.label;
          if (retry && skipRetries !== rt) continue; // retries only follow an empty, thought-out answer
          if (rt.own && dead.has(rt.own.id)) continue;
          let up;
          try { up = await ask(rt, extra); } catch (e) { if (stop.signal.aborted) return; lastError = mine ? `Max's server couldn't reach ${mine.name}. Check that it is set up right and running.` : "Max's server couldn't reach his AI. Try again."; continue; }
          // A provider that doesn't know the thinking setting says so with a 400. Ask again without it.
          if (!up.ok && up.status === 400 && rt.effort) { try { up = await ask({ ...rt, effort: undefined }, extra); } catch { continue; } }
          if (!up.ok && rt.own && [401, 402, 403].includes(up.status)) dead.add(rt.own.id);
          if (!up.ok || !up.body) {
            if (!retry) { lastError = explain(up.status, await up.text().catch(() => ""), mine); if (mine && !failed.has(mine.id)) failed.set(mine.id, lastError); if (mine && [401, 402, 403].includes(up.status)) noCredit.set(keyOf(mine), { at: Date.now(), msg: lastError }); }
            continue;
          }
          note({ model: model.replace(/[^\w./@: ·-]/g, "") });
          if (failed.size && !(mine && failed.has(mine.id))) note({ fallback: [...failed.values()][0] });
          const reader = up.body.getReader(), dec = new TextDecoder();
          let buf = "", all = "", thought = false, cut = false;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = dec.decode(value, { stream: true });
            buf += chunk; if (all.length < 400000) all += chunk;
            let nl;
            while ((nl = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const c = JSON.parse(data).choices?.[0];
                const text = c?.delta?.content ?? c?.message?.content;
                if (c?.delta?.reasoning_content || c?.delta?.reasoning) thought = true;
                if (c?.finish_reason === "length") cut = true;
                if (typeof text === "string" && text) { out.enqueue(enc.encode(text)); wrote = true; }
              } catch {}
            }
          }
          if (!wrote) { // some services answer in one piece instead of a stream
            try { const j = JSON.parse(all); const text = j.choices?.[0]?.message?.content; if (typeof text === "string" && text) { out.enqueue(enc.encode(text)); wrote = true; } else if (j.error) lastError = explain(500, all, mine); } catch {}
          }
          if (wrote) { if (cut) note({ cut: 1 }); return; }
          if (thought || cut) skipRetries = rt; // worth another try with less thinking
          lastError = thought || cut ? "Max's AI ran out of room before it could answer. Ask for something smaller, one step at a time." : "Max's AI sent back an empty answer. Try again, or ask for something smaller.";
          console.error("empty answer from", model);
        }
        note({ error: lastError || "Max's AI didn't answer. Try again in a moment." });
      } catch (e) {
        if (!stop.signal.aborted) { console.error("stream error", e); note({ error: wrote ? "Max got cut off. Ask him to continue." : "Max's server had a problem. Try again." }); }
      } finally { clearInterval(ping); try { out.close(); } catch {} }
    },
    cancel() { stop.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
