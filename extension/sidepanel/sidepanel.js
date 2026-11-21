/**
 * sidepanel.js
 * ============
 * Logic for Dual-Memory Optimizer Power HUD (Side Panel)
 */

import { TokenCondenser } from '../lib/token_condenser.js';

// DOM Elements
const statTokens = document.getElementById('statTokens');
const statDollars = document.getElementById('statDollars');
const btnSidepanelOptimizeRAM = document.getElementById('btnSidepanelOptimizeRAM');
const rawInput = document.getElementById('rawInput');
const optimizedOutput = document.getElementById('optimizedOutput');
const inputTokenCount = document.getElementById('inputTokenCount');
const savingsBadge = document.getElementById('savingsBadge');

const btnSignatures = document.getElementById('btnSignatures');
const btnSmart = document.getElementById('btnSmart');
const btnStrip = document.getElementById('btnStrip');
const btnTrace = document.getElementById('btnTrace');
const btnCopy = document.getElementById('btnCopy');
const btnInjectActive = document.getElementById('btnInjectActive');

const directivesList = document.getElementById('directivesList');
const newDirectiveTitle = document.getElementById('newDirectiveTitle');
const newDirectiveContent = document.getElementById('newDirectiveContent');
const btnAddDirective = document.getElementById('btnAddDirective');
const btnAppendDirectives = document.getElementById('btnAppendDirectives');

const btnScanGitHub = document.getElementById('btnScanGitHub');
const ghOutput = document.getElementById('ghOutput');

// Navigation Tabs
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// 1-Click Optimize Browser RAM
btnSidepanelOptimizeRAM.addEventListener('click', () => {
  btnSidepanelOptimizeRAM.textContent = '⏳ Suspending Inactive Tabs...';
  chrome.runtime.sendMessage({ type: 'OPTIMIZE_BROWSER_RAM' }, (response) => {
    if (response && response.success) {
      if (response.discardedCount > 0) {
        btnSidepanelOptimizeRAM.textContent = `⚡ Reclaimed ~${response.reclaimedMB}MB RAM (${response.discardedCount} tabs suspended)`;
      } else {
        btnSidepanelOptimizeRAM.textContent = '✓ Browser RAM already optimal!';
      }
    } else {
      btnSidepanelOptimizeRAM.textContent = '✓ Memory optimized';
    }
    setTimeout(() => {
      btnSidepanelOptimizeRAM.textContent = '🧹 1-Click Optimize Browser RAM (Suspend Idle Tabs)';
    }, 3000);
  });
});

// Update Metrics Display
function refreshMetrics() {
  chrome.storage.local.get(['stats'], (data) => {
    const s = data.stats || { totalTokensSaved: 0, estimatedDollarsSaved: 0 };
    statTokens.textContent = s.totalTokensSaved.toLocaleString();
    statDollars.textContent = `$${(s.estimatedDollarsSaved || 0).toFixed(2)}`;
  });
}

// Live Token Counter on Input
rawInput.addEventListener('input', () => {
  const count = TokenCondenser.estimateTokens(rawInput.value);
  inputTokenCount.textContent = `${count.toLocaleString()} tokens`;
});

// Optimization Execution
function executeOptimization(mode) {
  const text = rawInput.value;
  if (!text.trim()) return;

  const res = TokenCondenser.optimize(text, mode);
  optimizedOutput.value = res.optimizedText;

  savingsBadge.textContent = `${res.percentSaved}% saved (${res.savedTokens} tokens)`;
  savingsBadge.style.color = res.percentSaved > 0 ? '#10b981' : '#94a3b8';

  // Sync to persistent stats via background message
  if (res.savedTokens > 0) {
    chrome.runtime.sendMessage({ type: 'OPTIMIZE_TEXT', text, mode }, () => {
      refreshMetrics();
    });
  }
}

btnSignatures.addEventListener('click', () => executeOptimization('signatures'));
btnSmart.addEventListener('click', () => executeOptimization('smart'));
btnStrip.addEventListener('click', () => executeOptimization('strip'));
btnTrace.addEventListener('click', () => executeOptimization('stacktrace'));

// Copy Action
btnCopy.addEventListener('click', async () => {
  if (!optimizedOutput.value) return;
  await navigator.clipboard.writeText(optimizedOutput.value);
  const orig = btnCopy.textContent;
  btnCopy.textContent = '✓ Copied!';
  setTimeout(() => (btnCopy.textContent = orig), 1500);
});

