# Max — AI tutor

Max is a friendly AI tutor that runs **entirely in your browser**: no API key, no server, no cost.
He uses a free open-source AI model ([WebLLM](https://github.com/mlc-ai/web-llm)) that downloads once
and then runs on your device's graphics chip. Your chats never leave your device.

Pick a subject and level, then choose how he helps:

- **Teach me**: explains one small step at a time, then checks you understood.
- **Quiz me**: asks one question at a time and keeps score.
- **Hints only**: never gives the final answer; nudges you to solve it yourself.

## Features

- Chat layout with a sidebar of past lessons (saved in your browser), new lesson, copy and try-again buttons.
- **Attach files** with the paperclip, drag and drop, or paste: PDF, Word (.docx), text, Markdown, CSV,
  code files, and pictures of text (read with OCR). Max reads the first ~7,000 characters of each file.

## Brains

| Option | Model | Download |
|---|---|---|
| Tiny (default on phones) | Qwen 2.5 0.5B | about 0.3 GB |
| Fast | Llama 3.2 1B | about 0.9 GB |
| Smarter (default) | Qwen 2.5 1.5B | about 1.6 GB |
| Smartest (computers) | Llama 3.2 3B | about 2.3 GB |

The first message downloads the brain (it is cached after that). These small models are much less
capable than big online AIs, so they can get facts or math wrong.

## Needs

A browser with WebGPU: recent Chrome or Edge on a computer or Android, or Safari on iOS/macOS 26+.

## Deploy

It's one file, `index.html`. On Vercel, import the repo with no build settings.
