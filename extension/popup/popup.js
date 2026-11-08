/**
 * popup.js
 * ========
 * Logic for Dual-Memory Optimizer Popup Menu
 */

import { TokenCondenser } from '../lib/token_condenser.js';

const popTokens = document.getElementById('popTokens');
const popDollars = document.getElementById('popDollars');
const btnOpenSidepanel = document.getElementById('btnOpenSidepanel');
const btnOptimizeBrowserRAM = document.getElementById('btnOptimizeBrowserRAM');
const btnCondenseClipboard = document.getElementById('btnCondenseClipboard');
const chkFloating = document.getElementById('chkFloating');
const chkAutoCondense = document.getElementById('chkAutoCondense');

// Load stored settings and stats
chrome.storage.local.get(['stats', 'settings'], (data) => {
  const stats = data.stats || { totalTokensSaved: 0, estimatedDollarsSaved: 0 };
  const settings = data.settings || { floatingButtonEnabled: true, autoCondenseOnPaste: false };

  popTokens.textContent = stats.totalTokensSaved.toLocaleString();
  popDollars.textContent = `$${(stats.estimatedDollarsSaved || 0).toFixed(2)}`;

  chkFloating.checked = settings.floatingButtonEnabled !== false;
  chkAutoCondense.checked = !!settings.autoCondenseOnPaste;
});

// Update settings on toggle
chkFloating.addEventListener('change', () => {
  chrome.storage.local.get(['settings'], (data) => {
    const s = data.settings || {};
    s.floatingButtonEnabled = chkFloating.checked;
    chrome.storage.local.set({ settings: s });
  });
});

chkAutoCondense.addEventListener('change', () => {
  chrome.storage.local.get(['settings'], (data) => {
    const s = data.settings || {};
    s.autoCondenseOnPaste = chkAutoCondense.checked;
    chrome.storage.local.set({ settings: s });
  });
});

// Open Side Panel
btnOpenSidepanel.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id && chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  }
});

// 1-Click Optimize Browser RAM
btnOptimizeBrowserRAM.addEventListener('click', () => {
  btnOptimizeBrowserRAM.textContent = '⏳ Purging RAM...';
  chrome.runtime.sendMessage({ type: 'OPTIMIZE_BROWSER_RAM' }, (response) => {
    if (response && response.success) {
      if (response.discardedCount > 0) {
        btnOptimizeBrowserRAM.textContent = `⚡ Freed ~${response.reclaimedMB}MB (${response.discardedCount} tabs suspended)`;
      } else {
        btnOptimizeBrowserRAM.textContent = `✓ Browser RAM already optimized!`;
      }
    } else {
      btnOptimizeBrowserRAM.textContent = `✓ RAM optimized`;
    }
    setTimeout(() => {
      btnOptimizeBrowserRAM.textContent = '🧹 1-Click Optimize Browser RAM';
    }, 3000);
  });
});

// Condense Clipboard Code Directly
btnCondenseClipboard.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text || text.length < 20) {
      alert('Clipboard is empty or contains too little text.');
      return;
    }

    const res = TokenCondenser.optimize(text, 'signatures');
    await navigator.clipboard.writeText(res.optimizedText);

    // Sync stats
    if (res.savedTokens > 0) {
      chrome.runtime.sendMessage({ type: 'OPTIMIZE_TEXT', text, mode: 'signatures' });
    }

    btnCondenseClipboard.textContent = `✓ Saved ${res.savedTokens} tokens (${res.percentSaved}%)!`;
    setTimeout(() => {
      btnCondenseClipboard.textContent = '📋 Condense Clipboard Code Now';
    }, 2500);
  } catch (err) {
    alert('Please allow clipboard permissions or copy text first.');
  }
});
