#!/usr/bin/env python3
"""
package_cws.py
==============
Packages Dual-Memory Optimizer into a clean, compliant ZIP file
ready for direct upload to the Google Chrome Web Store Developer Dashboard.
"""

import os
import json
import shutil
import zipfile
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent
EXT_DIR = REPO_DIR / "extension"
DIST_DIR = REPO_DIR / "dist"
DIST_DIR.mkdir(parents=True, exist_ok=True)
CWS_ZIP = DIST_DIR / "dual-memory-optimizer-cws-upload.zip"

EXCLUDE_DIRS = {"__pycache__", ".git", "_metadata"}
EXCLUDE_FILES = {".DS_Store", "thumbs.db"}

def build_package():
    manifest_p = EXT_DIR / "manifest.json"
    with open(manifest_p, "r", encoding="utf-8") as f:
        version = json.load(f).get("version", "2.0.1")

    print(f"[*] Packaging Dual-Memory Optimizer v{version} Chrome Web Store upload archive...")
    if CWS_ZIP.exists():
        CWS_ZIP.unlink()

    with zipfile.ZipFile(CWS_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(EXT_DIR):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if file in EXCLUDE_FILES or file.endswith(".pyc"):
                    continue
                file_path = Path(root) / file
                rel_path = file_path.relative_to(EXT_DIR)
                zipf.write(file_path, arcname=str(rel_path))
                print(f"  + {rel_path}")

    # Also copy to versioned ZIP for GitHub Releases
    versioned_zip = DIST_DIR / f"Dual-Memory-Optimizer-v{version}.zip"
    shutil.copy2(CWS_ZIP, versioned_zip)

    size_kb = CWS_ZIP.stat().st_size / 1024
    print(f"\n[+] Chrome Web Store upload ZIP ready at:\n    {CWS_ZIP} ({size_kb:.2f} KB)")
    print(f"[+] Versioned release ZIP ready at:\n    {versioned_zip} ({size_kb:.2f} KB)")

if __name__ == "__main__":
    build_package()
