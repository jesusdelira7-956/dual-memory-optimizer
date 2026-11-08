#!/usr/bin/env bash
# ==============================================================================
# Dual-Memory Optimizer - 1-Line Chrome Extension Installer (Linux & macOS)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/jesusdelira7-956/dual-memory-optimizer/main/install-extension.sh | bash
# ==============================================================================

set -euo pipefail

REPO_URL="https://github.com/jesusdelira7-956/dual-memory-optimizer.git"
INSTALL_DIR="${HOME}/.local/share/dual-memory-optimizer/extension"

echo "======================================================================"
echo "  ⚡ DUAL-MEMORY OPTIMIZER - CHROME EXTENSION INSTALLER"
echo "======================================================================"

mkdir -p "$(dirname "${INSTALL_DIR}")"

if command -v git >/dev/null 2>&1; then
    if [ -d "${HOME}/.local/share/dual-memory-optimizer/.git" ]; then
        echo "[*] Updating existing repository..."
        git -C "${HOME}/.local/share/dual-memory-optimizer" pull --ff-only origin main
    else
        echo "[*] Cloning repository..."
        rm -rf "${HOME}/.local/share/dual-memory-optimizer"
        git clone --depth 1 "${REPO_URL}" "${HOME}/.local/share/dual-memory-optimizer"
    fi
else
    echo "[*] Downloading archive..."
    TMP_ZIP="$(mktemp /tmp/dmo-XXXXXX.zip)"
    curl -fsSL "https://github.com/jesusdelira7-956/dual-memory-optimizer/archive/refs/heads/main.zip" -o "${TMP_ZIP}"
    rm -rf "${HOME}/.local/share/dual-memory-optimizer"
    mkdir -p "${HOME}/.local/share/dual-memory-optimizer"
    unzip -q "${TMP_ZIP}" -d "${HOME}/.local/share/dual-memory-optimizer_tmp"
    mv "${HOME}/.local/share/dual-memory-optimizer_tmp"/dual-memory-optimizer-*/* "${HOME}/.local/share/dual-memory-optimizer/"
    rm -rf "${HOME}/.local/share/dual-memory-optimizer_tmp" "${TMP_ZIP}"
fi

# Copy path to clipboard
if command -v xclip >/dev/null 2>&1; then
    printf "%s" "${INSTALL_DIR}" | xclip -selection clipboard || true
    echo "[+] Copied extension path to clipboard!"
elif command -v wl-copy >/dev/null 2>&1; then
    printf "%s" "${INSTALL_DIR}" | wl-copy || true
    echo "[+] Copied extension path to clipboard!"
elif command -v pbcopy >/dev/null 2>&1; then
    printf "%s" "${INSTALL_DIR}" | pbcopy || true
    echo "[+] Copied extension path to clipboard!"
fi

echo ""
echo "======================================================================"
echo "  ✅ CHROME EXTENSION READY TO LOAD!"
echo "======================================================================"
echo "  Folder: ${INSTALL_DIR}"
echo "  (Path is copied to your clipboard!)"
echo ""
echo "  Final Step in Chrome (5 seconds):"
echo "    1. Open chrome://extensions/"
echo "    2. Turn on 'Developer mode' (top-right)"
echo "    3. Click 'Load unpacked' and press Ctrl+V (Paste) -> Enter!"
echo "======================================================================"

for BROWSER in google-chrome google-chrome-stable chromium chromium-browser brave-browser; do
    if command -v "${BROWSER}" >/dev/null 2>&1; then
        "${BROWSER}" "chrome://extensions/" >/dev/null 2>&1 &
        break
    fi
done
