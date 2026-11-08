/**
 * content_injector.js
 * ===================
 * In-page floating assistant for web AI chatboxes (ChatGPT, Claude, Gemini)
 * and GitHub code pages. Injects one-click token optimizer badge.
 */

(() => {
  if (window.__DualMemoryOptimizerInjected) return;
  window.__DualMemoryOptimizerInjected = true;

  console.log('[Dual-Memory Optimizer] Content assistant active.');

  let floatingBadge = null;
  let activeInputElement = null;

  // Target selectors for chat inputs across popular platforms
  const INPUT_SELECTORS = [
    '#prompt-textarea',                       // ChatGPT
    'div[contenteditable="true"]',           // Claude, ChatGPT, Gemini
    'textarea[placeholder*="Ask"]',          // Copilot / Generic
    'textarea[placeholder*="Message"]',      // General AI chats
    'div.ProseMirror',                       // Claude prose editor
    'textarea.form-control',                 // GitHub issue/PR body
  ];

  function getActiveInput() {
    const active = document.activeElement;
    if (!active) return null;

    for (const sel of INPUT_SELECTORS) {
      if (active.matches && active.matches(sel)) return active;
      if (active.closest && active.closest(sel)) return active.closest(sel);
    }
    return null;
  }

  function getInputText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value;
    }
    return el.innerText || el.textContent || '';
  }

  function setInputText(el, newText) {
    if (!el) return;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = newText;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.isContentEditable) {
      el.innerText = newText;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function createFloatingBadge() {
    if (floatingBadge) return;

    floatingBadge = document.createElement('div');
    floatingBadge.id = 'dual-memory-optimizer-pill';
    floatingBadge.innerHTML = `
      <div class="dmo-pill-content">
        <span class="dmo-icon">⚡</span>
        <span class="dmo-text">Condense Code</span>
        <span class="dmo-badge">-70%</span>
      </div>
    `;

    floatingBadge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCondenseClick();
    });

    document.body.appendChild(floatingBadge);
  }

  function updateBadgePosition() {
    if (!floatingBadge || !activeInputElement) {
      if (floatingBadge) floatingBadge.style.display = 'none';
      return;
    }

    const text = getInputText(activeInputElement);
    // Only show if there's enough text (e.g. > 100 characters)
    if (text.length < 120) {
      floatingBadge.style.display = 'none';
      return;
    }

    const rect = activeInputElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      floatingBadge.style.display = 'none';
      return;
    }

    floatingBadge.style.display = 'flex';
    floatingBadge.style.top = `${Math.max(10, window.scrollY + rect.top - 42)}px`;
    floatingBadge.style.left = `${window.scrollX + rect.right - 180}px`;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'dmo-toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('dmo-fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  function handleCondenseClick() {
    if (!activeInputElement) return;
    const rawText = getInputText(activeInputElement);
    if (!rawText || rawText.length < 50) return;

    chrome.runtime.sendMessage(
      { type: 'OPTIMIZE_TEXT', text: rawText, mode: 'signatures' },
      (response) => {
        if (response && response.success && response.result) {
          const res = response.result;
          if (res.savedTokens > 0) {
            setInputText(activeInputElement, res.optimizedText);
            showToast(`✨ Saved ${res.savedTokens} tokens (${res.percentSaved}% reduction)!`);
          } else {
            showToast('ℹ️ Text is already compact.');
          }
        }
      }
    );
  }

  // Listen to focus and input events across the document
  document.addEventListener('focusin', (e) => {
    const input = getActiveInput();
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

  window.addEventListener('scroll', () => {
    updateBadgePosition();
  }, { passive: true });
})();
