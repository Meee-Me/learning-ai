# Max — AI tutor

Max is a friendly AI tutor. Pick a subject and level, then choose how he helps:

- **Teach me**: explains one small step at a time, then checks you understood.
- **Quiz me**: asks one question at a time and keeps score.
- **Hints only**: never gives the final answer; nudges you to solve it yourself.

## Features

- Chat layout with a sidebar of past lessons, new lesson, copy and try-again buttons.
- **Attach files** with the paperclip, drag and drop, or paste: PDF, Word (.docx), text, Markdown, CSV,
  code files, and pictures of text (read with OCR).
- **Sign in with Deluxe Main** to keep lessons and settings in your Deluxe account on every device.

## Brains

| Option | Where it runs | Notes |
|---|---|---|
| **Cloud** (default) | Vercel AI Gateway, Claude Haiku 5.5 | No download, works on any phone. Reads up to 60,000 characters per file. |
| Tiny / Fast / Smarter / Smartest | Your device, with [WebLLM](https://github.com/mlc-ai/web-llm) | Free and offline after a 0.3–2.3 GB download. Needs WebGPU; often too heavy for phones. |

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
