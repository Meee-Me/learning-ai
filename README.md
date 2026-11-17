# Max — AI tutor

Max is a friendly AI tutor. Pick a subject and level, then choose how he helps:

- **Teach me**: explains one small step at a time, then checks you understood.
- **Quiz me**: asks one question at a time and keeps score.
- **Hints only**: never gives the final answer; nudges you to solve it yourself.
- **Code**: writes complete, working code. Web pages and JavaScript get a **Run** button that runs
  them right in the page (in a sandbox); every code block has a Copy button.

## Edit a website

Max can change a website that lives in a GitHub repository; Vercel (or any host that deploys from
GitHub) then rebuilds it.

1. Tap **Connect a website** in the sidebar, then **Connect GitHub**: GitHub shows a short code,
   you approve, and you pick the repository from a list. No token to paste. (Pasting tokens still
   works under "Use access tokens instead".)
2. In **Edit website** mode, tell him what to change. Max sees the list of files, opens the ones he
   needs by himself (shown as "Max opened …"), then answers with the complete new files.
   **+ File** lets you hand him files up front.
3. **Run** previews web pages. **Publish** sends one file; **Publish all** sends every changed file
   as a single update. Both take two taps and warn when a file got much shorter.

How Max works on a site, step by step:

- **Search**: he can search every file for a word to find where something is.
- **Open**: he opens whole files, or just some lines of a big file, so file size is no longer a limit.
- **Edit**: for small changes he writes find-and-replace edits instead of rewriting the whole file.
- **Check**: before you see a change, it is applied to a copy and checked: every edit must match the
  real file, JavaScript and JSON must parse, and a rewritten file must not lose half its lines. If
  something is wrong Max is told and fixes it (up to two tries). Answers that pass show "✓ checked".

**Put it online:** in Edit website mode, the **Put it online** button above the message box turns on
GitHub Pages for the connected repository (free, no card). Max shows the site's address, and every
Publish updates it. It needs an `index.html` at the top of the repository, admin rights on it, and a
public repository (private ones need a paid GitHub plan for Pages).

After a publish Max follows the rebuild through GitHub (Vercel, Netlify and others report back
there), says when the change is live, and offers **Ask Max to fix it** if the build fails. Vercel or
Netlify tokens are only needed to read full build error logs.

### One-time setup for Connect GitHub (owner only)

GitHub only shows its Authorize screen for registered apps, so the owner of this copy of Max
registers him once. The first tap on **Connect GitHub** walks through it and asks for the app's
**Client ID** (public, not a secret). Right after connecting, the owner sees **Save for everyone**,
which writes `max.config.json` into Max's own repository. From then on nobody else does any setup:
they tap Connect GitHub, approve, and pick a repository.

The token stays in the browser and is only sent to GitHub. The picked files are sent to Max's AI.
Max reads up to 30,000 characters of files at a time, so big files can't be edited.

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