// Inject into Active Web Tab via content script messaging (no `scripting` permission needed)
btnInjectActive.addEventListener('click', async () => {
  if (!optimizedOutput.value) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    savingsBadge.textContent = '⚠️ No active tab found.';
    savingsBadge.style.color = '#f59e0b';
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: 'INJECT_PROMPT', text: optimizedOutput.value }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const reason = chrome.runtime.lastError
        ? 'Refresh this AI chat tab or open a supported AI surface first.'
        : response?.error || 'Could not inject into active tab.';
      savingsBadge.textContent = `⚠️ ${reason}`;
      savingsBadge.style.color = '#f59e0b';
      return;
    }

    savingsBadge.textContent = '✓ Injected into active chat!';
    savingsBadge.style.color = '#10b981';
  });
});

// Persistent Directives Management
async function loadDirectives() {
  const data = await chrome.storage.local.get(['persistentDirectives']);
  const list = data.persistentDirectives || [];

  directivesList.innerHTML = '';
  list.forEach((dir, idx) => {
    const card = document.createElement('div');
    card.className = 'directive-card';
    card.innerHTML = `
      <div class="directive-header">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" data-idx="${idx}" ${dir.enabled ? 'checked' : ''}>
          <span class="directive-title">${escapeHtml(dir.title)}</span>
        </label>
        <button class="btn-del" data-idx="${idx}" style="background:transparent; border:none; color:#ef4444; cursor:pointer;">✕</button>
      </div>
      <div class="directive-body">${escapeHtml(dir.content)}</div>
    `;
    directivesList.appendChild(card);
  });

  // Checkbox toggle listeners
  directivesList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      list[i].enabled = e.target.checked;
      await chrome.storage.local.set({ persistentDirectives: list });
    });
  });

  // Delete button listeners
  directivesList.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      list.splice(i, 1);
      await chrome.storage.local.set({ persistentDirectives: list });
      loadDirectives();
    });
  });
}

btnAddDirective.addEventListener('click', async () => {
  const title = newDirectiveTitle.value.trim();
  const content = newDirectiveContent.value.trim();
  if (!title || !content) return;

  const data = await chrome.storage.local.get(['persistentDirectives']);
  const list = data.persistentDirectives || [];
  list.push({ id: `rule-${Date.now()}`, title, content, enabled: true });
  await chrome.storage.local.set({ persistentDirectives: list });

  newDirectiveTitle.value = '';
  newDirectiveContent.value = '';
  loadDirectives();
});

btnAppendDirectives.addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['persistentDirectives']);
  const list = (data.persistentDirectives || []).filter(d => d.enabled);

  if (list.length === 0) {
    alert('No active directives selected.');
    return;
  }

  const header = `\n\n[PERSISTENT DIRECTIVES & CONSTRAINTS]:\n` + list.map(d => `- ${d.title}: ${d.content}`).join('\n');
  rawInput.value = (rawInput.value + header).trim();
  rawInput.dispatchEvent(new Event('input'));
  // Switch to working tab
  document.querySelector('.nav-tab[data-tab="tab-working"]').click();
});

// GitHub Scanner (routes via content script message — zero `scripting` permission)
btnScanGitHub.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('github.com')) {
    ghOutput.textContent = '⚠️ Current active tab is not a GitHub page.\nPlease open a GitHub repository and try again.';
    return;
  }

  ghOutput.textContent = 'Scanning GitHub DOM for repository tree and symbols...';

  chrome.tabs.sendMessage(tab.id, { type: 'SCAN_GITHUB_PAGE' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success || !response.data) {
      ghOutput.textContent =
        '⚠️ Could not reach the Dual-Memory Optimizer assistant on this GitHub tab.\nPlease refresh the GitHub page and click Scan again.';
      return;
    }

    const data = response.data;
    const sections = [`[GITHUB CODEBASE MAP]: ${data.title}`, `URL: ${data.url}`];
    if (data.files && data.files.length > 0) {
      sections.push(`\nFILES IDENTIFIED (${data.files.length}):\n` + data.files.map((f) => `├── ${f}`).join('\n'));
    }
    if (data.symbols && data.symbols.length > 0) {
      sections.push(`\nSYMBOLS EXTRACTED (${data.symbols.length}):\n` + data.symbols.map((s) => `  • ${s}`).join('\n'));
    }
    if ((!data.files || data.files.length === 0) && (!data.symbols || data.symbols.length === 0)) {
      sections.push('\nNo repository file rows or source code blocks detected on this view.');
    }

    const map = sections.join('\n');
    ghOutput.textContent = map;
    rawInput.value = map;
    rawInput.dispatchEvent(new Event('input'));
  });
});

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========================================================
// Pillar 2: Data Loss Prevention (Backup & Restore)
// ========================================================
const btnExportBackup = document.getElementById('btnExportBackup');
const fileRestoreBackup = document.getElementById('fileRestoreBackup');
const backupStatus = document.getElementById('backupStatus');

