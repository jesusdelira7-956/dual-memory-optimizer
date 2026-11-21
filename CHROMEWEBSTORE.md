# Chrome Web Store Listing: Dual-Memory Optimizer

## Listing Metadata
- **Name:** Dual-Memory Optimizer
- **Summary:** Slashes AI prompt context & token consumption by 70-85% with 1-click code condensing and side panel context memory.
- **Category:** Productivity / Developer Tools
- **Version:** 2.1.0
- **Last Updated:** 2026-11-21

## Detailed Description
Dual-Memory Optimizer is an AI prompt engineering, secret scrubbing, and context compression extension built for modern developers. It reduces prompt token consumption by 70% to 85% across ChatGPT, Claude, Gemini, and GitHub (plus opt-in Perplexity, Google AI Studio, DeepSeek, Grok, and local Open WebUI) while keeping credentials out of cloud chats.

### ⚡ Key Capabilities

1. Mixed-Prompt Fenced Code & Multi-Language Condenser (In-Page Assistant):
When pasting codebases, JSON payloads, or stack traces into ChatGPT, Claude, or Gemini, a floating assistant condenses fenced code blocks across Python, JavaScript/TypeScript, Go, Rust, C/C++, Java, SQL, and JSON schemas while preserving your surrounding question. Includes 1-click Undo.

2. Client-Side Secret & PII Redactor:
Automatically warns when AWS keys, OpenAI/Anthropic tokens, GitHub PATs, JWTs, `.env` secrets, or private keys appear in a prompt and scrubs them into reversible `[REDACTED_*]` placeholders before hitting Send.

3. Dual-Memory Side Panel HUD & Chrome Built-in AI:
- Working Memory (Prompt Studio): Draft, scrub secrets, summarize docs locally via Chrome Built-in Gemini Nano when supported, and track live token savings.
- Persistent Memory (Project Directives): Maintain parameterized rules (`{{lang}}`, `{{date}}`, `{{selection}}`) and 1-click templates (Code Review, Debug Mode, Architecture Audit) in `chrome.storage.local`.

4. In-Browser GitHub Codebase Mapper & Safe RAM Optimizer:
Inspect GitHub repository pages directly in Chrome to generate compact file trees & symbol maps, and suspend idle background tabs safely while skipping pinned tabs and active AI chats.

## Permissions Justification
- `storage`: Required to save user preferences, persistent project directives, and token savings metrics locally on the device.
- `sidePanel`: Required to display the prompt studio, secret scrubber, live token counter, and persistent directives HUD in Chrome's side panel.
- `tabs`: Required to inspect tab URLs when safely skipping protected AI chat origins during 1-click browser RAM optimization and scoping GitHub repository scans.
- `scripting`: Required solely for `chrome.scripting.registerContentScripts` when the user explicitly opts into additional AI chat surfaces via `optional_host_permissions`.
- `content_scripts` (`https://chatgpt.com/*`, `https://claude.ai/*`, `https://gemini.google.com/*`, `https://github.com/*`): Core surfaces declared statically; Perplexity, AI Studio, DeepSeek, Grok, and Open WebUI are requested only on user opt-in.

## Privacy & Data Use
- **Zero Data Collection:** Does not collect, transmit, store on remote servers, or monetize any user data, prompt contents, or browsing history.
- **Local-Only Processing:** All token condensation algorithms run strictly on the user's machine.
- Full source code available on GitHub: https://github.com/jesusdelira7-956/dual-memory-optimizer

## ☕ Support Open-Source Development
If Dual-Memory Optimizer helps streamline your AI development workflows, slashes your token costs, or keeps your browser responsive, consider fueling further updates with a coffee:
https://buymeacoffee.com/JesseInTheLab
