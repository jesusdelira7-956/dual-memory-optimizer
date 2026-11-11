# ⚡ Dual-Memory Optimizer (v2.0)

[![Manifest: V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-success.svg?style=for-the-badge)](extension/manifest.json)
[![Download Latest ZIP](https://img.shields.io/badge/⬇️_Download_Chrome_ZIP-v2.0.1-6366f1?style=for-the-badge)](https://github.com/jesusdelira7-956/dual-memory-optimizer/releases/latest/download/Dual-Memory-Optimizer-v2.0.1.zip)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/JesseInTheLab)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8+-blue.svg?style=for-the-badge)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> **Slash AI prompt context & token consumption by 70–85%** with 1-click AST code tree-shaking and persistent directives. Built for developers using **ChatGPT, Claude, Gemini, DeepSeek, and local coding agents**.

---

## 🌐 The Manifest V3 Chrome Extension

Stop burning 10,000 tokens every time you paste code into ChatGPT or Claude. **Dual-Memory Optimizer** brings deterministic context compression directly into your web browser.

```text
       [ 500-Line Codebase / Stack Trace ]
                       │
                       ▼
    ╔════════════════════════════════════════╗
    ║      DUAL-MEMORY OPTIMIZER (MV3)       ║
    ║  • 1-Click "Condense Code" (-75%)      ║
    ║  • In-Browser AST Signature Extractor  ║
    ║  • Working Memory Prompt Studio HUD    ║
    ║  • Persistent Project Directives       ║
    ║  • In-Page GitHub Codebase Mapper      ║
    ╚════════════════════════════════════════╝
                       │
                       ▼
       [ 80-Line Typed Interface Signatures ]
            (70–85% Context Headroom Saved)
```

### ⚡ Chrome Extension Features:
1. **Floating In-Page Assistant:** Automatically detects code pasted into **ChatGPT, Claude, Gemini, and Copilot**. Shows a 1-click `⚡ Condense Code (-75%)` button that replaces verbose implementations with compact typed interfaces in-place.
2. **Dual-Memory Side Panel HUD:**
   - **Working Memory (Prompt Studio):** Real-time BPE token counter and cost calculator. Test and tree-shake code snippets before submitting.
   - **Persistent Memory (Project Directives):** Store system instructions, architectural constraints, and formatting rules locally on your device in `chrome.storage.local`. Inject them into any prompt with 1 click.
3. **In-Browser GitHub Mapper:** When viewing any GitHub repository, the side panel scans the DOM to produce an AI-ready structured codebase map without cloning.
4. **100% Client-Side & Sovereign:** Zero telemetry, zero external APIs, zero server dependency.

---

## 🚀 5-Second Automated Chrome Install

### Linux & macOS (1-Line Terminal Command)
```bash
curl -fsSL https://raw.githubusercontent.com/jesusdelira7-956/dual-memory-optimizer/main/install-extension.sh | bash
```

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/jesusdelira7-956/dual-memory-optimizer/main/install-extension.ps1 | iex
```

*Or manually:*
1. Download [`Dual-Memory-Optimizer-v2.0.1.zip`](https://github.com/jesusdelira7-956/dual-memory-optimizer/releases/latest/download/Dual-Memory-Optimizer-v2.0.1.zip).
2. Open `chrome://extensions/` and toggle **Developer mode** (top-right).
3. **Drag and drop the ZIP file** directly onto the extensions page!

---

## 💻 Python CLI & Local Coding Agent Engine

For local terminal agents (Claude Code, Aider, OpenCode, Antigravity), Dual-Memory Optimizer provides a zero-dependency AST engine:

### ⚡ Architecture
1. **Deterministic Structural Memory (Layer 3 Execution):**
   - Built-in Python `ast` parser generates `.tmp/code_graph.json` and `.tmp/codebase_map.txt`.
   - Sub-millisecond CLI queries for function and class definitions without LLM calls.
2. **Semantic Operational Directives (Layer 1 Directive & Agent Skills):**
   - Standardized SOPs (`directives/token_optimizer.md`) that guide AI agents to read the map first instead of running blind `ls` or dumping files.

### Local CLI Installation
```bash
git clone https://github.com/jesusdelira7-956/dual-memory-optimizer.git
cd dual-memory-optimizer
./install.sh /path/to/your/project
```

### Instant Symbol Querying
```bash
python3 execution/code_graph_query.py --symbol calculate_metrics
```

---

## 🛡️ Chrome Web Store Compliance & Privacy

- **Zero Remote Code:** Fully bundled local logic meeting Google Chrome Web Store Manifest V3 policies.
- **Narrowly Scoped Permissions:** Scoped strictly to `chatgpt.com`, `claude.ai`, `gemini.google.com`, and `github.com`.
- **Zero Data Collection:** Does not collect, track, transmit, or monetize any user data. See [PRIVACY.md](PRIVACY.md).

---

## ☕ Support Development

If Dual-Memory Optimizer helps streamline your AI development workflows, slashes your token costs, or keeps your browser responsive, consider fueling further updates with a coffee:

<a href="https://buymeacoffee.com/JesseInTheLab" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" style="border-radius: 8px;">
</a>

---

## 📄 License
MIT © 2026 Dual-Memory Contributors
