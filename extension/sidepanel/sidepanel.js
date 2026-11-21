/**
 * sidepanel.js
 * ============
 * Logic for Dual-Memory Optimizer Power HUD v2.1 (Side Panel)
 */

import { TokenCondenser } from '../lib/token_condenser.js';
import { BuiltInAI } from '../lib/builtin_ai.js';

// DOM Elements
const statTokens = document.getElementById('statTokens');
const statDollars = document.getElementById('statDollars');
const btnSidepanelOptimizeRAM = document.getElementById('btnSidepanelOptimizeRAM');
const rawInput = document.getElementById('rawInput');
const optimizedOutput = document.getElementById('optimizedOutput');
const inputTokenCount = document.getElementById('inputTokenCount');
const savingsBadge = document.getElementById('savingsBadge');
const secretAlertBanner = document.getElementById('secretAlertBanner');

const btnSignatures = document.getElementById('btnSignatures');
const btnSmart = document.getElementById('btnSmart');
const btnStrip = document.getElementById('btnStrip');
const btnTrace = document.getElementById('btnTrace');
const btnScrubSecrets = document.getElementById('btnScrubSecrets');
const btnNanoSummarize = document.getElementById('btnNanoSummarize');
const btnCopy = document.getElementById('btnCopy');
const btnInjectActive = document.getElementById('btnInjectActive');

const directivesList = document.getElementById('directivesList');
const newDirectiveTitle = document.getElementById('newDirectiveTitle');
const newDirectiveContent = document.getElementById('newDirectiveContent');
const btnAddDirective = document.getElementById('btnAddDirective');
const btnAppendDirectives = document.getElementById('btnAppendDirectives');

const btnScanGitHub = document.getElementById('btnScanGitHub');
const ghOutput = document.getElementById('ghOutput');

const optionalPlatformsList = document.getElementById('optionalPlatformsList');
const platformStatus = document.getElementById('platformStatus');

const DIRECTIVE_PRESETS = {
  code_review: {
    id: 'preset-code-review',
    title: 'Senior Code Review ({{lang}})',
    content: 'Audit this {{lang}} code for security flaws, race conditions, and edge-case bugs as of {{date}}. Return minimal diff fixes only.',
  },
  debug_mode: {
    id: 'preset-debug-mode',
    title: 'Root-Cause Debug ({{lang}})',
    content: 'Identify the exact failure condition in the {{lang}} snippet below. Do not rewrite unrelated lines.',
  },
  arch_audit: {
    id: 'preset-arch-audit',
    title: 'Architecture Tradeoff Audit',
    content: 'Evaluate scalability, coupling, and failure recovery tradeoffs. Focus on concrete structural improvements.',
  },
};

const OPTIONAL_PLATFORMS = [
  { id: 'perplexity', label: 'Perplexity AI (perplexity.ai)', origins: ['https://perplexity.ai/*', 'https://www.perplexity.ai/*'] },
  { id: 'aistudio', label: 'Google AI Studio (aistudio.google.com)', origins: ['https://aistudio.google.com/*'] },
  { id: 'deepseek', label: 'DeepSeek Chat (chat.deepseek.com)', origins: ['https://chat.deepseek.com/*'] },
  { id: 'grok', label: 'Grok (grok.com)', origins: ['https://grok.com/*'] },
  { id: 'openwebui', label: 'Local Open WebUI (localhost / 127.0.0.1)', origins: ['http://localhost/*', 'http://127.0.0.1/*'] },
];

// Navigation Tabs
document.querySelectorAll('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
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
    statTokens.textContent = (s.totalTokensSaved || 0).toLocaleString();
    statDollars.textContent = `$${(s.estimatedDollarsSaved || 0).toFixed(2)}`;
  });
}

// Live Token Counter + Secret Detector on Input
function updateInputIndicators() {
  const val = rawInput.value || '';
  const count = TokenCondenser.estimateTokens(val);
  inputTokenCount.textContent = `${count.toLocaleString()} tokens`;

  if (secretAlertBanner) {
    const scan = TokenCondenser.redactSecrets(val);
    if (scan.totalRedacted > 0) {
      const types = scan.findings.map((f) => `${f.type}×${f.count}`).join(', ');
      secretAlertBanner.textContent = `🔒 Secret Warning: ${scan.totalRedacted} credential(s) detected (${types}). Click "Scrub Secrets" before sending!`;
      secretAlertBanner.style.display = 'block';
    } else {
      secretAlertBanner.style.display = 'none';
      secretAlertBanner.textContent = '';
    }
  }
}

