# Max — AI tutor

Max is a friendly AI tutor. Pick a subject and level, then choose how he helps:

- **Teach me**: explains one small step at a time, then checks you understood.
- **Quiz me**: asks one question at a time and keeps score.
- **Hints only**: never gives the final answer; nudges you to solve it yourself.

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
package.json   @vercel/oidc (lets the function use AI Gateway without an API key)
```

## Deploy on Vercel

Import the repo with no build settings. The cloud brain signs in to AI Gateway with the project's
own OIDC token, and usage comes out of the Vercel team's AI Gateway credit (Vercel gives free
monthly credit; see the AI Gateway tab). Optional variables: `AI_GATEWAY_API_KEY` (use a key instead),
`MAX_MODEL` (another AI Gateway model id).
