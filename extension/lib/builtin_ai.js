/**
 * builtin_ai.js
 * =============
 * Progressive-enhancement adapter for Chrome's Built-in AI (Gemini Nano):
 * - Summarizer API (self.Summarizer)
 * - Prompt API (self.LanguageModel)
 * Safely feature-detects hardware availability and enforces session.destroy().
 */

const MAX_CHUNK_CHARS = 16000;

export class BuiltInAI {
  static async _checkApiAvailability(apiObj) {
    if (!apiObj) return 'unavailable';
    try {
      if (typeof apiObj.availability === 'function') {
        const state = await apiObj.availability();
        return state || 'unavailable';
      }
      if (typeof apiObj.capabilities === 'function') {
        const caps = await apiObj.capabilities();
        return caps?.available || 'unavailable';
      }
    } catch (_) {
      return 'unavailable';
    }
    return 'unavailable';
  }

  /**
   * Returns current local Gemini Nano hardware/model readiness.
   */
  static async getStatus() {
    const hasSummarizer = typeof self !== 'undefined' && 'Summarizer' in self;
    const hasPrompt = typeof self !== 'undefined' && 'LanguageModel' in self;

    const summarizer = hasSummarizer ? await this._checkApiAvailability(self.Summarizer) : 'unavailable';
    const promptApi = hasPrompt ? await this._checkApiAvailability(self.LanguageModel) : 'unavailable';

    const supported =
      (summarizer !== 'unavailable' && summarizer !== 'no') ||
      (promptApi !== 'unavailable' && promptApi !== 'no');

    return {
      supported,
      summarizer,
      promptApi,
    };
  }

  static chunkText(text, maxChars = MAX_CHUNK_CHARS) {
    const clean = String(text || '').trim();
    if (clean.length <= maxChars) return clean ? [clean] : [];
    const chunks = [];
    let offset = 0;
    while (offset < clean.length) {
      let end = Math.min(offset + maxChars, clean.length);
      if (end < clean.length) {
        const lastNewline = clean.lastIndexOf('\n', end);
        if (lastNewline > offset + maxChars * 0.6) {
          end = lastNewline;
        }
      }
      chunks.push(clean.slice(offset, end).trim());
      offset = end;
    }
    return chunks.filter(Boolean);
  }

  /**
   * Locally summarizes long prose/docs/PR notes via Gemini Nano, streaming chunks cleanly.
   */
  static async summarizeText(text, onChunk = null) {
    const status = await this.getStatus();
    if (!status.supported || status.summarizer === 'unavailable' || status.summarizer === 'no') {
      throw new Error('Chrome Built-in Summarizer API (Gemini Nano) is unavailable on this device.');
    }

    const chunks = this.chunkText(text);
    if (chunks.length === 0) return '';

    let session = null;
    try {
      session = await self.Summarizer.create({
        type: 'key-points',
        format: 'markdown',
        length: 'short',
        sharedContext: 'Developer context compression; preserve technical constraints and symbols.',
      });

      const outputs = [];
      for (const chunk of chunks) {
        if (typeof session.summarizeStreaming === 'function') {
          let chunkResult = '';
          const stream = session.summarizeStreaming(chunk);
          for await (const piece of stream) {
            chunkResult += piece;
            if (typeof onChunk === 'function') onChunk(piece, false);
          }
          outputs.push(chunkResult.trim());
        } else {
          const summary = await session.summarize(chunk);
          outputs.push(String(summary || '').trim());
          if (typeof onChunk === 'function') onChunk(summary, false);
        }
      }
      if (typeof onChunk === 'function') onChunk('', true);
      return outputs.join('\n\n');
    } finally {
      if (session && typeof session.destroy === 'function') {
        try {
          session.destroy();
        } catch (_) {}
      }
    }
  }
}