rawInput.addEventListener('input', updateInputIndicators);

// Optimization Execution
function executeOptimization(mode) {
  const text = rawInput.value;
  if (!text.trim()) return;

  const res = TokenCondenser.optimize(text, mode);
  optimizedOutput.value = res.optimizedText;

  if (mode === 'redact') {
    savingsBadge.textContent =
      res.secretsRedacted > 0
        ? `🔒 Redacted ${res.secretsRedacted} secret(s)`
        : '✓ Zero secrets detected';
    savingsBadge.style.color = res.secretsRedacted > 0 ? '#10b981' : '#94a3b8';
  } else {
    savingsBadge.textContent = `${res.percentSaved}% saved (${res.savedTokens} tokens)`;
    savingsBadge.style.color = res.percentSaved > 0 ? '#10b981' : '#94a3b8';
  }

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
if (btnScrubSecrets) {
  btnScrubSecrets.addEventListener('click', () => executeOptimization('redact'));
}

// Chrome Built-in AI (Gemini Nano) Progressive Enhancement
async function initBuiltInAIButton() {
  if (!btnNanoSummarize) return;
  const status = await BuiltInAI.getStatus();
  if (!status.supported || status.summarizer === 'unavailable' || status.summarizer === 'no') {
    btnNanoSummarize.disabled = true;
    btnNanoSummarize.title = 'Chrome Built-in Gemini Nano Summarizer is not enabled on this browser/hardware.';
    btnNanoSummarize.textContent = '✨ Nano (Unavailable)';
    return;
  }

  btnNanoSummarize.disabled = false;
  btnNanoSummarize.textContent =
    status.summarizer === 'after-download' ? '✨ Nano (Download & Run)' : '✨ Nano Summarize';
}

if (btnNanoSummarize) {
  initBuiltInAIButton();
  btnNanoSummarize.addEventListener('click', async () => {
    const text = rawInput.value;
    if (!text.trim()) return;
    btnNanoSummarize.disabled = true;
    optimizedOutput.value = '';
    savingsBadge.textContent = '✨ Gemini Nano summarizing locally...';
    savingsBadge.style.color = '#38bdf8';

    try {
      const summary = await BuiltInAI.summarizeText(text, (chunk, done) => {
        if (!done && chunk) optimizedOutput.value += chunk;
      });
      if (!optimizedOutput.value) optimizedOutput.value = summary;
      const origTokens = TokenCondenser.estimateTokens(text);
      const optTokens = TokenCondenser.estimateTokens(optimizedOutput.value);
      const saved = Math.max(0, origTokens - optTokens);
      const pct = origTokens > 0 ? Math.round((saved / origTokens) * 100) : 0;
      savingsBadge.textContent = `✨ Nano: ${pct}% saved (${saved} tokens)`;
      savingsBadge.style.color = '#10b981';
    } catch (err) {
      savingsBadge.textContent = `⚠️ ${err.message}`;
      savingsBadge.style.color = '#f59e0b';
    } finally {
      btnNanoSummarize.disabled = false;
    }
  });
}

// Copy Action
btnCopy.addEventListener('click', async () => {
  if (!optimizedOutput.value) return;
  await navigator.clipboard.writeText(optimizedOutput.value);
  const orig = btnCopy.textContent;
  btnCopy.textContent = '✓ Copied!';
  setTimeout(() => (btnCopy.textContent = orig), 1500);
});

// Inject into Active Web Tab via content script messaging
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
        ? 'Refresh this AI chat tab or enable this site in Optional Platforms.'
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

  directivesList.replaceChildren();
  list.forEach((dir, idx) => {
    const card = document.createElement('div');
    card.className = 'directive-card';

    const header = document.createElement('div');
    header.className = 'directive-header';

    const label = document.createElement('label');
    label.style.cssText = 'display:flex; align-items:center; gap:6px; cursor:pointer;';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = Boolean(dir.enabled);
    chk.addEventListener('change', async (e) => {
      list[idx].enabled = e.target.checked;
      await chrome.storage.local.set({ persistentDirectives: list });
    });

    const titleSpan = document.createElement('span');
    titleSpan.className = 'directive-title';
    titleSpan.textContent = dir.title || 'Directive';

    label.append(chk, titleSpan);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-del';
    delBtn.style.cssText = 'background:transparent; border:none; color:#ef4444; cursor:pointer;';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', async () => {
      list.splice(idx, 1);
      await chrome.storage.local.set({ persistentDirectives: list });
      loadDirectives();
    });

    header.append(label, delBtn);

    const body = document.createElement('div');
    body.className = 'directive-body';
    body.textContent = dir.content || '';

    card.append(header, body);
    directivesList.appendChild(card);
  });
}

