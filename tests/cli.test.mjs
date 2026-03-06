/**
 * Unit tests for getdot CLI.
 * Run with: node --test tests/cli.test.mjs
 *
 * These tests run without network access — they test arg parsing,
 * config management, login/logout, and output formatting.
 */

import { execFileSync, execFile } from 'child_process';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

const GETDOT = join(import.meta.dirname, '..', 'bin', 'getdot.mjs');

// Use an isolated HOME so we don't touch real config
const TEST_HOME = join(tmpdir(), `getdot-test-${process.pid}`);
const TEST_CONFIG_DIR = join(TEST_HOME, '.config', 'getdot');
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, 'config.json');

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

function readConfig() {
  try {
    return JSON.parse(readFileSync(TEST_CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────

describe('getdot CLI', () => {
  beforeEach(() => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    // Clean config between tests
    try { rmSync(TEST_CONFIG_PATH); } catch { /* ignore */ }
  });

  afterEach(() => {
    try { rmSync(TEST_HOME, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ── Help ──

  test('--help shows usage', () => {
    const out = run(['--help']);
    assert.match(out, /Usage:/);
    assert.match(out, /getdot login/);
    assert.match(out, /--chat/);
    assert.match(out, /--token/);
  });

  test('-h is alias for --help', () => {
    const out = run(['-h']);
    assert.match(out, /Usage:/);
  });

  test('no args shows help', () => {
    const out = run([]);
    assert.match(out, /Usage:/);
  });

  // ── Status (not logged in) ──

  test('status when not logged in', () => {
    const out = run(['status']);
    assert.match(out, /Not logged in/);
  });

  // ── Login with token ──

  test('login --token saves config', () => {
    // Use a fake but structurally valid JWT
    const fakeToken = 'dot-eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGNvLmNvbSIsIm9yZ19pZCI6InRlc3Qub3JnIiwiZXhwIjoxOTAwMDAwMDAwfQ.fake';
    run(['login', '--token', fakeToken]);

    const config = readConfig();
    assert.strictEqual(config.token, fakeToken);
    assert.strictEqual(config.server, 'https://app.getdot.ai');
    assert.ok(config.created_at);
  });

  test('login --token --server saves custom server', () => {
    const fakeToken = 'dot-test123';
    run(['login', '--token', fakeToken, '--server', 'https://eu.getdot.ai']);

    const config = readConfig();
    assert.strictEqual(config.token, fakeToken);
    assert.strictEqual(config.server, 'https://eu.getdot.ai');
  });

  // ── Status (logged in) ──

  test('status shows decoded JWT info', () => {
    const fakeToken = 'dot-eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyQGNvbXBhbnkuY29tIiwib3JnX2lkIjoiY29tcGFueS5jb20iLCJleHAiOjE5MDAwMDAwMDB9.fake';
    run(['login', '--token', fakeToken]);

    const out = run(['status']);
    assert.match(out, /user@company\.com/);
    assert.match(out, /company\.com/);
    assert.match(out, /Token expires:/);
  });

  test('status shows server', () => {
    run(['login', '--token', 'dot-test', '--server', 'https://custom.getdot.ai']);
    const out = run(['status']);
    assert.match(out, /custom\.getdot\.ai/);
  });

  // ── Logout ──

  test('logout clears config', () => {
    run(['login', '--token', 'dot-test123']);
    assert.ok(readConfig().token);

    run(['logout']);
    const out = run(['status']);
    assert.match(out, /Not logged in/);
  });

  // ── Ask (unauthenticated) ──

  test('ask without login shows auth error', () => {
    const err = runExpectFail(['"What were sales?"']);
    assert.match(err, /Not authenticated/);
  });

  // ── Arg parsing ──

  test('multi-word question joined', () => {
    // This will fail with auth error but that's fine —
    // we're testing that the arg parsing doesn't crash
    const err = runExpectFail(['What', 'were', 'total', 'sales']);
    assert.match(err, /Not authenticated/);
  });

  test('--chat flag parsed correctly', () => {
    run(['login', '--token', 'dot-test']);
    // Will fail connecting but proves --chat doesn't crash arg parsing
    const err = runExpectFail(['"follow up"', '--chat', 'abc123']);
    // Should try to connect (not show help or arg parse error)
    assert.ok(!err.includes('Usage:'));
  });
});
