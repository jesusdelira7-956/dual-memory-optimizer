# Privacy Policy for Dual-Memory Optimizer

**Effective Date:** November 8, 2026  
**Last Updated:** November 8, 2026

Dual-Memory Optimizer ("the Extension") is an open-source browser extension designed to optimize code prompts and reduce token consumption for developers using generative AI interfaces.

### 1. Zero Data Collection
The Extension **does not collect, transmit, store on external servers, or sell** any personal data, prompt text, code snippets, keystrokes, IP addresses, or device identifiers.

### 2. Local-Only Processing
All text analysis, comment stripping, signature extraction, AST parsing, and token estimation operations occur **strictly and exclusively inside your local device's browser memory**. No prompt text or code is ever sent to any third-party server, analytics engine, or external API.

### 3. Local Storage Use
The Extension uses Chrome's `chrome.storage.local` API exclusively on your device to persist:
- User preferences (e.g. floating button enabled state, default condensation mode).
- Custom persistent directives and system prompt templates defined by the user.
- Cumulative aggregate token savings metrics (e.g. total tokens saved count).

This data is stored locally on your machine and is never transmitted off your device.

### 4. Permissions & Usage
- `storage`: Used solely to persist your custom directives and token metrics locally.
- `sidePanel`: Used to display your prompt drafting workspace and directives manager in Chrome's side panel.
- `activeTab`: Used temporarily when you click "Inject into Active Chat" or "Condense Code" to interact with the current chat window.
- Host Permissions (`chatgpt.com`, `claude.ai`, `gemini.google.com`, `github.com`): Scoped strictly to supported AI and developer platforms to show the floating token optimization assistant.

### 5. Third-Party Services
The Extension does not use third-party analytics, remote tracking scripts, external CDNs, or telemetry servers.

### 6. Contact & Source Code
Dual-Memory Optimizer is open source. You can inspect the source code, audit the privacy guarantees, or report issues directly on GitHub:  
https://github.com/jesusdelira7-956/dual-memory-optimizer
