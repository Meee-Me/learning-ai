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

const VOICE = "\nThis turn is a SPOKEN conversation: your reply will be read aloud. Answer in 1 to 3 short, natural sentences. No Markdown, no lists, no emoji, no code blocks. Say math in words.";

// The free service lists its models; pick the strongest ones it offers without an account.
const WANT_HARD = ["openai-large", "qwen-coder", "deepseek", "mistral", "openai"];
const WANT_EASY = ["openai-fast", "openai"];
let modelCache = { at: 0, names: null };
async function freeModels(hard) {
  const want = hard ? WANT_HARD : WANT_EASY;
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const mode = MODES[body.mode] ? body.mode : "teach";
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
    body: JSON.stringify({ model, stream: true, max_tokens: body.voice ? 300 : mode === "site" ? 12000 : mode === "code" ? 6000 : 1200, messages: [{ role: "system", content: system(subject, level, mode, site) + (body.voice ? VOICE : "") }, ...messages] }),
  }).catch((e) => ({ ok: false, status: 502, text: async () => String(e) }));
  // Which models to try, strongest first. Code and website edits get the strongest ones.
  const hard = mode === "code" || mode === "site";
  let tries = [MODEL];
  if (process.env.MAX_MODEL) tries = [MODEL];
  else if (GATEWAY) tries = hard ? ["anthropic/claude-sonnet-5.5", MODEL] : [MODEL];
  else if (FREE) tries = await freeModels(hard);
  let upstream, used = "";
  for (const model of tries) {
    upstream = await ask(model);
    used = model;
    if (upstream.ok && upstream.body) break;
  }

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

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no", "X-Max-Model": used.replace(/[^\w./@-]/g, "") });
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
