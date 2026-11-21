import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(__dirname, '..', 'extension');

async function main() {
  const { chromium } = await import('playwright');
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dmo-canary-'));

  const fixtureHtml = `<!doctype html>
  <html><head><title>Chat Fixture</title></head>
  <body>
    <div id="prompt-textarea" contenteditable="true" role="textbox" style="width:400px;height:80px;">
      class Example {\n  // verbose comment to optimize\n  run(x) {\n    return x + 1;\n  }\n}\n${' '.repeat(40)}
    </div>
    <div class="ProseMirror" contenteditable="true" style="width:400px;height:60px;"></div>
    <div class="ql-editor" contenteditable="true" style="width:400px;height:60px;"></div>
  </body></html>`;

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixtureHtml);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
      ],
    });

    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    const extId = new URL(worker.url()).host;
    assert.ok(extId, 'Extension service worker did not initialize');

    const pageErrors = [];
    const page = await context.newPage();
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Verify popup renders cleanly
    await page.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'domcontentloaded' });
    assert.ok((await page.textContent('h2')).includes('Dual-Memory Optimizer'));

    // Verify sidepanel renders & smart compression works
    await page.goto(`chrome-extension://${extId}/sidepanel/sidepanel.html`, { waitUntil: 'domcontentloaded' });
    await page.fill('#rawInput', 'def f():\n    # comment\n    return 1\n');
    await page.click('#btnSmart');
    const outputVal = await page.inputValue('#optimizedOutput');
    assert.ok(outputVal.includes('def f():') && !outputVal.includes('# comment'));

    // Verify secret scrubber button
    await page.fill('#rawInput', 'KEY=AKIAIOSFODNN7EXAMPLE');
    await page.click('#btnScrubSecrets');
    const redactedVal = await page.inputValue('#optimizedOutput');
    assert.ok(redactedVal.includes('[REDACTED_AWS_KEY_1]'));

    // Verify content_injector.js runs cleanly on ChatGPT/Claude/Gemini HTML fixture
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    const injectorSrc = await fs.readFile(path.join(EXT_PATH, 'content', 'content_injector.js'), 'utf8');
    await page.addScriptTag({ content: injectorSrc });
    await page.focus('#prompt-textarea');
    const pillVisible = await page.evaluate(() => {
      const pill = document.getElementById('dual-memory-optimizer-pill');
      return Boolean(pill && pill.style.display === 'flex');
    });
    assert.equal(pillVisible, true, 'Floating pill failed to attach on fixture chatbox');

    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join('; ')}`);
    console.log('[PASS] Dual-Memory Optimizer E2E Canary passed cleanly.');
  } finally {
    if (context) await context.close();
    server.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[FAIL] Dual-Memory Optimizer Canary failed:', err);
  process.exit(1);
});