document.querySelectorAll('.btn-preset').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const preset = DIRECTIVE_PRESETS[btn.dataset.preset];
    if (!preset) return;
    const data = await chrome.storage.local.get(['persistentDirectives']);
    const list = data.persistentDirectives || [];
    if (!list.some((d) => d.id === preset.id || d.title === preset.title)) {
      list.push({ ...preset, enabled: true });
      await chrome.storage.local.set({ persistentDirectives: list });
      loadDirectives();
    }
  });
});

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
  const list = (data.persistentDirectives || []).filter((d) => d.enabled);

  if (list.length === 0) {
    savingsBadge.textContent = '⚠️ No active directives selected.';
    savingsBadge.style.color = '#f59e0b';
    return;
  }

  const detectedLang = TokenCondenser.detectType(rawInput.value);
  const templateVars = {
    lang: detectedLang === 'text' ? 'code' : detectedLang,
    date: new Date().toISOString().slice(0, 10),
    selection: (rawInput.value || '').trim().slice(0, 200),
  };

  const renderedDirectives = list.map((d) =>
    TokenCondenser.applyTemplate(`- ${d.title}: ${d.content}`, templateVars)
  );
  const header = `\n\n[PERSISTENT DIRECTIVES & CONSTRAINTS]:\n${renderedDirectives.join('\n')}`;
  rawInput.value = (rawInput.value + header).trim();
  rawInput.dispatchEvent(new Event('input'));
  document.querySelector('.nav-tab[data-tab="tab-working"]').click();
});

// GitHub Scanner
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

// Optional AI Platform Permissions UI
async function renderOptionalPlatforms() {
  if (!optionalPlatformsList || !chrome.permissions) return;
  optionalPlatformsList.replaceChildren();

  for (const plat of OPTIONAL_PLATFORMS) {
    const granted = await chrome.permissions.contains({ origins: plat.origins }).catch(() => false);
    const row = document.createElement('div');
    row.className = 'platform-row';

    const label = document.createElement('span');
    label.textContent = plat.label;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = granted ? 'btn btn-accent' : 'btn btn-secondary';
    btn.style.cssText = 'padding: 4px 10px; font-size: 10px;';
    btn.textContent = granted ? '✓ Enabled' : 'Enable';

    btn.addEventListener('click', async () => {
      try {
        if (granted) {
          await chrome.permissions.remove({ origins: plat.origins });
        } else {
          const ok = await chrome.permissions.request({ origins: plat.origins });
          if (!ok) {
            if (platformStatus) platformStatus.textContent = `Permission declined for ${plat.label}.`;
            return;
          }
        }
        chrome.runtime.sendMessage({ type: 'SYNC_OPTIONAL_PLATFORMS' }, () => {
          if (platformStatus) {
            platformStatus.textContent = granted
              ? `Disabled ${plat.label}.`
              : `✓ Enabled ${plat.label}! Refresh matching open tabs to activate.`;
            platformStatus.style.color = '#10b981';
          }
          renderOptionalPlatforms();
        });
      } catch (err) {
        if (platformStatus) {
          platformStatus.textContent = `Error: ${err.message}`;
          platformStatus.style.color = '#ef4444';
        }
      }
    });

    row.append(label, btn);
    optionalPlatformsList.appendChild(row);
  }
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
renderOptionalPlatforms();
