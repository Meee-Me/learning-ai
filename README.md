# Max — AI tutor

Max is a friendly AI tutor that runs **entirely in your browser**: no API key, no server, no cost.
He uses a free open-source AI model ([WebLLM](https://github.com/mlc-ai/web-llm)) that downloads once
and then runs on your device's graphics chip. Your chats never leave your device.

Pick a subject and level, then choose how he helps:

- **Teach me**: explains one small step at a time, then checks you understood.
- **Quiz me**: asks one question at a time and keeps score.
- **Hints only**: never gives the final answer; nudges you to solve it yourself.

## Brains

| Option | Model | Download |
|---|---|---|
| Fast | Llama 3.2 1B | about 0.9 GB |
| Smarter (default) | Qwen 2.5 1.5B | about 1.6 GB |

The first message downloads the brain (it is cached after that). These small models are much less
capable than big online AIs, so they can get facts or math wrong.

## Needs

A browser with WebGPU: recent Chrome or Edge on a computer or Android, or Safari on iOS/macOS 26+.

## Deploy

It's one file, `index.html`. On Vercel, import the repo with no build settings.
