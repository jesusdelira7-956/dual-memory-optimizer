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

const PROTECTED_AI_ORIGINS = [
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'perplexity.ai',
  'aistudio.google.com',
  'chat.deepseek.com',
  'grok.com',
];

function isProtectedTabUrl(url) {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return PROTECTED_AI_ORIGINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch (_) {
    return false;
  }
}

const OPTIONAL_PLATFORM_SCRIPTS_ID = 'dmo-optional-platforms';
const OPTIONAL_PLATFORM_ORIGINS = [
  'https://perplexity.ai/*',
  'https://www.perplexity.ai/*',
  'https://aistudio.google.com/*',
  'https://chat.deepseek.com/*',
  'https://grok.com/*',
  'http://localhost/*',
  'http://127.0.0.1/*',
];

async function syncOptionalPlatformScripts() {
  if (!chrome.scripting || !chrome.scripting.registerContentScripts) return { granted: [] };
  try {
    const perms = await chrome.permissions.getAll();
    const grantedSet = new Set(perms.origins || []);
    const activeMatches = OPTIONAL_PLATFORM_ORIGINS.filter((origin) => grantedSet.has(origin));

    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [OPTIONAL_PLATFORM_SCRIPTS_ID],
    }).catch(() => []);

    if (existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [OPTIONAL_PLATFORM_SCRIPTS_ID] });
    }

    if (activeMatches.length > 0) {
      await chrome.scripting.registerContentScripts([
        {
          id: OPTIONAL_PLATFORM_SCRIPTS_ID,
          matches: activeMatches,
          js: ['content/content_injector.js'],
          css: ['content/content.css'],
          runAt: 'document_idle',
          persistAcrossSessions: true,
        },
      ]);
    }

    return { granted: activeMatches };
  } catch (err) {
    console.warn('[Dual-Memory Optimizer] Failed syncing optional platform scripts:', err);
    return { granted: [], error: err.message };
  }
}

chrome.runtime.onStartup.addListener(() => {
  syncOptionalPlatformScripts();
});

// Lifecycle: Install & Update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Dual-Memory Optimizer] Extension installed/updated:', details.reason);

  // Pillar 2 Data Loss Prevention: Pre-update snapshot guard (strip old backups to avoid 2^N growth)
  if (details.reason === 'update') {
    try {
      const allLocal = await chrome.storage.local.get(null);
      const snapshotPayload = {};
      const existingBackupKeys = [];

      for (const [k, v] of Object.entries(allLocal)) {
        if (k.startsWith('backup_pre_upgrade_')) {
          existingBackupKeys.push(k);
        } else {
          snapshotPayload[k] = v;
        }
      }

      const backupKey = `backup_pre_upgrade_${details.previousVersion || 'v2'}_${Date.now()}`;
      await chrome.storage.local.set({ [backupKey]: snapshotPayload });

      // Keep at most the 2 most recent pre-upgrade snapshots
      const allBackupKeys = [...existingBackupKeys, backupKey].sort((a, b) => {
        const tsA = Number(a.split('_').pop()) || 0;
        const tsB = Number(b.split('_').pop()) || 0;
        return tsA - tsB;
      });
      if (allBackupKeys.length > 2) {
        const keysToRemove = allBackupKeys.slice(0, allBackupKeys.length - 2);
        await chrome.storage.local.remove(keysToRemove);
      }

      console.log(`[Dual-Memory Optimizer] Safety snapshot saved to ${backupKey}`);
    } catch (err) {
      console.error('[Dual-Memory Optimizer] Error creating pre-update snapshot:', err);
    }
  }

  const existing = await chrome.storage.local.get(['stats', 'settings', 'persistentDirectives']);
  const updates = {};

  // Cloud Sync Auto-Recovery on new install / device change
  if (details.reason === 'install') {
    try {
      const cloudSync = await chrome.storage.sync.get(['persistentDirectives', 'settings']);
      if (cloudSync.persistentDirectives && cloudSync.persistentDirectives.length > 0) {
        existing.persistentDirectives = cloudSync.persistentDirectives;
        console.log('[Dual-Memory Optimizer] Recovered persistent directives from Chrome Cloud Sync.');
      }
      if (cloudSync.settings) {
        existing.settings = cloudSync.settings;
      }
    } catch (err) {
      console.warn('[Dual-Memory Optimizer] Cloud sync recovery skipped:', err);
    }
  }

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

  await syncOptionalPlatformScripts();
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
    chrome.tabs.query({ active: false }, async (tabs) => {
      let discardedCount = 0;
      for (const tab of tabs) {
        // Skip active, pinned, audible, already-discarded, and protected AI streaming tabs
        if (
          !tab.id ||
          tab.active ||
          tab.pinned ||
          tab.audible ||
          tab.discarded ||
          isProtectedTabUrl(tab.url)
        ) {
          continue;
        }
        try {
          await chrome.tabs.discard(tab.id);
          discardedCount++;
        } catch (_) {}
      }
      const reclaimedMB = Math.round(discardedCount * 85); // ~85MB average per discarded tab
      sendResponse({ success: true, discardedCount, reclaimedMB });
    });
    return true;
  }

  if (message.type === 'SYNC_OPTIONAL_PLATFORMS') {
    syncOptionalPlatformScripts().then((res) => sendResponse({ success: true, ...res }));
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
