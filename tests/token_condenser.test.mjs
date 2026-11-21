import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenCondenser } from '../extension/lib/token_condenser.js';
import { BuiltInAI } from '../extension/lib/builtin_ai.js';

test('estimateTokens calculates bounded positive counts', () => {
  assert.equal(TokenCondenser.estimateTokens(''), 0);
  assert.equal(TokenCondenser.estimateTokens('   \n  '), 0);
  assert.ok(TokenCondenser.estimateTokens('const x = 1;') > 0);
});

test('detectType identifies Python, JS/TS, Go, Rust, C++, SQL, JSON, and StackTraces', () => {
  assert.equal(TokenCondenser.detectType('{"a": [1, 2, 3]}'), 'json');
  assert.equal(
    TokenCondenser.detectType('Traceback (most recent call last):\n  File "app.py", line 10'),
    'stacktrace'
  );
  assert.equal(TokenCondenser.detectType('def run(x: int) -> int:\n    return x'), 'python');
  assert.equal(TokenCondenser.detectType('export async function fetchUser(id: string) {}'), 'javascript');
  assert.equal(TokenCondenser.detectType('package main\nfunc main() {}'), 'go');
  assert.equal(TokenCondenser.detectType('pub fn solve(x: i32) -> i32 { x }'), 'rust');
  assert.equal(TokenCondenser.detectType('#include <vector>\nstd::vector<int> v;'), 'cpp');
  assert.equal(TokenCondenser.detectType('CREATE TABLE users (id INT PRIMARY KEY);'), 'sql');
});

