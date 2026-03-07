/**
 * Unit tests for the cache module.
 * Run with: node --test tests/cache.test.mjs
 */

import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

const TEST_HOME = join(tmpdir(), `getdot-cache-test-${process.pid}`);
const TEST_CACHE_DIR = join(TEST_HOME, '.cache', 'getdot');

import { execFileSync } from 'child_process';

const __dirname = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const GETDOT = join(__dirname, '..', 'bin', 'getdot.mjs');

function run(args) {
  return execFileSync('node', [GETDOT, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, HOME: TEST_HOME, USERPROFILE: TEST_HOME },
    timeout: 10_000,
  });
}

function runScript(script) {
  return execFileSync('node', ['--input-type=module', '-e', script], {
    encoding: 'utf-8',
    env: { ...process.env, HOME: TEST_HOME, USERPROFILE: TEST_HOME },
    cwd: join(__dirname, '..'),
    timeout: 10_000,
  });
}

describe('Cache module', () => {
  beforeEach(() => {
    mkdirSync(TEST_CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(TEST_HOME, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('getCache returns null for missing entry', () => {
    const out = runScript(`
      import { getCache } from './src/cache.mjs';
      const result = getCache({ server: 'http://test', question: 'hello' });
      console.log(JSON.stringify(result));
    `);
    assert.strictEqual(out.trim(), 'null');
  });

  test('setCache + getCache round-trip', () => {
    const out = runScript(`
      import { getCache, setCache } from './src/cache.mjs';
      const data = { answer: 'Sales were $1.2M', sql: 'SELECT ...' };
      setCache({ server: 'http://test', question: 'sales' }, data);
      const result = getCache({ server: 'http://test', question: 'sales' });
      console.log(JSON.stringify(result));
    `);
    const result = JSON.parse(out.trim());
    assert.strictEqual(result.answer, 'Sales were $1.2M');
  });

  test('cache entries never expire', () => {
    const out = runScript(`
      import { readFileSync, writeFileSync } from 'fs';
      import { join } from 'path';
      import { homedir } from 'os';
      import { getCache, setCache } from './src/cache.mjs';

      setCache({ server: 'http://test', question: 'q' }, { answer: 'old data' });

      // Backdate timestamp to 30 days ago
      const cacheDir = join(homedir(), '.cache', 'getdot');
      const { readdirSync } = await import('fs');
      const files = readdirSync(cacheDir).filter(f => f.startsWith('ask-'));
      for (const f of files) {
        const path = join(cacheDir, f);
        const entry = JSON.parse(readFileSync(path, 'utf-8'));
        entry.timestamp = Date.now() - 30 * 24 * 60 * 60 * 1000;
        writeFileSync(path, JSON.stringify(entry));
      }

      // Should still return the data — no expiry
      const result = getCache({ server: 'http://test', question: 'q' });
      console.log(JSON.stringify(result));
    `);
    const result = JSON.parse(out.trim());
    assert.strictEqual(result.answer, 'old data');
  });

  test('cache differentiates by params', () => {
    const out = runScript(`
      import { getCache, setCache } from './src/cache.mjs';
      setCache({ server: 'http://s1', question: 'q' }, { answer: 'a1' });
      setCache({ server: 'http://s2', question: 'q' }, { answer: 'a2' });
      const r1 = getCache({ server: 'http://s1', question: 'q' });
      const r2 = getCache({ server: 'http://s2', question: 'q' });
      const r3 = getCache({ server: 'http://s3', question: 'q' });
      console.log(JSON.stringify({ r1: r1?.answer, r2: r2?.answer, r3 }));
    `);
    const result = JSON.parse(out.trim());
    assert.strictEqual(result.r1, 'a1');
    assert.strictEqual(result.r2, 'a2');
    assert.strictEqual(result.r3, null);
  });

  test('clearCache removes all entries', () => {
    const out = runScript(`
      import { setCache, clearCache, cacheStats } from './src/cache.mjs';
      setCache({ server: 'http://test', question: 'q1' }, { answer: 'a1' });
      setCache({ server: 'http://test', question: 'q2' }, { answer: 'a2' });
      const before = cacheStats();
      clearCache();
      const after = cacheStats();
      console.log(JSON.stringify({ before: before.entries, after: after.entries }));
    `);
    const result = JSON.parse(out.trim());
    assert.strictEqual(result.before, 2);
    assert.strictEqual(result.after, 0);
  });

  test('cacheStats returns count and size', () => {
    const out = runScript(`
      import { setCache, cacheStats } from './src/cache.mjs';
      setCache({ server: 'http://test', question: 'q' }, { answer: 'test-data' });
      const stats = cacheStats();
      console.log(JSON.stringify(stats));
    `);
    const stats = JSON.parse(out.trim());
    assert.strictEqual(stats.entries, 1);
    assert.ok(stats.size > 0);
  });

  test('cache handles corrupted files gracefully', () => {
    writeFileSync(join(TEST_CACHE_DIR, 'ask-deadbeef12345678.json'), 'NOT JSON{{{');
    const out = runScript(`
      import { getCache } from './src/cache.mjs';
      const result = getCache({ server: 'http://test', question: 'q' });
      console.log(JSON.stringify(result));
    `);
    assert.strictEqual(out.trim(), 'null');
  });

  test('--clear-cache flag works', () => {
    runScript(`
      import { setCache } from './src/cache.mjs';
      setCache({ server: 'http://test', question: 'q' }, { answer: 'a' });
    `);
    const out = run(['--clear-cache']);
    assert.match(out, /Cache cleared/);
    const statsOut = runScript(`
      import { cacheStats } from './src/cache.mjs';
      console.log(JSON.stringify(cacheStats()));
    `);
    assert.strictEqual(JSON.parse(statsOut.trim()).entries, 0);
  });

  test('--help includes cache options', () => {
    const out = run(['--help']);
    assert.match(out, /--no-cache/);
    assert.match(out, /--clear-cache/);
  });
});
