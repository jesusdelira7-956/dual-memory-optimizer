/**
 * content_injector.js
 * ===================
 * In-page floating assistant for web AI chatboxes (ChatGPT, Claude, Gemini)
 * and GitHub code pages. Injects one-click token optimizer badge and handles
 * framework-safe prompt injection & GitHub DOM scanning without `scripting` permission.
 */

(() => {
  if (window.__DualMemoryOptimizerInjected) return;
  window.__DualMemoryOptimizerInjected = true;

  console.log('[Dual-Memory Optimizer] Content assistant active.');

  let floatingBadge = null;
  let activeInputElement = null;
  let lastOriginalText = null;
  let currentHref = window.location.href;

  let settings = {
    floatingButtonEnabled: true,
    autoCondenseOnPaste: false,
    defaultMode: 'smart',
  };

  // Priority-ordered selectors from most specific semantic hook to structural fallback
  const INPUT_SELECTORS = [
    '#prompt-textarea',
    '[data-testid*="chat-input"]',
    'div.ProseMirror[contenteditable="true"]',
    'div.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Message"]',
    'textarea.form-control',
  ];

  // Hydrate settings and listen for live popup/sidepanel changes
  try {
    chrome.storage.local.get(['settings'], (data) => {
      if (data && data.settings) {
        settings = { ...settings, ...data.settings };
      }
      updateBadgePosition();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings && changes.settings.newValue) {
        settings = { ...settings, ...changes.settings.newValue };
        updateBadgePosition();
      }
    });
  } catch (_) {}

  function isVisibleElement(el) {
    if (!el || !el.isConnected) return false;
    if (el.offsetParent !== null) return true;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  }

  function matchInputFromNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    for (const sel of INPUT_SELECTORS) {
      try {
        if (node.matches && node.matches(sel) && isVisibleElement(node)) return node;
        if (node.closest) {
          const ancestor = node.closest(sel);
          if (ancestor && isVisibleElement(ancestor)) return ancestor;
        }
      } catch (_) {}
    }
    return null;
  }

  function getActiveInput() {
    return matchInputFromNode(document.activeElement);
  }

  function findBestChatInput() {
    if (activeInputElement && activeInputElement.isConnected && isVisibleElement(activeInputElement)) {
      return activeInputElement;
    }
    const focused = getActiveInput();
    if (focused) return focused;

    for (const sel of INPUT_SELECTORS) {
      try {
        const candidates = document.querySelectorAll(sel);
        for (const el of candidates) {
          if (isVisibleElement(el)) return el;
        }
      } catch (_) {}
    }
    return null;
  }

  function getInputText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value || '';
    }
    return el.innerText || el.textContent || '';
  }

  /**
   * Sets input text using native descriptors (React) or Selection/Range + execCommand
   * (ProseMirror / TipTap / Quill) so frameworks enable their Submit button reliably.
   */
  function setInputText(el, newText) {
    if (!el) return;
    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto =
        el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(el, newText);
      } else {
        el.value = newText;
      }
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertReplacementText',
          data: newText,
        })
      );
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (el.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);

      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, newText);
      } catch (_) {
        inserted = false;
      }
      if (!inserted) {
        el.textContent = newText;
      }
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertReplacementText',
        })
      );
    }
  }

  function hasSensitiveSecret(text) {
    if (!text || text.length < 12) return false;
    return (
      /\bAKIA[0-9A-Z]{16}\b/.test(text) ||
      /\bsk-(?:proj-|ant-[A-Za-z0-9_-]*-)?[A-Za-z0-9_-]{20,}\b/.test(text) ||
      /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(text) ||
      /\bAIza[0-9A-Za-z_-]{35}\b/.test(text) ||
      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(text) ||
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(text) ||
      /^[A-Z0-9_]*(?:API_KEY|SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*[^\s#]{6,}/m.test(text)
    );
  }

  function createFloatingBadge() {
    if (floatingBadge && floatingBadge.isConnected) return;

    floatingBadge = document.createElement('div');
    floatingBadge.id = 'dual-memory-optimizer-pill';

    const content = document.createElement('div');
    content.className = 'dmo-pill-content';

    const icon = document.createElement('span');
    icon.className = 'dmo-icon';
    icon.textContent = '⚡';

    const text = document.createElement('span');
    text.className = 'dmo-text';
    text.textContent = 'Condense';

    const badge = document.createElement('span');
    badge.className = 'dmo-badge';
    badge.textContent = settings.defaultMode === 'signatures' ? 'SIG' : 'SMART';

    content.append(icon, text, badge);
    floatingBadge.appendChild(content);

    floatingBadge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCondenseClick();
    });

    (document.body || document.documentElement).appendChild(floatingBadge);
  }

  function updateBadgePosition() {
    if (!floatingBadge) return;

    if (settings.floatingButtonEnabled === false || !activeInputElement || !activeInputElement.isConnected) {
      floatingBadge.style.display = 'none';
      return;
    }

    const text = getInputText(activeInputElement);
    const secretFound = hasSensitiveSecret(text);
    if (!secretFound && text.length < 120) {
      floatingBadge.style.display = 'none';
      return;
    }

    const badgeSpan = floatingBadge.querySelector('.dmo-badge');
    const textSpan = floatingBadge.querySelector('.dmo-text');
    if (secretFound) {
      floatingBadge.classList.add('dmo-pill-secret');
      if (textSpan) textSpan.textContent = '🔒 Secret Detected';
      if (badgeSpan) {
        badgeSpan.classList.add('dmo-badge-secret');
        badgeSpan.textContent = 'REDACT';
      }
    } else {
      floatingBadge.classList.remove('dmo-pill-secret');
      if (textSpan) textSpan.textContent = 'Condense';
      if (badgeSpan) {
        badgeSpan.classList.remove('dmo-badge-secret');
        badgeSpan.textContent = settings.defaultMode === 'signatures' ? 'SIG' : 'SMART';
      }
    }

    const rect = activeInputElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      floatingBadge.style.display = 'none';
      return;
    }

    floatingBadge.style.display = 'flex';
    floatingBadge.style.top = `${Math.max(10, window.scrollY + rect.top - 42)}px`;
    floatingBadge.style.left = `${Math.max(10, window.scrollX + rect.right - 205)}px`;
  }

  function showToast(message, onUndo = null) {
    const existing = document.querySelectorAll('.dmo-toast-notification');
    existing.forEach((n) => n.remove());

    const toast = document.createElement('div');
    toast.className = 'dmo-toast-notification';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    let timer = null;
    if (typeof onUndo === 'function') {
      const undoBtn = document.createElement('button');
      undoBtn.type = 'button';
      undoBtn.className = 'dmo-toast-undo';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (timer) clearTimeout(timer);
        onUndo();
        toast.remove();
      });
      toast.appendChild(undoBtn);
    }

    (document.body || document.documentElement).appendChild(toast);
    timer = setTimeout(() => {
      toast.classList.add('dmo-fade-out');
      setTimeout(() => toast.remove(), 400);
    }, typeof onUndo === 'function' ? 5000 : 2500);
  }

  function handleCondenseClick() {
    const target = findBestChatInput();
    if (!target) return;

    const rawText = getInputText(target);
    const secretDetected = hasSensitiveSecret(rawText);
    if (!rawText || (!secretDetected && rawText.length < 50)) return;

    const mode = secretDetected ? 'redact' : (settings.defaultMode || 'smart');
    lastOriginalText = rawText;

    chrome.runtime.sendMessage({ type: 'OPTIMIZE_TEXT', text: rawText, mode }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success || !response.result) return;
      const res = response.result;
      if (res.secretsRedacted > 0 || res.savedTokens > 0) {
        const snapshotBeforeCondense = rawText;
        setInputText(target, res.optimizedText);
        updateBadgePosition();
        const msg =
          res.secretsRedacted > 0
            ? `🔒 Redacted ${res.secretsRedacted} secret(s) safely`
            : `✨ Saved ${res.savedTokens} tokens (${res.percentSaved}% reduction)`;
        showToast(msg, () => setInputText(target, snapshotBeforeCondense));
      } else {
        showToast('ℹ️ Text is already compact.');
      }
    });
  }

  function scanGitHubDOM() {
    const files = new Set();
    const rowSelectors = [
      'tr.react-directory-row',
      'td.content a',
      '[data-testid="file-name-id-wide"]',
      '.js-navigation-item .js-navigation-open',
    ];

    for (const sel of rowSelectors) {
      document.querySelectorAll(sel).forEach((row) => {
        const line = (row.innerText || row.textContent || '').trim().split('\n')[0].trim();
        if (line && !line.includes('..') && line !== 'History') {
          files.add(line);
        }
      });
    }

    const symbols = [];
    const codeLines = document.querySelectorAll('.blob-code-inner');
    if (codeLines.length > 0) {
      codeLines.forEach((lineEl) => {
        const txt = (lineEl.textContent || '').trim();
        if (/^(?:export\s+)?(?:async\s+)?(?:function|class|def|interface|type|func|fn|struct|impl)\b/.test(txt)) {
          symbols.push(txt.slice(0, 120));
        }
      });
    } else {
      const roArea = document.querySelector('textarea#read-only-cursor-text-area');
      if (roArea && roArea.value) {
        for (const line of roArea.value.split('\n')) {
          const txt = line.trim();
          if (/^(?:export\s+)?(?:async\s+)?(?:function|class|def|interface|type|func|fn|struct|impl)\b/.test(txt)) {
            symbols.push(txt.slice(0, 120));
          }
        }
      }
    }

    return {
      url: window.location.href,
      title: document.title,
      files: Array.from(files),
      symbols: symbols.slice(0, 80),
    };
  }

  // Handle Side Panel -> Content Script commands without needing `scripting` permission
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === 'INJECT_PROMPT') {
      const target = findBestChatInput();
      if (!target) {
        sendResponse({ success: false, error: 'No visible AI chat box found. Click inside the prompt input first.' });
        return;
      }
      const previous = getInputText(target);
      setInputText(target, message.text || '');
      activeInputElement = target;
      updateBadgePosition();
      showToast('✨ Prompt injected!', previous ? () => setInputText(target, previous) : null);
      sendResponse({ success: true });
      return;
    }

    if (message.type === 'SCAN_GITHUB_PAGE') {
      if (!window.location.hostname.includes('github.com')) {
        sendResponse({ success: false, error: 'Active tab is not GitHub.' });
        return;
      }
      sendResponse({ success: true, data: scanGitHubDOM() });
      return;
    }
  });

  // Intercept large pastes (> 1500 chars) when Auto-Condense on Paste is enabled
  document.addEventListener('paste', (e) => {
    if (!settings.autoCondenseOnPaste) return;
    const target = matchInputFromNode(e.target);
    if (!target) return;

    const pasted = e.clipboardData?.getData('text/plain') || '';
    if (pasted.length <= 1500) return;

    e.preventDefault();
    const existingText = getInputText(target);
    const combinedRaw = existingText ? `${existingText}\n${pasted}` : pasted;

    chrome.runtime.sendMessage({ type: 'OPTIMIZE_TEXT', text: pasted, mode: 'smart' }, (response) => {
      if (!chrome.runtime.lastError && response && response.success && response.result && response.result.savedTokens > 0) {
        const condensed = existingText
          ? `${existingText}\n${response.result.optimizedText}`
          : response.result.optimizedText;
        setInputText(target, condensed);
        showToast(
          `✨ Auto-condensed paste: saved ${response.result.savedTokens} tokens (${response.result.percentSaved}%)`,
          () => setInputText(target, combinedRaw)
        );
      } else {
        setInputText(target, combinedRaw);
      }
      updateBadgePosition();
    });
  });

  // Focus, input, scroll & resize listeners
  document.addEventListener('focusin', (e) => {
    const input = matchInputFromNode(e.target) || getActiveInput();
    if (input) {
      activeInputElement = input;
      createFloatingBadge();
      updateBadgePosition();
    }
  });

  document.addEventListener('input', () => {
    updateBadgePosition();
  });

  window.addEventListener('resize', () => {
    updateBadgePosition();
  });

  window.addEventListener(
    'scroll',
    () => {
      updateBadgePosition();
    },
    { passive: true }
  );

  // SPA navigation watcher (ChatGPT / Claude / Gemini / GitHub Turbo)
  let navDebounce = null;
  function checkRouteChange() {
    if (window.location.href !== currentHref) {
      currentHref = window.location.href;
      activeInputElement = findBestChatInput();
      updateBadgePosition();
    }
  }

  window.addEventListener('popstate', checkRouteChange);

  const navObserver = new MutationObserver(() => {
    if (navDebounce) return;
    navDebounce = setTimeout(() => {
      navDebounce = null;
      checkRouteChange();
    }, 250);
  });

  if (document.body) {
    navObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) navObserver.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
