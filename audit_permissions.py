#!/usr/bin/env python3
"""
audit_permissions.py
====================
Least-privilege gate for Dual-Memory Optimizer Chrome Web Store submissions.

Statically verifies that every permission and host permission declared in
extension/manifest.json is backed by an actual API call in shipped JS sources.

Usage:
    python3 audit_permissions.py
    python3 audit_permissions.py --manifest-json '<json>'

Exit code 0 = compliant, 1 = violations found.
"""

import argparse
import json
import re
import sys
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent
EXT_DIR = REPO_DIR / "extension"
EXCLUDE_DIRS = {".git", ".github", "dist", "_metadata", "node_modules", "__pycache__", "tests"}

PERMISSION_USAGE = {
    "storage": [r"chrome\.storage\."],
    "sidePanel": [r"chrome\.sidePanel\."],
    "scripting": [r"chrome\.scripting\."],
    "tabs": [r"\btabs?\.(?:url|title|favIconUrl|pendingUrl)\b", r"tabs\.query\(\s*\{[^}]*\burl\s*:"],
    "activeTab": [r"chrome\.scripting\.", r"chrome\.tabs\.captureVisibleTab", r"chrome\.pageCapture\."],
    "contextMenus": [r"chrome\.contextMenus\."],
    "alarms": [r"chrome\.alarms\."],
    "notifications": [r"chrome\.notifications\."],
    "unlimitedStorage": [r"chrome\.storage\.local\."],
}

HOST_PERMISSION_USAGE = [
    r"chrome\.scripting\.executeScript",
    r"chrome\.cookies\.",
    r"chrome\.webRequest\.",
    r"chrome\.tabs\.captureVisibleTab",
    r"\bfetch\(\s*['\"`]https?://",
    r"new\s+XMLHttpRequest",
]


def load_js_sources():
    sources = {}
    for path in EXT_DIR.rglob("*.js"):
        if any(part in EXCLUDE_DIRS for part in path.relative_to(EXT_DIR).parts):
            continue
        sources[str(path.relative_to(EXT_DIR))] = path.read_text(encoding="utf-8")
    return sources


def strip_comments(js):
    js = re.sub(r"/\*.*?\*/", "", js, flags=re.S)
    return re.sub(r"(?m)^\s*//.*$", "", js)


def find_usage(patterns, sources):
    hits = []
    for name, code in sources.items():
        for pat in patterns:
            if re.search(pat, code):
                hits.append(name)
                break
    return hits


def audit(manifest):
    sources = {k: strip_comments(v) for k, v in load_js_sources().items()}
    violations, report = [], []

    for perm in manifest.get("permissions", []):
        patterns = PERMISSION_USAGE.get(perm)
        if patterns is None:
            violations.append(f"{perm}: no usage rule defined - add a mapping or remove the permission")
            continue
        hits = find_usage(patterns, sources)
        if hits:
            report.append(f"  [OK]   {perm:<32} used in {', '.join(sorted(set(hits)))}")
        else:
            violations.append(f"{perm}: declared but never used (Purple Potassium risk)")

    host_perms = manifest.get("host_permissions", [])
    if host_perms:
        hits = find_usage(HOST_PERMISSION_USAGE, sources)
        if hits:
            report.append(f"  [OK]   host_permissions {host_perms} used by {', '.join(sorted(set(hits)))}")
        else:
            violations.append(
                f"host_permissions {host_perms}: not required (content_scripts self-grant via `matches`)"
            )

    for opt in manifest.get("optional_permissions", []):
        report.append(f"  [INFO] optional permission {opt} (requested at runtime)")

    for opt_host in manifest.get("optional_host_permissions", []):
        report.append(f"  [INFO] optional host permission {opt_host} (requested at runtime)")

    return violations, report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest-json", help="audit an in-memory manifest JSON string")
    args = parser.parse_args()

    if args.manifest_json:
        manifest = json.loads(args.manifest_json)
    else:
        manifest = json.loads((EXT_DIR / "manifest.json").read_text(encoding="utf-8"))

    violations, report = audit(manifest)

    print("=== Least-Privilege Permission Audit (Dual-Memory Optimizer) ===")
    print("\n".join(report))
    if violations:
        print("\n[FAIL] Permission policy violations:")
        for v in violations:
            print(f"  - {v}")
        return 1
    print("\n[PASS] Every declared permission is backed by shipped code.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
