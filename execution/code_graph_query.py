#!/usr/bin/env python3
"""
CLI Symbol Lookup Tool - AntiGravity AST Code-Graph Engine
Queries symbols, functions, classes, interfaces, and dependencies from .tmp/code_graph.json
without requiring raw directory scans or full-file reads.
"""

import os
import sys
import json
import argparse
from pathlib import Path

GRAPH_PATH = Path(".tmp/code_graph.json")

def load_graph():
    if not GRAPH_PATH.exists():
        print(f"[!] Error: Code graph file '{GRAPH_PATH}' not found. Run token_optimizer.py first.")
        sys.exit(1)
    with open(GRAPH_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def query_symbol(graph, query_name):
    symbols_index = graph.get("symbols_index", {})
    matches = {}
    
    query_lower = query_name.lower()
    for sym_name, occurrences in symbols_index.items():
        if query_lower in sym_name.lower():
            matches[sym_name] = occurrences
            
    return matches

def query_file(graph, file_path_sub):
    files = graph.get("files", {})
    matches = {}
    
    for fpath, meta in files.items():
        if file_path_sub.lower() in fpath.lower():
            matches[fpath] = meta
            
    return matches

def main():
    parser = argparse.ArgumentParser(description="AST Code-Graph Query Tool for AntiGravity Workspace")
    parser.add_argument("--symbol", "-s", help="Query symbol by name (function, class, interface)")
    parser.add_argument("--file", "-f", help="Query symbols and imports within a specific file path")
    parser.add_argument("--json", "-j", action="store_true", help="Output raw JSON format")
    
    args = parser.parse_args()

    if not args.symbol and not args.file:
        parser.print_help()
        sys.exit(1)

    graph = load_graph()

    if args.symbol:
        results = query_symbol(graph, args.symbol)
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            print(f"=== SYMBOL SEARCH RESULTS FOR: '{args.symbol}' ===")
            if not results:
                print("No matching symbols found.")
            for sym, occs in results.items():
                print(f"\nSymbol: {sym}")
                for occ in occs:
                    print(f"  └─ [{occ['kind'].upper()}] File: {occ['file']} (Line {occ['line']})")

    elif args.file:
        results = query_file(graph, args.file)
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            print(f"=== FILE SYMBOL SEARCH RESULTS FOR: '{args.file}' ===")
            if not results:
                print("No matching files found.")
            for fpath, meta in results.items():
                print(f"\nFile: {fpath} ({meta.get('extension', '')})")
                print("  Imports:")
                for imp in meta.get("imports", []):
                    print(f"    - {imp}")
                print("  Symbols:")
                for sym in meta.get("symbols", []):
                    print(f"    - [{sym['kind'].upper()}] {sym['name']} (Line {sym['line']})")

if __name__ == "__main__":
    main()