if (btnExportBackup) {
  btnExportBackup.addEventListener('click', async () => {
    try {
      const stored = await chrome.storage.local.get(null);
      const backupData = {
        app: 'Dual-Memory Optimizer',
        version: chrome.runtime.getManifest().version,
        exportedAt: new Date().toISOString(),
        persistentDirectives: stored.persistentDirectives || [],
        settings: stored.settings || {},
        stats: stored.stats || {},
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `dual-memory-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      if (backupStatus) {
        backupStatus.textContent = '✓ Backup JSON exported successfully!';
        backupStatus.style.color = '#10b981';
      }
    } catch (err) {
      if (backupStatus) {
        backupStatus.textContent = `Export failed: ${err.message}`;
        backupStatus.style.color = '#ef4444';
      }
    }
  });
}

if (fileRestoreBackup) {
  fileRestoreBackup.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.app !== 'Dual-Memory Optimizer' && !parsed.persistentDirectives) {
          throw new Error('Invalid backup file format.');
        }

        const updates = {};
        if (Array.isArray(parsed.persistentDirectives)) updates.persistentDirectives = parsed.persistentDirectives;
        if (parsed.settings) updates.settings = parsed.settings;
        if (parsed.stats) updates.stats = parsed.stats;

        await chrome.storage.local.set(updates);

        // Also mirror to sync storage
        if (updates.persistentDirectives) {
          try {
            await chrome.storage.sync.set({ persistentDirectives: updates.persistentDirectives });
          } catch (_) {}
        }

        if (backupStatus) {
          backupStatus.textContent = '✓ Backup restored successfully! Reloading...';
          backupStatus.style.color = '#10b981';
        }
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        if (backupStatus) {
          backupStatus.textContent = `Restore failed: ${err.message}`;
          backupStatus.style.color = '#ef4444';
        }
      }
    };
    reader.readAsText(file);
  });
}

// Diagnostics Exporter
const btnCopyDiagnostics = document.getElementById('btnCopyDiagnostics');
const btnOpenGitHubIssue = document.getElementById('btnOpenGitHubIssue');
const diagStatus = document.getElementById('diagStatus');

if (btnCopyDiagnostics) {
  btnCopyDiagnostics.addEventListener('click', async () => {
    try {
      const stored = await chrome.storage.local.get(null);
      const diagBundle = {
        extension: 'Dual-Memory Optimizer',
        version: chrome.runtime.getManifest().version,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        tokensSaved: stored.stats?.totalTokensSaved || 0,
        promptsOptimized: stored.stats?.promptsOptimized || 0,
        directivesCount: (stored.persistentDirectives || []).length,
        settings: stored.settings || {},
      };

      const jsonStr = JSON.stringify(diagBundle, null, 2);
      await navigator.clipboard.writeText(jsonStr);

      if (diagStatus) {
        diagStatus.textContent = '✓ Diagnostic telemetry copied to clipboard!';
        diagStatus.style.color = '#10b981';
      }
    } catch (err) {
      if (diagStatus) {
        diagStatus.textContent = `Error copying: ${err.message}`;
        diagStatus.style.color = '#ef4444';
      }
    }
  });
}

if (btnOpenGitHubIssue) {
  btnOpenGitHubIssue.addEventListener('click', () => {
    const url = 'https://github.com/jesusdelira7-956/dual-memory-optimizer/issues/new?title=[Bug]+Dual-Memory+Optimizer+Report&labels=bug,extension';
    chrome.tabs.create({ url });
  });
}

const btnBuyCoffee = document.getElementById('btnBuyCoffee');
if (btnBuyCoffee) {
  btnBuyCoffee.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://buymeacoffee.com/JesseInTheLab' });
  });
}

// Initial Load
refreshMetrics();
loadDirectives();
