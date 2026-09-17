import os
import argparse
import json
import sys
import ast
import re
from pathlib import Path

IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'env', '.idea', '.vscode', 'target', '.next', '__tests__', 'dist', 'build', '.tmp'}
IGNORE_EXTS = {'.pyc', '.pyo', '.pyd', '.so', '.dll', '.exe', '.bin', '.rlib', '.rmeta'}

def parse_python_ast(file_path: Path):
    """Parses Python file using standard ast module to extract classes, functions, imports."""
    symbols = []
    imports = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        tree = ast.parse(content, filename=str(file_path))
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                symbols.append({
                    "name": node.name,
                    "kind": "class",
                    "line": node.lineno,
                    "methods": [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
                })
            elif isinstance(node, ast.FunctionDef):
                # Avoid duplicating methods listed inside classes
                symbols.append({
                    "name": node.name,
                    "kind": "function",
                    "line": node.lineno,
                    "args": [a.arg for a in node.args.args]
                })
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for alias in node.names:
                    imports.append(f"{module}.{alias.name}" if module else alias.name)
    except Exception:
        pass
    return symbols, imports

def parse_typescript_regex(file_path: Path):
    """Extracts TS/JS interfaces, types, classes, functions, imports/exports using regex."""
    symbols = []
    imports = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()

        class_pattern = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_$]+)')
        func_pattern = re.compile(r'^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)')
        const_func_pattern = re.compile(r'^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(')
        interface_pattern = re.compile(r'^\s*(?:export\s+)?interface\s+([A-Za-z0-9_$]+)')
        type_pattern = re.compile(r'^\s*(?:export\s+)?type\s+([A-Za-z0-9_$]+)')
        import_pattern = re.compile(r'^\s*import\s+.*?from\s+[\'"](.*?)[\'"]')

        for idx, line in enumerate(lines, start=1):
            m_class = class_pattern.search(line)
            if m_class:
                symbols.append({"name": m_class.group(1), "kind": "class", "line": idx})
                continue
            m_func = func_pattern.search(line) or const_func_pattern.search(line)
            if m_func:
                symbols.append({"name": m_func.group(1), "kind": "function", "line": idx})
                continue
            m_iface = interface_pattern.search(line)
            if m_iface:
                symbols.append({"name": m_iface.group(1), "kind": "interface", "line": idx})
                continue
            m_type = type_pattern.search(line)
            if m_type:
                symbols.append({"name": m_type.group(1), "kind": "type", "line": idx})
                continue
            m_imp = import_pattern.search(line)
            if m_imp:
                imports.append(m_imp.group(1))
    except Exception:
        pass
    return symbols, imports

def generate_tree(dir_path, prefix=""):
    """Recursively generates a visual tree structure of the directory."""
    tree_str = ""
    try:
        entries = sorted(os.listdir(dir_path))
    except PermissionError:
        return ""
    
    entries = [e for e in entries if e not in IGNORE_DIRS]
    
    for i, entry in enumerate(entries):
        path = os.path.join(dir_path, entry)
        is_last = (i == len(entries) - 1)
        connector = "└── " if is_last else "├── "
        
        if os.path.isdir(path):
            tree_str += f"{prefix}{connector}{entry}/\n"
            extension = "    " if is_last else "│   "
            tree_str += generate_tree(path, prefix=prefix + extension)
        else:
            ext = os.path.splitext(entry)[1].lower()
            if ext not in IGNORE_EXTS:
                tree_str += f"{prefix}{connector}{entry}\n"
                
    return tree_str

def build_code_graph(target_dir):
    """Builds a comprehensive AST and symbol graph for Python and TypeScript files."""
    code_graph = {"files": {}, "symbols_index": {}}
    target_path = Path(target_dir)

    for root, dirs, files in os.walk(target_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            file_path = Path(root) / file
            if file_path.suffix.lower() in IGNORE_EXTS:
                continue

            rel_path = str(file_path.relative_to(target_path))
            ext = file_path.suffix.lower()

            symbols = []
            imports = []

            if ext == ".py":
                symbols, imports = parse_python_ast(file_path)
            elif ext in {".ts", ".tsx", ".js", ".jsx"}:
                symbols, imports = parse_typescript_regex(file_path)

            code_graph["files"][rel_path] = {
                "extension": ext,
                "symbols": symbols,
                "imports": imports
            }

            for sym in symbols:
                sym_name = sym["name"]
                if sym_name not in code_graph["symbols_index"]:
                    code_graph["symbols_index"][sym_name] = []
                code_graph["symbols_index"][sym_name].append({
                    "file": rel_path,
                    "kind": sym["kind"],
                    "line": sym["line"]
                })

    return code_graph

def main():
    parser = argparse.ArgumentParser(description="Token Optimizer: AST Code-Graph Generator for Python & TypeScript.")
    parser.add_argument("--target", required=True, help="Target directory to map")
    args = parser.parse_args()

    target_dir = args.target
    if not os.path.exists(target_dir):
        print(f"[!] Error: Target directory '{target_dir}' does not exist.")
        sys.exit(1)

    print(f"[*] Starting Token Optimization & AST Mapping for {target_dir}...")

    tree_map = f"{os.path.basename(os.path.abspath(target_dir))}/\n"
    tree_map += generate_tree(target_dir)

    graph_data = build_code_graph(target_dir)

    output_dir = Path(".tmp")
    output_dir.mkdir(exist_ok=True)

    txt_path = output_dir / "codebase_map.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=== CODEBASE TREE ===\n")
        f.write(tree_map)
        f.write("\n=== SUMMARY ===\n")
        f.write(f"Total mapped files: {len(graph_data['files'])}\n")
        f.write(f"Total indexed symbols: {len(graph_data['symbols_index'])}\n")

    json_path = output_dir / "codebase_index.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"files": list(graph_data["files"].keys())}, f, indent=4)

    graph_path = output_dir / "code_graph.json"
    with open(graph_path, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, indent=2)

    print(f"[+] Token & AST Code-Graph mapping complete.")
    print(f"    -> Codebase Map: {txt_path}")
    print(f"    -> Code Graph:   {graph_path}")
    sys.exit(0)

if __name__ == "__main__":
    main()