test('stripPython removes docstrings and comments while keeping strings and shebang', () => {
  const py = [
    '#!/usr/bin/env python3',
    'def greet(name):',
    '    """Greets a user."""',
    '    color = "#ff0000"  # hex color',
    '    return f"hi {name} {color}"',
  ].join('\n');

  const out = TokenCondenser.stripPython(py);
  assert.match(out, /^#!\/usr\/bin\/env python3/);
  assert.match(out, /color = "#ff0000"/);
  assert.doesNotMatch(out, /# hex color/);
  assert.doesNotMatch(out, /Greets a user/);
});

test('stripJS preserves URLs and comment-like tokens inside strings & regex literals', () => {
  const js = [
    '// leading file comment',
    'const endpoint = "https://api.example.com/v1/users"; // trailing comment',
    'const pattern = /\\/\\* not a comment \\*\\//g;',
    '/* multi-line',
    '   block comment */',
    'const escaped = "hello \\" // stay intact";',
  ].join('\n');

  const out = TokenCondenser.stripJS(js);
  assert.match(out, /https:\/\/api\.example\.com\/v1\/users/);
  assert.match(out, /const pattern = \/\\\/\\\* not a comment \\\*\\\/\/g;/);
  assert.match(out, /const escaped = "hello \\" \/\/ stay intact";/);
  assert.doesNotMatch(out, /leading file comment/);
  assert.doesNotMatch(out, /trailing comment/);
  assert.doesNotMatch(out, /block comment/);
});

test('extractSignatures preserves Python decorators, multiline defs, and class methods', () => {
  const py = [
    'import os',
    '@dataclass',
    'class Agent:',
    '    name: str',
    '    def run(',
    '        self,',
    '        task: str,',
    '    ) -> bool:',
    '        secret_work = 42',
    '        return True',
  ].join('\n');

  const out = TokenCondenser.extractSignatures(py, 'python');
  assert.match(out, /@dataclass/);
  assert.match(out, /class Agent:/);
  assert.match(out, /name: str/);
  assert.match(out, /def run\(/);
  assert.match(out, /task: str,/);
  assert.match(out, /\.\.\./);
  assert.doesNotMatch(out, /secret_work/);
});

test('extractSignatures preserves TypeScript classes/methods, Go, and Rust signatures', () => {
  const ts = [
    'import type { Request } from "express";',
    'export class Service {',
    '  async handle(req: Request): Promise<void> {',
    '    const internalDetail = 123;',
    '    return;',
    '  }',
    '}',
  ].join('\n');

  const tsOut = TokenCondenser.extractSignatures(ts, 'javascript');
  assert.match(tsOut, /export class Service \{/);
  assert.match(tsOut, /async handle\(req: Request\): Promise<void> \{ \/\* \.\.\. \*\/ \}/);
  assert.doesNotMatch(tsOut, /internalDetail/);

  const go = 'package main\nfunc Compute(x int) int {\n    y := x * 2\n    return y\n}';
  const goOut = TokenCondenser.extractSignatures(go, 'go');
  assert.match(goOut, /func Compute\(x int\) int \{ \/\* \.\.\. \*\/ \}/);
  assert.doesNotMatch(goOut, /y := x/);

  const rust = 'pub fn parse(input: &str) -> bool {\n    let tmp = input.len();\n    tmp > 0\n}';
  const rustOut = TokenCondenser.extractSignatures(rust, 'rust');
  assert.match(rustOut, /pub fn parse\(input: &str\) -> bool \{ \/\* \.\.\. \*\/ \}/);
  assert.doesNotMatch(rustOut, /let tmp/);
});

test('Mixed-prompt fenced-code condenser preserves prose verbatim while shrinking code fences', () => {
  const mixed = [
    'Please fix the race condition in this handler while keeping our latency target < 50ms.',
    '',
    '```python',
    'def handle_request(item_id: int) -> dict:',
    '    """Fetches an item and validates cache."""',
    '    # Very verbose internal comment',
    '    value = item_id * 2',
    '    return {"id": item_id, "value": value}',
    '```',
    '',
    'What should change first?',
  ].join('\n');

  const smartRes = TokenCondenser.optimize(mixed, 'smart');
  assert.match(smartRes.optimizedText, /Please fix the race condition/);
  assert.match(smartRes.optimizedText, /What should change first\?/);
  assert.doesNotMatch(smartRes.optimizedText, /Very verbose internal comment/);

  const sigRes = TokenCondenser.optimize(mixed, 'signatures');
  assert.match(sigRes.optimizedText, /Please fix the race condition/);
  assert.match(sigRes.optimizedText, /def handle_request\(item_id: int\) -> dict:/);
  assert.doesNotMatch(sigRes.optimizedText, /value = item_id \* 2/);
});

test('compressJsonSchema collapses arrays > 3 items cleanly', () => {
  const payload = JSON.stringify({
    users: [
      { id: 1, role: 'admin' },
      { id: 2, role: 'dev' },
      { id: 3, role: 'dev' },
      { id: 4, role: 'viewer' },
      { id: 5, role: 'viewer' },
    ],
  });

  const compact = TokenCondenser.compressJsonSchema(payload);
  const parsed = JSON.parse(compact);
  assert.equal(parsed.users.length, 2);
  assert.deepEqual(parsed.users[0], { id: 1, role: 'admin' });
  assert.match(parsed.users[1], /\(\+4 more items matching schema\)/);
});

test('redactSecrets scrubs AWS, OpenAI/Anthropic, GitHub, JWT, PEM, Bearer, and .env secrets', () => {
  const sample = [
    'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
    'OPENAI_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456',
    'GITHUB=ghp_1234567890abcdefghijklmnopqrstuvwx',
    'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAnFakeSecretKeyData\n-----END RSA PRIVATE KEY-----',
    'DB_PASSWORD="super_secret_password_99"',
  ].join('\n');

  const res = TokenCondenser.redactSecrets(sample);
  assert.ok(res.totalRedacted >= 6);
  assert.doesNotMatch(res.redactedText, /AKIAIOSFODNN7EXAMPLE/);
  assert.doesNotMatch(res.redactedText, /sk-proj-/);
  assert.doesNotMatch(res.redactedText, /ghp_123456/);
  assert.doesNotMatch(res.redactedText, /super_secret_password_99/);
  assert.doesNotMatch(res.redactedText, /MIIEowIBAAKCAQEAnFakeSecretKeyData/);
  assert.match(res.redactedText, /\[REDACTED_AWS_KEY_1\]/);
  assert.match(res.redactedText, /\[REDACTED_GITHUB_TOKEN_1\]/);
});

test('applyTemplate interpolates {{lang}}, {{date}}, and {{selection}} cleanly', () => {
  const out = TokenCondenser.applyTemplate('Review {{lang}} on {{date}}: {{selection}}', {
    lang: 'python',
    date: '2026-11-21',
    selection: 'def foo(): pass',
  });
  assert.equal(out, 'Review python on 2026-11-21: def foo(): pass');
});

test('BuiltInAI.getStatus degrades gracefully in Node environment', async () => {
  const status = await BuiltInAI.getStatus();
  assert.equal(status.supported, false);
  assert.equal(status.summarizer, 'unavailable');
});
