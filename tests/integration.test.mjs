/**
 * Integration tests for getdot CLI against a live Dot server.
 * Run with: GETDOT_TEST_TOKEN=dot-... node --test tests/integration.test.mjs
 *
 * These tests require a valid API token and server. They're skipped
 * in CI unless GETDOT_TEST_TOKEN is set.
 *
 * Set GETDOT_TEST_SERVER to override the default (https://app.getdot.ai).
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';

const TOKEN = process.env.GETDOT_TEST_TOKEN;
const SERVER = process.env.GETDOT_TEST_SERVER || 'https://app.getdot.ai';
const GETDOT = join(import.meta.dirname, '..', 'bin', 'getdot.mjs');
const TEST_HOME = join(tmpdir(), `getdot-integ-${process.pid}`);

function run(args) {
  return execFileSync('node', [GETDOT, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, HOME: TEST_HOME, USERPROFILE: TEST_HOME },
    timeout: 300_000, // 5 min for agentic responses
  });
}

describe('getdot integration', { skip: !TOKEN ? 'GETDOT_TEST_TOKEN not set' : false }, () => {
  before(() => {
    mkdirSync(join(TEST_HOME, '.config', 'getdot'), { recursive: true });
    run(['login', '--token', TOKEN, '--server', SERVER]);
  });

  after(() => {
    try { rmSync(TEST_HOME, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('status shows authenticated user', () => {
    const out = run(['status']);
    assert.match(out, /Logged in as:/);
    assert.match(out, /Organization:/);
  });

  test('simple question returns answer with dot URL', () => {
    const out = run(['"What data sources do you have?"']);
    assert.match(out, /Open in Dot:/);
    assert.match(out, /Use --chat/);
  });

  test('question returns follow-up chat ID', () => {
    const out = run(['"How many tables are connected?"']);
    const chatMatch = out.match(/Use --chat (\S+)/);
    assert.ok(chatMatch, 'Output should include chat ID for follow-ups');
    assert.ok(chatMatch[1].length > 5, 'Chat ID should be non-trivial');
  });

  test('follow-up with --chat continues conversation', () => {
    const out1 = run(['"What tables do you have?"']);
    const chatMatch = out1.match(/Use --chat (\S+)/);
    assert.ok(chatMatch, 'First response should include chat ID');

    const out2 = run(['"Tell me more about the first one"', '--chat', chatMatch[1]]);
    assert.match(out2, /Open in Dot:/);
  });

  test('data question includes SQL and preview', () => {
    const out = run(['"Show me 5 rows from any table"']);
    // At minimum we should get an answer with the Dot URL
    assert.match(out, /Open in Dot:/);
    // If it ran SQL, we should see query or data
    // (not asserting SQL specifically since some orgs might not have tables)
  });

  test('chart question downloads PNG', { skip: 'Requires org with data' }, () => {
    const out = run(['"Show me a chart of any metric over time"']);
    const pngMatch = out.match(/Chart saved to: (.+\.png)/);
    if (pngMatch) {
      assert.ok(existsSync(pngMatch[1]), 'PNG file should exist on disk');
      const content = readFileSync(pngMatch[1]);
      assert.ok(content.length > 100, 'PNG should not be empty');
      // Verify PNG magic bytes
      assert.strictEqual(content[0], 0x89);
      assert.strictEqual(content[1], 0x50); // P
    }
  });

  test('CSV download works', { skip: 'Requires org with data' }, () => {
    const out = run(['"Show me the top 10 rows from any table"']);
    const csvMatch = out.match(/Data saved to: (.+\.csv)/);
    if (csvMatch) {
      assert.ok(existsSync(csvMatch[1]), 'CSV file should exist on disk');
      const content = readFileSync(csvMatch[1], 'utf-8');
      assert.ok(content.includes(','), 'CSV should contain commas');
      const lines = content.trim().split('\n');
      assert.ok(lines.length >= 2, 'CSV should have header + at least 1 row');
    }
  });
});
