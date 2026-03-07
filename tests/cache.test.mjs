/**
 * Unit tests for the cache module.
 * Run with: node --test tests/cache.test.mjs
 */

import { mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// Override HOME before importing cache module so it uses our test directory
const TEST_HOME = join(tmpdir(), `getdot-cache-test-${process.pid}`);
const TEST_CACHE_DIR = join(TEST_HOME, '.cache', 'getdot');

// We'll test by running the CLI with isolated HOME, and also by directly testing the module
// via child process (since the module reads HOME at import time)

import { execFileSync } from 'child_process';

const __dirname = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const GETDOT = join(__dirname, '..', 'bin', 'getdot.mjs');

function run(args, opts = {}) {
  return execFileSync('node', [GETDOT, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, HOME: TEST_HOME, USERPROFILE: TEST_HOME },
    timeout: 10_000,
    ...opts,
  });
}

function runExpectFail(args) {
  try {
    run(args);
    assert.fail('Expected command to fail');
  } catch (e) {
    return e.stderr || e.stdout || '';
  }
}

// Run a node script with isolated HOME for direct module testing
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
      import { getCache, TTL } from './src/cache.mjs';
      const result = getCache('catalog', { server: 'http://test' }, TTL.catalog);
      console.log(JSON.stringify(result));
    `);
    assert.strictEqual(out.trim(), 'null');
  });

  test('setCache + getCache round-trip', () => {
    const out = runScript(`
      import { getCache, setCache, TTL } from './src/cache.mjs';
      const data = { org_id: 'test', tables: [{ name: 'orders' }] };
      setCache('catalog', { server: 'http://test' }, data);
      const result = getCache('catalog', { server: 'http://test' }, TTL.catalog);
      console.log(JSON.stringify(result));
    `);
    const result = JSON.parse(out.trim());
    assert.strictEqual(result.org_id, 'test');
    assert.strictEqual(result.tables[0].name, 'orders');
  });

  test('cache respects TTL — expired entries return null', () => {
    // Write a cache entry with a timestamp in the past by manipulating the file directly
    const out = runScript(`
      import { readFileSync, writeFileSync, mkdirSync } from 'fs';
      import { join } from 'path';
      import { homedir } from 'os';
      import { getCache, setCache, TTL } from './src/cache.mjs';

      // Write entry, then backdate its timestamp
      setCache('catalog', { server: 'http://test' }, { org_id: 'test' });

      const cacheDir = join(homedir(), '.cache', 'getdot');
      const { readdirSync } = await import('fs');
      const files = readdirSync(cacheDir).filter(f => f.startsWith('catalog-'));
      for (const f of files) {
        const path = join(cacheDir, f);
        const entry = JSON.parse(readFileSync(path, 'utf-8'));
        entry.timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
        writeFileSync(path, JSON.stringify(entry));
      }

      // TTL of 1 hour — entry written 2 hours ago should be expired
      const result = getCache('catalog', { server: 'http://test' }, TTL.catalog);
      console.log(JSON.stringify(result));
    `);
    assert.strictEqual(out.trim(), 'null');
  });

  test('cache differentiates by params', () => {
    const out = runScript(`
      import { getCache, setCache, TTL } from './src/cache.mjs';
      setCache('catalog', { server: 'http://server1' }, { org_id: 'org1' });
      setCache('catalog', { server: 'http://server2' }, { org_id: 'org2' });
      const r1 = getCache('catalog', { server: 'http://server1' }, TTL.catalog);
      const r2 = getCache('catalog', { server: 'http://server2' }, TTL.catalog);
      const r3 = getCache('catalog', { server: 'http://server3' }, TTL.catalog);
      console.log(JSON.stringify({ r1: r1?.org_id, r2: r2?.org_id, r3 }));
    `);
    const result = JSON.parse(out.trim());
    assert.strictEqual(result.r1, 'org1');
    assert.strictEqual(result.r2, 'org2');
    assert.strictEqual(result.r3, null);
  });

  test('clearCache removes all entries', () => {
    const out = runScript(`
      import { getCache, setCache, clearCache, cacheStats, TTL } from './src/cache.mjs';
      setCache('catalog', { server: 'http://test' }, { org_id: 'test' });
      setCache('ask', { server: 'http://test', question: 'q' }, { answer: 'a' });
      const before = cacheStats();
      clearCache();
      const after = cacheStats();
      console.log(JSON.stringify({ before: before.entries, after: after.entries }));
    `);
    const result = JSON.parse(out.trim());
    assert.strictEqual(result.before, 2);
    assert.strictEqual(result.after, 0);
  });

  test('clearCache by category removes only that category', () => {
    const out = runScript(`
      import { getCache, setCache, clearCache, cacheStats, TTL } from './src/cache.mjs';
      setCache('catalog', { server: 'http://test' }, { org_id: 'test' });
      setCache('ask', { server: 'http://test', question: 'q' }, { answer: 'a' });
      clearCache('catalog');
      const catalogResult = getCache('catalog', { server: 'http://test' }, TTL.catalog);
      const askResult = getCache('ask', { server: 'http://test', question: 'q' }, TTL.ask);
      console.log(JSON.stringify({ catalog: catalogResult, askHit: askResult !== null }));
    `);
    const result = JSON.parse(out.trim());
    assert.strictEqual(result.catalog, null);
    assert.strictEqual(result.askHit, true);
  });

  test('cacheStats returns count and size', () => {
    const out = runScript(`
      import { setCache, cacheStats } from './src/cache.mjs';
      setCache('catalog', { server: 'http://test' }, { org_id: 'test-data' });
      const stats = cacheStats();
      console.log(JSON.stringify(stats));
    `);
    const stats = JSON.parse(out.trim());
    assert.strictEqual(stats.entries, 1);
    assert.ok(stats.size > 0);
  });

  test('cache handles corrupted files gracefully', () => {
    // Write a corrupted cache file
    writeFileSync(join(TEST_CACHE_DIR, 'catalog-deadbeef12345678.json'), 'NOT JSON{{{');
    const out = runScript(`
      import { getCache, TTL } from './src/cache.mjs';
      const result = getCache('catalog', { server: 'http://test' }, TTL.catalog);
      console.log(JSON.stringify(result));
    `);
    assert.strictEqual(out.trim(), 'null');
  });

  test('--clear-cache flag works', () => {
    // Create some cache
    runScript(`
      import { setCache } from './src/cache.mjs';
      setCache('catalog', { server: 'http://test' }, { org_id: 'test' });
    `);
    const out = run(['--clear-cache']);
    assert.match(out, /Cache cleared/);
    // Verify cache is gone
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
