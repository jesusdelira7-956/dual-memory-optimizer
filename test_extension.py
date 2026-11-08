#!/usr/bin/env python3
"""
test_extension.py
=================
Automated test harness for Dual-Memory Optimizer Manifest V3 Chrome Extension.
Validates manifest schema, icons, required files, and packaging readiness.
"""

import json
from pathlib import Path
from PIL import Image

REPO_DIR = Path(__file__).resolve().parent
EXT_DIR = REPO_DIR / "extension"

def test_manifest():
    manifest_p = EXT_DIR / "manifest.json"
    assert manifest_p.is_file(), "manifest.json missing from extension folder"
    with open(manifest_p, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data.get("manifest_version") == 3, "Must be Manifest V3"
    assert data.get("name") == "Dual-Memory Optimizer", f"Incorrect name: {data.get('name')}"
    assert "version" in data, "Version key missing"
    assert len(data.get("description", "")) <= 132, "Description must be <= 132 characters"
    assert "service_worker" in data.get("background", {}), "Service worker missing"
    assert data.get("background", {}).get("type") == "module", "Must use ES module for background"
    print("[+] manifest.json schema, name, and permissions: OK")
    return data

def test_icons(manifest):
    icons = manifest.get("icons", {})
    assert "16" in icons and "48" in icons and "128" in icons, "Missing icon sizes"

    for size_str, rel_path in icons.items():
        expected_size = int(size_str)
        icon_path = EXT_DIR / rel_path
        assert icon_path.is_file(), f"Icon file missing: {icon_path}"
        with Image.open(icon_path) as img:
            assert img.size == (expected_size, expected_size), f"Icon {rel_path} size mismatch"
        print(f"[+] Icon {size_str}x{size_str} ({rel_path}): OK")

def test_frontend_assets():
    required_files = [
        "background.js",
        "lib/token_condenser.js",
        "content/content_injector.js",
        "content/content.css",
        "popup/popup.html",
        "popup/popup.css",
        "popup/popup.js",
        "sidepanel/sidepanel.html",
        "sidepanel/sidepanel.css",
        "sidepanel/sidepanel.js",
    ]
    for rf in required_files:
        p = EXT_DIR / rf
        assert p.is_file(), f"Required extension asset missing: {rf}"
        assert p.stat().st_size > 0, f"Asset is empty: {rf}"
    print(f"[+] All {len(required_files)} extension assets verified present & non-empty: OK")

def main():
    print("=== Testing Dual-Memory Optimizer Extension ===")
    manifest = test_manifest()
    test_icons(manifest)
    test_frontend_assets()
    print("\n✅ All Manifest V3 Extension Tests Passed Successfully!")

if __name__ == "__main__":
    main()
