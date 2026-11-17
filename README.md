# Max — AI tutor

Max is a friendly AI tutor. Pick a level, then pick how hard he thinks with the buttons on the welcome screen or by tapping the
mode name in the message box: **Haiku** (fastest), **Sonnet** (balanced), **Opus** (stronger), **Ultra** (smartest, slowest)
and **Code** (writes code, and edits the connected website). Ask for a style in plain words: "teach
me", "quiz me" or "hints only".

## Features

- Chat layout with a sidebar of past lessons, new lesson, copy and try-again buttons.
- **Attach files** with the paperclip, drag and drop, or paste: PDF, Word (.docx), text, Markdown, CSV,
  code files, and pictures of text (read with OCR).
- **Voice chat**: tap the waveform button to talk with Max out loud. Uses the browser's own speech
  recognition and voice, so it needs Safari on iPhone, or Chrome on a computer or Android.
- **Sign in with Deluxe Main** to keep lessons and settings in your Deluxe account on every device.

## How it works

Max's brain is a small server on Vercel: `api/chat.js`. It sends the conversation to an AI and
streams the answer back. Nothing to download; works on any phone or computer.

### Default: free AI, no setup

With nothing configured, Max asks [Pollinations](https://pollinations.ai), a free public AI service.
No key, no card. It is run by someone else, so it can be slow or busy at times, and the messages
(and attached file text) are sent to it. Don't share private things with Max.

### Stronger brains: Max's built-in router

Max's server is a small AI router, like OmniRoute but built in, so there is no extra server to run.
Open **settings → Max's brain** and connect any of these; Max tries them first, strongest model first,
and falls back to the next (and finally the free AI) when one is busy or out of free use:

- **Google Gemini**, **OpenRouter**, **Groq**, **Mistral**: paste a free key (each row links to where to get it).
- **GitHub Models**: uses the GitHub account connected under Connect a website.
- **Your own router**: an OmniRoute or other OpenAI-compatible server with a public https address.

Max also sizes the model to the job, like Haiku / Sonnet / Opus: small fast models answer voice and
short chat, mid models teach and quiz, and the biggest models answer code and website edits, with
reasoning models (gpt-oss) told to think harder for those. Groq's free limits are per model, so on
Groq he keeps up to five models in line and moves down the list when one is busy.

Each row has a **Test** button. Max picks the strongest model each provider offers; a model name can
be typed to override. Keys are kept in that browser only.

**For everyone, set up once (recommended):** the owner adds a key in Vercel → learning-ai → Settings →
Environment Variables, then Redeploy. Name it `ANTHROPIC_API_KEY` (Claude; Max uses Sonnet 5.5 for code and website edits and Haiku 5.5 for chat), `AIMLAPI_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`,
`GROQ_API_KEY` or `MISTRAL_API_KEY`. Max then uses that provider for everybody, with no setup on their
side. Optional `AIMLAPI_MODEL` (and so on) picks one model. Everybody's questions are paid by that key,
so set a spending limit on the provider's account.

To set one provider for everyone who uses this copy of Max, use Vercel's Environment Variables:
`MAX_AI_URL` (address ending in `/v1`), `MAX_AI_KEY`, and `MAX_MODEL` (one or more, comma-separated).

### Optional: Cloudflare Workers AI (free, more reliable)

Add `CF_ACCOUNT_ID` and `CF_API_TOKEN` (a token from the Workers AI template) in Vercel's
Environment Variables and redeploy. Max then uses Llama 3.3 70B on Cloudflare's free daily allowance.

### Optional: Claude through Vercel AI Gateway

Set `MAX_BRAIN=gateway` in Vercel. Max then uses Claude Haiku 5.5. Vercel needs a credit card on
the team to unlock its free AI credit.

## Files

```
index.html     the whole app
api/chat.js    Vercel function: the cloud brain
api/github.js  Vercel function: Connect GitHub sign-in
```

## Deploy on Vercel

Import the repo with no build settings. The cloud brain signs in to AI Gateway with the project's
own OIDC token, and usage comes out of the Vercel team's AI Gateway credit (Vercel gives free
monthly credit; see the AI Gateway tab). Optional variables: `AI_GATEWAY_API_KEY` (use a key instead),
`MAX_MODEL` (another AI Gateway model id).
