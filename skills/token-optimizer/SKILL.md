---
name: token-optimizer
description: Enforces aggressive context-management strategies, relying on persistent local codebase maps and targeted tooling to reduce token usage by over 50%.
---

# Token Optimizer Skill

When navigating a repository, reading files, or searching for logic, you must adopt strict "Token Optimizer" strategies. Your goal is to drastically minimize the number of input tokens consumed by avoiding redundant reads and exploratory wandering.

## Activation Triggers
- You are entering a new, large codebase or directory.
- You are searching for where a specific function or variable is defined.
- You are performing multi-file refactoring or deep debugging.

## Operating Principles
1. **Consult the Map First:** Never run exploratory `list_dir` commands repeatedly. Check if a `CODEBASE_MAP.md` exists. If not, generate one and use it as your single source of navigation truth.
2. **Follow the Directive:** Adhere to the surgical techniques outlined in `directives/token_optimizer.md` (e.g., targeted line reads, `grep` over LLM search).
3. **No Full File Dumps:** Never read a full 800-line file just to see a single function. Use `grep_search` to find the exact line numbers first, then use `StartLine` and `EndLine` parameters in `view_file`.
4. **Context Compaction:** Before executing a heavy code-generation step, drop unnecessary historical context and rely on concise summaries.
5. **Anti-Goal:** Do NOT guess file contents to avoid reading them. A 100-token read is cheaper than a wrong answer causing a 5000-token debug cycle.
6. **Navigation Pattern:** `grep_search` → targeted `view_file` (StartLine/EndLine) → act. Never: `list_dir` → `view_file` (full) → repeat.


## Description
Standardized agent skill definition adhering to the Antigravity OKF format.

## When to Use
Trigger this skill when executing relevant workflows or instructions matching the frontmatter description.

## Input/Output
- **Input:** Task parameters or user intent matching skill trigger.
- **Output:** Structured workflow execution or tool response.

## Decision Rules
Follow established directives and local constraints before taking action.

## Constraints
Adhere to zero destruction, anti-leak protocols, and workspace safety rules.
