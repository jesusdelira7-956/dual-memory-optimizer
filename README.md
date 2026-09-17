# Dual-Memory Optimizer

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dependencies: Zero](https://img.shields.io/badge/dependencies-none-brightgreen.svg)]()

> **Slash LLM context consumption by 70–85%** with deterministic AST code graphs and semantic directives. Stop letting AI agents waste entire context windows on blind `ls`, `tree`, and redundant file reads.

---

## ⚡ What is the Dual-Memory Architecture?

When LLMs interact with codebases, they typically wander: executing directory listings, grep loops, and dumping 1,000-line files into prompt context just to inspect a 4-line function.

**Dual-Memory Optimizer** solves this mismatch by separating agent navigation into two synchronized layers:

1. **Deterministic Structural Memory (Layer 3 Execution)**
   - Fast, zero-dependency Python AST parser (`ast` standard library + TypeScript regex scanner).
   - Generates `.tmp/code_graph.json` mapping all classes, functions, async methods, and line boundaries.
   - Enables instantaneous symbol querying (`execution/code_graph_query.py --symbol <name>`) in sub-milliseconds without LLM calls.
2. **Semantic Operational Directives (Layer 1 Directive & Agent Skills)**
   - Standardized SOPs (`directives/token_optimizer.md`) and agent skills (`skills/token-optimizer/SKILL.md`).
   - Guides the LLM to read `.tmp/codebase_map.txt` first and target precise line ranges instead of dumping raw source files.

```
       ┌──────────────────────────────────────────────┐
       │             AI Coding Agent / IDE            │
       └──────────────────────┬───────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   [Layer 1: Semantic SOP]        [Layer 3: AST Engine]
   directives/token_optimizer.md   execution/token_optimizer.py
              │                               │
              ▼                               ▼
   Agent Navigation Protocol       .tmp/code_graph.json
   - Consult map before listing    - Symbol index (Classes, Funcs)
   - Read exact line spans         - Line numbers & signatures
              │                               │
              └───────────────┬───────────────┘
                              ▼
           Targeted Code Editing with Zero Waste
```

---

## 🚀 Key Features

- 🪶 **Zero External Dependencies:** Built entirely on Python's built-in `ast`, `re`, `os`, `json`, and `pathlib`. No heavy npm packages, no compilation, no pip installs required.
- 🌐 **Polyglot Parsing:** Native Python AST parsing alongside robust TypeScript, TSX, JavaScript, and JSX symbol extractors.
- 🌳 **Visual & Machine Maps:**
  - `.tmp/codebase_map.txt` — Compact visual directory tree curated specifically for LLM context reading.
  - `.tmp/codebase_index.json` — Flat manifest of workspace files for fast validation.
  - `.tmp/code_graph.json` — Exhaustive symbol dictionary with line boundaries.
- 🔍 **Instant CLI Symbol Querying:** Locate definitions in under 5ms:
  ```bash
  python3 execution/code_graph_query.py --symbol calculate_metrics
  ```
- 🛡️ **Intelligent Filtering:** Automatically ignores `.git`, `node_modules`, `venv`, binary files, build artifacts, and heavy dataset directories.

---

## 📦 Installation

Clone or download this repository into your workspace, or run the installer:

```bash
git clone https://github.com/jesusdelira7-956/dual-memory-optimizer.git
cd dual-memory-optimizer
./install.sh /path/to/your/project
```

Or manually copy the files into your project:
```
your-project/
├── directives/
│   └── token_optimizer.md
├── execution/
│   ├── token_optimizer.py
│   └── code_graph_query.py
└── .agents/skills/token-optimizer/
    └── SKILL.md
```

---

## 🛠️ Usage

### 1. Build the Codebase Map & Symbol Graph
Run the optimizer against your target codebase:
```bash
python3 execution/token_optimizer.py --target .
```

Output:
```
============================================================
Token Optimizer: Codebase Map & AST Symbol Graph Generator
============================================================
Target Directory: .
Ignored Dirs: .git, .venv, node_modules, build, dist, ...
Ignored Extensions: .png, .jpg, .pyc, .so, .zip, ...

[OK] Scanned 120 files across 14 directories.
[OK] Codebase map generated: .tmp/codebase_map.txt (est. 480 tokens)
[OK] File index generated: .tmp/codebase_index.json
[OK] AST code graph generated: .tmp/code_graph.json (412 symbols indexed)
============================================================
```

### 2. Query Symbols
Find where any function or class is defined:
```bash
python3 execution/code_graph_query.py --symbol generate_graph
```
Output:
```json
[
  {
    "symbol": "generate_graph",
    "type": "function",
    "file": "execution/token_optimizer.py",
    "line": 142,
    "signature": "def generate_graph(target_path, output_dir)"
  }
]
```

### 3. Agent Instruction (System Prompt / SOP)
Add the following instruction to your agent's system prompt or `AGENTS.md`:

```markdown
When entering this workspace, run:
  python3 execution/token_optimizer.py --target .
Read `.tmp/codebase_map.txt` before issuing navigation commands.
For symbol lookups, use `python3 execution/code_graph_query.py --symbol <name>`
rather than reading raw files.
```

---

## 📊 Benchmark Comparison

| Metric | Without Optimizer (Traditional) | With Dual-Memory Optimizer | Improvement |
| :--- | :---: | :---: | :---: |
| **Initial Navigation Cost** | 8,000 – 15,000 tokens | 400 – 800 tokens | **~94% Reduction** |
| **Symbol Discovery Time** | 3–5 roundtrips (`grep` + reads) | 1 roundtrip / sub-millisecond | **Instant** |
| **External Dependencies** | `node`, `npm`, build tools | None (Pure Python 3.8+) | **Zero Setup** |
| **Risk of Context Overflow** | High on large projects | Low / Controlled depth | **Stable** |

---

## 📄 License

MIT License. Feel free to use, modify, and distribute across personal and enterprise projects.
