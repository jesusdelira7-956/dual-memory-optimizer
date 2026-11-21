/**
 * token_condenser.js
 * ==================
 * Core deterministic engine for Dual-Memory Optimizer v2.1.
 * Supports:
 * - Multi-language comment stripping & AST-heuristic signature extraction
 *   (Python w/ decorators & multi-line defs, JS/TS w/ brace depth, Go, Rust, C/C++, Java, SQL)
 * - Mixed Markdown prompt condensing (preserves prose, condenses fenced code blocks)
 * - JSON schema & large array compression
 * - Client-side Secret & PII redaction
 * - Parameterized template interpolation
 */

const SECRET_RULES = [
  {
    type: 'PEM_KEY',
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
  {
    type: 'AWS_KEY',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    type: 'GITHUB_TOKEN',
    pattern: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  {
    type: 'API_KEY',
    pattern: /\bsk-(?:proj-|ant-[A-Za-z0-9_-]*-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    type: 'GOOGLE_API_KEY',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    type: 'SLACK_TOKEN',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    type: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    type: 'BEARER_TOKEN',
    pattern: /\b(Bearer)\s+([A-Za-z0-9._~+/=-]{16,})\b/gi,
    preservePrefixGroup: 1,
  },
  {
    type: 'ENV_SECRET',
    pattern: /^([A-Z0-9_]*(?:API_KEY|SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*(["']?)([^\s"'#\r\n]{6,})\2/gm,
    envSecret: true,
  },
];

const FENCE_LANG_ALIASES = {
  py: 'python',
  python: 'python',
  python3: 'python',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'javascript',
  tsx: 'javascript',
  javascript: 'javascript',
  typescript: 'javascript',
  mjs: 'javascript',
  go: 'go',
  golang: 'go',
  rs: 'rust',
  rust: 'rust',
  c: 'cpp',
  cpp: 'cpp',
  'c++': 'cpp',
  cc: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  java: 'cpp',
  cs: 'cpp',
  sql: 'sql',
  postgres: 'sql',
  postgresql: 'sql',
  json: 'json',
  jsonc: 'json',
};

export class TokenCondenser {
  /**
   * Fast BPE-approximated token estimator (~3.8 chars/token + word adjustment).
   */
  static estimateTokens(text) {
    if (!text || typeof text !== 'string' || text.length === 0) return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    const words = trimmed.split(/\s+/).length;
    const chars = text.length;
    const estimate = Math.ceil((chars / 3.8 + words * 0.25) / 1.15);
    return Math.max(1, estimate);
  }

  /**
   * Detects the dominant format or programming language of an input snippet.
   */
  static detectType(text, hint = '') {
    if (hint) {
      const normalized = hint.trim().toLowerCase();
      if (FENCE_LANG_ALIASES[normalized]) {
        return FENCE_LANG_ALIASES[normalized];
      }
    }

    if (!text) return 'text';
    const trimmed = text.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch (_) {}
    }

    if (/(?:Traceback \(most recent call last\)|^\s*at [a-zA-Z0-9_$.<>]+\s+\(.*:\d+:\d+\)|^(?:Error|TypeError|ReferenceError|ValueError): )/m.test(trimmed)) {
      return 'stacktrace';
    }

    if (/(?:^\s*package\s+[a-zA-Z0-9_]+|\bfunc\s+(?:\([^)]+\)\s*)?[A-Za-z_][A-Za-z0-9_]*\s*\()/m.test(trimmed)) {
      return 'go';
    }

    if (/(?:\bpub\s+(?:fn|struct|enum|trait|mod)\b|\bfn\s+[a-z_][A-Za-z0-9_]*\s*(?:<[^>]+>)?\s*\(|\bimpl(?:<[^>]+>)?\s+[A-Za-z0-9_]+)/m.test(trimmed)) {
      return 'rust';
    }

    if (/(?:^\s*#include\s+[<"]|\bpublic\s+class\s+[A-Za-z0-9_]+|\bstd::|\btemplate\s*<)/m.test(trimmed)) {
      return 'cpp';
    }

    if (/(?:^\s*(?:CREATE\s+(?:TABLE|VIEW|INDEX|FUNCTION)|SELECT\s+.+\s+FROM|INSERT\s+INTO|ALTER\s+TABLE)\b)/im.test(trimmed)) {
      return 'sql';
    }

    if (/(?:^\s*(?:def |async def |class |from [a-zA-Z0-9_.]+ import|import [a-zA-Z0-9_.]+)|if __name__ ==)/m.test(trimmed)) {
      return 'python';
    }

    if (/(?:^\s*(?:export\s+|import\s+.*\s+from\s+|function\s+|interface\s+|type\s+|const\s+|let\s+|class\s+\w+\s*(?:extends|implements|\{)))/m.test(trimmed)) {
      return 'javascript';
    }

    return 'text';
  }

  /**
   * Strips Python docstrings and # comments while preserving strings and shebangs.
   */
  static stripPython(code) {
    if (!code) return '';
    let out = code.replace(/^[ \t]*(?:"""[\s\S]*?"""|'''[\s\S]*?''')[ \t]*\r?\n?/gm, '');
    const lines = out.split('\n');
    const cleaned = lines.map((line, idx) => {
      if (idx === 0 && line.startsWith('#!')) return line;
      let quote = null;
      let escaped = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (quote) {
          if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          continue;
        }
        if (ch === '#') {
          return line.slice(0, i).trimEnd();
        }
      }
      return line;
    });
    return this.cleanWhitespace(cleaned.join('\n'));
  }

  /**
   * Tokenizer-safe comment stripper for C-style languages (JS, TS, Go, Rust, C/C++, Java).
   * Never corrupts URLs ('https://...') or comments delimiters inside string or regex literals.
   */
  static stripCStyleComments(code) {
    if (!code) return '';
    let out = '';
    const n = code.length;
    let i = 0;
    let quote = null;
    let lastSigChar = '';

    while (i < n) {
      const ch = code[i];
      const next = i + 1 < n ? code[i + 1] : '';

      if (quote) {
        out += ch;
        if (ch === '\\' && i + 1 < n) {
          out += next;
          i += 2;
          continue;
        }
        if (ch === quote) {
          quote = null;
          lastSigChar = ch;
        }
        i++;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        out += ch;
        i++;
        continue;
      }

      if (ch === '/' && next === '/') {
        // Skip until end of line
        i += 2;
        while (i < n && code[i] !== '\n') i++;
        // Trim trailing horizontal spaces on the line before newline
        out = out.replace(/[ \t]+$/, '');
        continue;
      }

      if (ch === '/' && next === '*') {
        // Skip until closing */
        i += 2;
        while (i < n && !(code[i] === '*' && code[i + 1] === '/')) {
          i++;
        }
        i += 2;
        continue;
      }

      // Heuristic regex literal guard (after operators/delimiters like =, (, [, :, !, ?)
      if (ch === '/' && '(=[,!:?&|;{}\n'.includes(lastSigChar || '\n')) {
        let j = i + 1;
        let esc = false;
        let inClass = false;
        let closed = false;
        while (j < n && code[j] !== '\n') {
          const rc = code[j];
          if (esc) {
            esc = false;
          } else if (rc === '\\') {
            esc = true;
          } else if (rc === '[') {
            inClass = true;
          } else if (rc === ']') {
            inClass = false;
          } else if (rc === '/' && !inClass) {
            closed = true;
            j++;
            while (j < n && /[gimsuyv]/.test(code[j])) j++;
            break;
          }
          j++;
        }
        if (closed) {
          out += code.slice(i, j);
          lastSigChar = '/';
          i = j;
          continue;
        }
      }

      out += ch;
      if (!/\s/.test(ch)) {
        lastSigChar = ch;
      }
      i++;
    }

    return this.cleanWhitespace(out);
  }

  /**
   * Backwards-compatible alias for C-style / JS/TS comment stripping.
   */
  static stripJS(code) {
    return this.stripCStyleComments(code);
  }

  /**
   * Strips SQL -- line comments and /* ... *\/ block comments outside single-quoted strings.
   */
  static stripSQL(code) {
    if (!code) return '';
    let out = '';
    const n = code.length;
    let i = 0;
    let inSingleQuote = false;

    while (i < n) {
      const ch = code[i];
      const next = i + 1 < n ? code[i + 1] : '';

      if (inSingleQuote) {
        out += ch;
        if (ch === "'" && next === "'") {
          out += next;
          i += 2;
          continue;
        }
        if (ch === "'") inSingleQuote = false;
        i++;
        continue;
      }

      if (ch === "'") {
        inSingleQuote = true;
        out += ch;
        i++;
        continue;
      }

      if (ch === '-' && next === '-') {
        i += 2;
        while (i < n && code[i] !== '\n') i++;
        out = out.replace(/[ \t]+$/, '');
        continue;
      }

      if (ch === '/' && next === '*') {
        i += 2;
        while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
        i += 2;
        continue;
      }

      out += ch;
      i++;
    }

    return this.cleanWhitespace(out);
  }

  /**
   * Counts delta in parentheses () outside string literals on a single line.
   */
  static _parenDelta(line) {
    let delta = 0;
    let quote = null;
    let esc = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === '#') break;
      if (ch === '(') delta++;
      else if (ch === ')') delta--;
    }
    return delta;
  }

  /**
   * Counts net brace delta {} ignoring string/char literals and // comments.
   */
  static _braceDelta(line) {
    let delta = 0;
    let quote = null;
    let esc = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = i + 1 < line.length ? line[i + 1] : '';
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '/' && next === '/') break;
      if (ch === '{') delta++;
      else if (ch === '}') delta--;
    }
    return delta;
  }

  static _extractPythonSignatures(code) {
    const cleaned = this.stripPython(code);
    const lines = cleaned.split('\n');
    const result = [];
    let pendingDecorators = [];
    let classIndentStack = [];
    let skipUntilIndentBelow = null;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const trimmed = line.trim();
      if (!trimmed) continue;

      const indent = line.length - line.trimStart().length;

      // Pop any ended classes
      while (classIndentStack.length > 0 && indent <= classIndentStack[classIndentStack.length - 1]) {
        classIndentStack.pop();
      }

      if (skipUntilIndentBelow !== null) {
        if (indent > skipUntilIndentBelow) {
          continue;
        }
        skipUntilIndentBelow = null;
      }

      if (trimmed.startsWith('@')) {
        pendingDecorators.push(line);
        continue;
      }

      if (/^class\s+[A-Za-z0-9_]+/.test(trimmed)) {
        if (pendingDecorators.length > 0) {
          result.push(...pendingDecorators);
          pendingDecorators = [];
        }
        result.push(line);
        classIndentStack.push(indent);
        continue;
      }

      if (/^(?:async\s+def|def)\s+[A-Za-z0-9_]+/.test(trimmed)) {
        if (pendingDecorators.length > 0) {
          result.push(...pendingDecorators);
          pendingDecorators = [];
        }
        const sigLines = [line];
        let parenDepth = this._parenDelta(line);
        while (!sigLines[sigLines.length - 1].trim().endsWith(':') && (parenDepth > 0 || !line.includes(':')) && idx + 1 < lines.length) {
          idx++;
          const nextLine = lines[idx];
          sigLines.push(nextLine);
          parenDepth += this._parenDelta(nextLine);
          if (nextLine.trim().endsWith(':') && parenDepth <= 0) break;
        }
        result.push(...sigLines);
        result.push(`${' '.repeat(indent + 4)}...`);
        skipUntilIndentBelow = indent;
        continue;
      }

      pendingDecorators = [];

      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        result.push(line);
      } else if (classIndentStack.length > 0 && indent > classIndentStack[classIndentStack.length - 1]) {
        // Keep typed class fields inside a class body
        if (/^[a-zA-Z_][A-Za-z0-9_]*\s*:\s*[^=]+/.test(trimmed)) {
          result.push(line);
        }
      }
    }

    return result.length > 0 ? result.join('\n') : cleaned;
  }

  static _extractBraceLangSignatures(code, lang) {
    const cleaned = this.stripCStyleComments(code);
    const lines = cleaned.split('\n');
    const result = [];
    let braceDepth = 0;
    const classDepths = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      const delta = this._braceDelta(line);
      const currentClassBodyDepth = classDepths.length > 0 ? classDepths[classDepths.length - 1] : null;
      const atTopLevel = braceDepth === 0;
      const inClassBody = currentClassBodyDepth !== null && braceDepth === currentClassBodyDepth;

      let handled = false;

      if (atTopLevel) {
        if (
          /^(?:import\b|export\s+(?:type|interface|\*|\{)|package\s+|use\s+|mod\s+|#include\s+)/.test(trimmed)
        ) {
          result.push(line);
          handled = true;
        } else if (
          /^(?:export\s+(?:default\s+)?)?(?:abstract\s+)?(?:class|struct|interface|trait|impl)\b/.test(trimmed)
        ) {
          if (/^(?:export\s+(?:default\s+)?)?interface\b/.test(trimmed)) {
            result.push(line);
            handled = true;
          } else if (trimmed.includes('{')) {
            result.push(line);
            if (delta > 0) classDepths.push(braceDepth + delta);
            handled = true;
          }
        } else if (
          (lang === 'javascript' &&
            /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function\s*\*?|type\s+|enum\s+|(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+)?=>)/.test(
              trimmed
            )) ||
          (lang === 'go' && /^(?:func\s+|type\s+)/.test(trimmed)) ||
          (lang === 'rust' && /^(?:pub\s+)?(?:async\s+)?(?:fn|struct|enum|trait|type)\b/.test(trimmed)) ||
          (lang === 'cpp' &&
            /^(?:(?:public|private|protected|static|virtual|inline|async|template)\s+)*[A-Za-z_:<>*&\s]+\s+[A-Za-z_~]\w*\s*\(/.test(
              trimmed
            ))
        ) {
          if (trimmed.includes('{')) {
            const braceIdx = line.indexOf('{');
            const sig = line.slice(0, braceIdx).trimEnd();
            result.push(`${sig} { /* ... */ }`);
          } else {
            result.push(line);
          }
          handled = true;
        }
      } else if (inClassBody) {
        // Keep TS interface fields intact if inside interface? Close classes nicely when closing brace pops
        if (trimmed === '}') {
          result.push(line);
          handled = true;
        } else if (
          lang === 'javascript' &&
          /^(?:(?:public|private|protected|static|readonly|override|async|get|set)\s+)*(?:constructor|[A-Za-z_$#][\w$]*)\s*(?:<[^>]+>)?\s*\(/.test(
            trimmed
          ) &&
          !/^(?:if|for|while|switch|catch|return)\b/.test(trimmed)
        ) {
          if (trimmed.includes('{')) {
            const braceIdx = line.indexOf('{');
            const sig = line.slice(0, braceIdx).trimEnd();
            result.push(`${sig} { /* ... */ }`);
          } else {
            result.push(line);
          }
          handled = true;
        } else if (
          lang === 'javascript' &&
          /^(?:(?:public|private|protected|static|readonly)\s+)?[A-Za-z_$#][\w$]*\??\s*:\s*[^=;{]+;?$/.test(trimmed)
        ) {
          result.push(line);
          handled = true;
        } else if (
          (lang === 'cpp' || lang === 'rust' || lang === 'go') &&
          /^(?:(?:pub|public|private|protected|static|virtual|async)\s+)?(?:fn\s+)?[A-Za-z_][\w:<>*&\s]*\([^)]*\)/.test(trimmed) &&
          !/^(?:if|for|while|switch|catch)\b/.test(trimmed)
        ) {
          if (trimmed.includes('{')) {
            const braceIdx = line.indexOf('{');
            const sig = line.slice(0, braceIdx).trimEnd();
            result.push(`${sig} { /* ... */ }`);
          } else {
            result.push(line);
          }
          handled = true;
        }
      }

      braceDepth = Math.max(0, braceDepth + delta);
      while (classDepths.length > 0 && braceDepth < classDepths[classDepths.length - 1]) {
        if (!handled && trimmed.startsWith('}')) {
          result.push('}');
        }
        classDepths.pop();
      }
    }

    return result.length > 0 ? result.join('\n') : cleaned;
  }

  /**
   * Extracts function, class, method, interface, struct, and SQL signatures across supported languages.
   */
  static extractSignatures(code, langOverride = null) {
    if (!code || typeof code !== 'string') return '';
    const lang = langOverride || this.detectType(code);

    if (lang === 'python') {
      return this._extractPythonSignatures(code);
    }
    if (lang === 'json') {
      return this.compressJsonSchema(code);
    }
    if (lang === 'stacktrace') {
      return this.compressStackTrace(code);
    }
    if (lang === 'sql') {
      const cleaned = this.stripSQL(code);
      const blocks = cleaned.match(/CREATE\s+(?:TABLE|VIEW|FUNCTION|INDEX)\b[\s\S]*?;/gi);
      return blocks && blocks.length > 0 ? blocks.join('\n\n') : cleaned;
    }
    if (['javascript', 'go', 'rust', 'cpp'].includes(lang)) {
      return this._extractBraceLangSignatures(code, lang);
    }
    return this.cleanWhitespace(code);
  }

  /**
   * Compresses verbose JSON payloads, collapsing arrays > 3 items into typed single-item schema samples.
   */
  static compressJsonSchema(text) {
    try {
      const parsed = JSON.parse(text);
      const shrink = (val) => {
        if (Array.isArray(val)) {
          if (val.length > 3) {
            return [shrink(val[0]), `... (+${val.length - 1} more items matching schema)`];
          }
          return val.map(shrink);
        }
        if (val && typeof val === 'object') {
          const out = {};
          for (const [k, v] of Object.entries(val)) {
            out[k] = shrink(v);
          }
          return out;
        }
        return val;
      };
      return JSON.stringify(shrink(parsed));
    } catch (_) {
      return this.cleanWhitespace(text);
    }
  }

  /**
   * Compresses stack traces, preserving top 4 frames and bottom 3 frames.
   */
  static compressStackTrace(text) {
    const lines = text.split('\n').map((l) => l.trimEnd()).filter(Boolean);
    if (lines.length <= 8) return text.trim();

    const head = lines.slice(0, 4);
    const tail = lines.slice(-3);
    const omitted = lines.length - head.length - tail.length;

    return [...head, `    ... [Truncated ${omitted} internal runtime stack frames] ...`, ...tail].join('\n');
  }

  /**
   * Cleans excessive empty lines and trailing whitespace.
   */
  static cleanWhitespace(text) {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Condenses mixed Markdown prompts: preserves user prose verbatim while condensing
   * only fenced code blocks (```lang ... ```).
   */
  static condenseMixedPrompt(text, mode = 'smart') {
    const fenceRe = /```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)```/g;
    if (!fenceRe.test(text)) {
      return null;
    }
    fenceRe.lastIndex = 0;

    return text.replace(fenceRe, (_full, langHint, blockBody) => {
      const lang = this.detectType(blockBody, langHint);
      let optimizedBlock = blockBody;

      if (mode === 'signatures') {
        optimizedBlock = this.extractSignatures(blockBody, lang);
      } else {
        if (lang === 'python') optimizedBlock = this.stripPython(blockBody);
        else if (['javascript', 'go', 'rust', 'cpp'].includes(lang)) optimizedBlock = this.stripCStyleComments(blockBody);
        else if (lang === 'sql') optimizedBlock = this.stripSQL(blockBody);
        else if (lang === 'json') optimizedBlock = this.compressJsonSchema(blockBody);
        else if (lang === 'stacktrace') optimizedBlock = this.compressStackTrace(blockBody);
        else optimizedBlock = this.cleanWhitespace(blockBody);
      }

      const label = langHint ? langHint : '';
      return `\`\`\`${label}\n${optimizedBlock}\n\`\`\``;
    });
  }

  /**
   * Scans and redacts credentials, API keys, JWTs, PEM private keys, and .env secrets client-side.
   */
  static redactSecrets(text) {
    if (!text || typeof text !== 'string') {
      return { redactedText: '', findings: [], totalRedacted: 0 };
    }

    let working = text;
    const counters = {};
    const findingsMap = {};

    for (const rule of SECRET_RULES) {
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      working = working.replace(re, (...args) => {
        counters[rule.type] = (counters[rule.type] || 0) + 1;
        const placeholder = `[REDACTED_${rule.type}_${counters[rule.type]}]`;
        findingsMap[rule.type] = (findingsMap[rule.type] || 0) + 1;

        if (rule.preservePrefixGroup) {
          return `${args[rule.preservePrefixGroup]} ${placeholder}`;
        }
        if (rule.envSecret) {
          const key = args[1];
          const quote = args[2] || '';
          return `${key}=${quote}${placeholder}${quote}`;
        }
        return placeholder;
      });
    }

    const findings = Object.entries(findingsMap).map(([type, count]) => ({ type, count }));
    const totalRedacted = findings.reduce((acc, f) => acc + f.count, 0);
    return { redactedText: working, findings, totalRedacted };
  }

  static containsPotentialSecrets(text) {
    return this.redactSecrets(text).totalRedacted > 0;
  }

  /**
   * Safely interpolates {{lang}}, {{date}}, {{selection}}, or custom template keys.
   */
  static applyTemplate(text, vars = {}) {
    if (!text || typeof text !== 'string') return '';
    const defaults = {
      date: new Date().toISOString().slice(0, 10),
    };
    const merged = { ...defaults, ...vars };
    return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (full, key) => {
      return Object.prototype.hasOwnProperty.call(merged, key) && merged[key] !== undefined
        ? String(merged[key])
        : full;
    });
  }

  /**
   * Main entrypoint: Auto-detects type and returns optimized payload with metrics.
   */
  static optimize(text, mode = 'smart') {
    if (!text || typeof text !== 'string') {
      return {
        type: 'text',
        mode,
        originalText: '',
        optimizedText: '',
        originalTokens: 0,
        optimizedTokens: 0,
        savedTokens: 0,
        percentSaved: 0,
        secretsRedacted: 0,
      };
    }

    const originalTokens = this.estimateTokens(text);
    const detectedType = this.detectType(text);
    let optimizedText = text;
    let secretsRedacted = 0;

    if (mode === 'redact') {
      const redacted = this.redactSecrets(text);
      optimizedText = redacted.redactedText;
      secretsRedacted = redacted.totalRedacted;
    } else if (mode === 'stacktrace') {
      optimizedText = this.compressStackTrace(text);
    } else if (mode === 'json') {
      optimizedText = this.compressJsonSchema(text);
    } else if ((mode === 'smart' || mode === 'signatures') && /```[\s\S]*?```/.test(text)) {
      optimizedText = this.condenseMixedPrompt(text, mode) || text;
    } else if (mode === 'signatures') {
      optimizedText = this.extractSignatures(text, detectedType);
    } else if (mode === 'strip' || mode === 'smart') {
      if (detectedType === 'python') {
        optimizedText = this.stripPython(text);
      } else if (['javascript', 'go', 'rust', 'cpp'].includes(detectedType)) {
        optimizedText = this.stripCStyleComments(text);
      } else if (detectedType === 'sql') {
        optimizedText = this.stripSQL(text);
      } else if (detectedType === 'stacktrace') {
        optimizedText = this.compressStackTrace(text);
      } else if (detectedType === 'json') {
        optimizedText = this.compressJsonSchema(text);
      } else {
        optimizedText = this.cleanWhitespace(text);
      }
    }

    const optimizedTokens = this.estimateTokens(optimizedText);
    const savedTokens = Math.max(0, originalTokens - optimizedTokens);
    const percentSaved = originalTokens > 0 ? Math.round((savedTokens / originalTokens) * 100) : 0;

    return {
      type: detectedType,
      mode,
      originalText: text,
      optimizedText,
      originalTokens,
      optimizedTokens,
      savedTokens,
      percentSaved,
      secretsRedacted,
    };
  }
}
