# Chrome Web Store Listing: Dual-Memory Optimizer

## Listing Metadata
- **Name:** Dual-Memory Optimizer
- **Summary:** Slashes AI prompt context & token consumption by 70-85% with 1-click code condensing and side panel context memory.
- **Category:** Productivity / Developer Tools
- **Version:** 2.0.0
- **Last Updated:** 2026-11-08

## Detailed Description
Dual-Memory Optimizer is an AI prompt engineering and context compression extension built for modern developers. It reduces prompt token consumption by 70% to 85% across ChatGPT, Claude, Gemini, and GitHub by tree-shaking pasted code and maintaining persistent project directives in an interactive side panel.

### ⚡ Key Capabilities

1. 1-Click Code Condenser (In-Page Assistant):
When pasting large codebases, JSON payloads, or stack traces into ChatGPT, Claude, or Gemini, a floating assistant collapses function bodies into typed signatures (`def process(...) -> dict: ...`), strips comments, and removes docstring bloat.

2. Dual-Memory Side Panel HUD:
- Working Memory (Prompt Studio): Draft, test, and re-tokenize code with live token counters and cost estimators before submitting.
- Persistent Memory (Project Directives): Maintain system rules, coding standards, and architectural constraints in `chrome.storage.local` to inject into any AI prompt with 1 click.

3. In-Browser GitHub Codebase Mapper:
Inspect GitHub repository pages directly in Chrome to generate compact, structured file trees and symbol maps without cloning the repository.

4. 100% Client-Side & Private:
All AST extraction, comment stripping, and token metrics execute locally in your browser memory. Zero external servers, zero telemetry, zero data collection.

## Permissions Justification
- `storage`: Required to save user preferences, persistent project directives, and token savings metrics locally on the device.
- `sidePanel`: Required to display the prompt studio, live token counter, and persistent directives HUD in Chrome's side panel.
- `activeTab`: Required to inspect the current active chat input and inject condensed code when the user clicks the "Condense" button.
- `host_permissions` (`https://chatgpt.com/*`, `https://claude.ai/*`, `https://gemini.google.com/*`, `https://github.com/*`): Required to inject the floating code-condensing assistant into supported web AI chat interfaces and GitHub repositories.

## Privacy & Data Use
- **Zero Data Collection:** Does not collect, transmit, store on remote servers, or monetize any user data, prompt contents, or browsing history.
- **Local-Only Processing:** All token condensation algorithms run strictly on the user's machine.
- Full source code available on GitHub: https://github.com/jesusdelira7-956/dual-memory-optimizer

## ☕ Support Open-Source Development
If Dual-Memory Optimizer helps streamline your AI development workflows, slashes your token costs, or keeps your browser responsive, consider fueling further updates with a coffee:
https://buymeacoffee.com/JesseInTheLab
