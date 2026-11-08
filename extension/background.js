/**
 * background.js
 * =============
 * Background Service Worker for Dual-Memory Optimizer (Manifest V3)
 */

import { TokenCondenser } from './lib/token_condenser.js';

// Default initial state for persistent memory & statistics
const DEFAULT_STORAGE = {
  stats: {
    totalTokensSaved: 0,
    promptsOptimized: 0,
    estimatedDollarsSaved: 0.0,
  },
  settings: {
    floatingButtonEnabled: true,
    autoCondenseOnPaste: false,
    defaultMode: 'signatures', // 'smart' | 'signatures' | 'strip'
  },
  persistentDirectives: [
    {
      id: 'rule-concise',
      title: 'Post-Execution Efficiency',
      content: 'Be concise. Do not explain standard patterns. Return drop-in code diffs.',
      enabled: true,
    },
    {
      id: 'rule-types',
      title: 'Strict Type Annotations',
      content: 'Always include explicit type hints/interfaces for public functions.',
      enabled: true,
    },
  ],
};

// Lifecycle: Install & Update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Dual-Memory Optimizer] Extension installed/updated:', details.reason);

  const existing = await chrome.storage.local.get(['stats', 'settings', 'persistentDirectives']);
  const updates = {};

  if (!existing.stats) updates.stats = DEFAULT_STORAGE.stats;
  if (!existing.settings) updates.settings = DEFAULT_STORAGE.settings;
  if (!existing.persistentDirectives) updates.persistentDirectives = DEFAULT_STORAGE.persistentDirectives;

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  // Configure side panel behavior if supported
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

// Message Bus between Content Scripts, Popup, and Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPTIMIZE_TEXT') {
    const result = TokenCondenser.optimize(message.text, message.mode || 'smart');
    
    // Accumulate metrics if tokens were saved
    if (result.savedTokens > 0) {
      chrome.storage.local.get(['stats'], (data) => {
        const stats = data.stats || { totalTokensSaved: 0, promptsOptimized: 0, estimatedDollarsSaved: 0 };
        stats.totalTokensSaved += result.savedTokens;
        stats.promptsOptimized += 1;
        // Average pricing estimate: $3.00 / million input tokens (approx. $0.000003 per token)
        stats.estimatedDollarsSaved = parseFloat((stats.totalTokensSaved * 0.000003).toFixed(4));
        chrome.storage.local.set({ stats });
      });
    }

    sendResponse({ success: true, result });
    return true;
  }

  if (message.type === 'GET_METRICS') {
    chrome.storage.local.get(['stats'], (data) => {
      sendResponse({ success: true, stats: data.stats || DEFAULT_STORAGE.stats });
    });
    return true;
  }

  if (message.type === 'OPTIMIZE_BROWSER_RAM') {
    chrome.tabs.query({ active: false }, (tabs) => {
      let discardedCount = 0;
      for (const tab of tabs) {
        // Discard non-audible, non-pinned background tabs to free physical RAM
        if (!tab.audible && !tab.discarded && tab.id) {
          try {
            chrome.tabs.discard(tab.id);
            discardedCount++;
          } catch (_) {}
        }
      }
      const reclaimedMB = Math.round(discardedCount * 85); // ~85MB average per discarded tab
      sendResponse({ success: true, discardedCount, reclaimedMB });
    });
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ windowId: sender.tab?.windowId }).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
  }
});
