#!/usr/bin/env python3
"""
package_cws.py
==============
Packages Dual-Memory Optimizer into a clean, compliant ZIP file
ready for direct upload to the Google Chrome Web Store Developer Dashboard.
"""

import os
import json
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
    print("[*] Packaging Dual-Memory Optimizer Chrome Web Store upload archive...")
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

    size_kb = CWS_ZIP.stat().st_size / 1024
    print(f"\n[+] Chrome Web Store upload ZIP ready at:\n    {CWS_ZIP} ({size_kb:.2f} KB)")

if __name__ == "__main__":
    build_package()
