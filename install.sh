#!/usr/bin/env bash
set -e

echo "=== Installing Dual-Memory Optimizer ==="

# Determine target directory (default: current directory)
TARGET_DIR="${1:-.}"

# Ensure directories exist
mkdir -p "$TARGET_DIR/execution"
mkdir -p "$TARGET_DIR/directives"
mkdir -p "$TARGET_DIR/.tmp"

# Copy execution scripts
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/execution/token_optimizer.py" "$TARGET_DIR/execution/"
cp "$SCRIPT_DIR/execution/code_graph_query.py" "$TARGET_DIR/execution/"

# Copy directive
cp "$SCRIPT_DIR/directives/token_optimizer.md" "$TARGET_DIR/directives/"

# Copy skill if an agent skill folder exists
if [ -d "$TARGET_DIR/.agents/skills" ]; then
    mkdir -p "$TARGET_DIR/.agents/skills/token-optimizer"
    cp "$SCRIPT_DIR/skills/token-optimizer/SKILL.md" "$TARGET_DIR/.agents/skills/token-optimizer/"
    echo "Installed skill to $TARGET_DIR/.agents/skills/token-optimizer/SKILL.md"
fi

echo "Running initial codebase indexing..."
python3 "$TARGET_DIR/execution/token_optimizer.py" --target "$TARGET_DIR"

echo "=== Dual-Memory Optimizer successfully installed! ==="
echo "Artifacts generated in $TARGET_DIR/.tmp/:"
echo "  - codebase_map.txt  (Visual hierarchy for LLM reading)"
echo "  - codebase_index.json (Flat file manifest)"
echo "  - code_graph.json   (AST symbols: functions, classes, methods)"
echo ""
echo "Query symbols instantly with:"
echo "  python3 execution/code_graph_query.py --symbol <name>"
