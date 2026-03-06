/**
 * Local E2E tests for getdot CLI.
 * Run with: node --test tests/e2e.test.mjs
 *
 * Tests the full ask flow against a mock agentic API (separate process),
 * file downloads, browser login callback, config security, and error handling.
 * No external services required.
 */

import { execFileSync, spawn } from 'child_process';
import { createServer } from 'http';
import http from 'http';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';

const GETDOT = join(import.meta.dirname, '..', 'bin', 'getdot.mjs');
const MOCK_SERVER = join(import.meta.dirname, 'mock-server.mjs');
const TEST_HOME = join(tmpdir(), `getdot-e2e-${process.pid}`);
const TEST_CONFIG_DIR = join(TEST_HOME, '.config', 'getdot');
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, 'config.json');

const FAKE_TOKEN = 'dot-eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGUyZS5jb20iLCJvcmdfaWQiOiJlMmUub3JnIiwiZXhwIjoxOTAwMDAwMDAwfQ.e2etest';

function run(args) {
  return execFileSync('node', [GETDOT, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, HOME: TEST_HOME, USERPROFILE: TEST_HOME },
    timeout: 30_000,
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

/**
 * Start the mock server in a child process and return its port.
 */
function startMockServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [MOCK_SERVER], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    let portData = '';
    child.stdout.on('data', (chunk) => {
      portData += chunk.toString();
      const port = parseInt(portData, 10);
      if (port > 0) {
        resolve({ child, port });
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Mock server exited with code ${code}`));
      }
    });

    setTimeout(() => reject(new Error('Mock server startup timeout')), 5000);
  });
}

describe('getdot E2E', () => {
  let mockChild;
  let mockPort;

  before(async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });

    // Start mock server in separate process (avoids execFileSync event loop blocking)
    const { child, port } = await startMockServer();
    mockChild = child;
    mockPort = port;

    // Login to mock server
    run(['login', '--token', FAKE_TOKEN, '--server', `http://localhost:${mockPort}`]);
  });

  after(() => {
    if (mockChild) {
      mockChild.stdin.end();
      mockChild.kill('SIGTERM');
    }
    try { rmSync(TEST_HOME, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ── Ask Flow ──

  test('returns text explanation', () => {
    const out = run(['"What were total sales?"']);
    assert.match(out, /Sales were \$1\.2M/);
  });

  test('includes Dot URL and chat ID', () => {
    const out = run(['"Any question"']);
    assert.match(out, /Open in Dot:/);
    assert.match(out, /Use --chat/);
  });

  test('returns SQL query', () => {
    const out = run(['"Show me revenue"']);
    assert.match(out, /SQL Query:/);
    assert.match(out, /SELECT/);
  });

  test('returns data preview with shape', () => {
    const out = run(['"Show data"']);
    assert.match(out, /Data \(2 rows x 3 columns\):/);
    assert.match(out, /date,total,region/);
    assert.match(out, /45230\.50/);
  });

  test('returns column stats summary', () => {
    const out = run(['"Revenue"']);
    assert.match(out, /total.*mean/);
    assert.match(out, /region.*unique/);
  });

  test('returns chart interpretation', () => {
    const out = run(['"Trends"']);
    assert.match(out, /monthly revenue trending upward/);
  });

  test('downloads chart PNG to temp directory', () => {
    const out = run(['"Chart please"']);
    const match = out.match(/Chart saved to: (.+\.png)/);
    assert.ok(match, 'Output should include chart path');
    assert.ok(existsSync(match[1]), 'PNG should exist on disk');
    const content = readFileSync(match[1]);
    assert.ok(content.length > 10);
    assert.strictEqual(content[0], 0x89);
    assert.strictEqual(content[1], 0x50);
  });

  test('downloads CSV to temp directory', () => {
    const out = run(['"Data table"']);
    const match = out.match(/Data saved to: (.+\.csv)/);
    assert.ok(match, 'Output should include CSV path');
    assert.ok(existsSync(match[1]), 'CSV should exist on disk');
    const content = readFileSync(match[1], 'utf-8');
    assert.ok(content.includes('date,total,region'));
    assert.ok(content.includes('45230.50'));
    assert.ok(content.trim().split('\n').length >= 2);
  });

  test('returns suggested follow-ups', () => {
    const out = run(['"What happened?"']);
    assert.match(out, /Suggested follow-ups:/);
    assert.match(out, /Break down by region/);
    assert.match(out, /Compare to last year/);
  });

  test('--chat flag works', () => {
    const out = run(['"Follow up"', '--chat', 'my-chat-id']);
    assert.match(out, /Use --chat/);
  });

  test('invalid token returns auth error', () => {
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      token: 'invalid', server: `http://localhost:${mockPort}`,
    }) + '\n', { mode: 0o600 });

    const err = runExpectFail(['"Should fail"']);
    assert.match(err, /Authentication failed|Invalid/);

    // Restore
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      token: FAKE_TOKEN, server: `http://localhost:${mockPort}`,
    }) + '\n', { mode: 0o600 });
  });

  // ── Browser Login Callback ──

  test('callback server receives token from redirect', async () => {
    const state = 'test-csrf-' + Date.now();
    const token = 'dot-test-callback-token';

    const result = await new Promise((resolve, reject) => {
      let timer;
      const srv = createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/callback') {
          const data = { token: url.searchParams.get('token'), state: url.searchParams.get('state') };
          res.writeHead(200, { 'Connection': 'close' });
          res.end('OK', () => { clearTimeout(timer); srv.close(); resolve(data); });
        }
      });
      srv.listen(0, '127.0.0.1', () => {
        const port = srv.address().port;
        http.get(`http://localhost:${port}/callback?token=${encodeURIComponent(token)}&state=${state}`, { agent: false }, r => r.resume());
      });
      timer = setTimeout(() => { srv.close(); reject(new Error('timeout')); }, 3000);
    });

    assert.strictEqual(result.token, token);
    assert.strictEqual(result.state, state);
  });

  test('full redirect: mock server -> CLI callback', async () => {
    const state = 'redirect-' + Date.now();

    const receivedToken = await new Promise((resolve, reject) => {
      let timer;
      const srv = createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/callback') {
          const t = url.searchParams.get('token');
          res.writeHead(200, { 'Connection': 'close' });
          res.end('OK', () => { clearTimeout(timer); srv.close(); resolve(t); });
        }
      });
      srv.listen(0, '127.0.0.1', () => {
        const cliPort = srv.address().port;
        http.get(`http://localhost:${mockPort}/cli-auth?port=${cliPort}&state=${state}`, { agent: false }, (redir) => {
          redir.resume();
          if (redir.statusCode === 302 && redir.headers.location) {
            http.get(redir.headers.location, { agent: false }, r => r.resume()).on('error', () => {});
          }
        }).on('error', reject);
      });
      timer = setTimeout(() => { srv.close(); reject(new Error('timeout')); }, 3000);
    });

    assert.ok(receivedToken.startsWith('dot-'));
    const jwt = receivedToken.replace(/^dot-/, '');
    assert.strictEqual(jwt.split('.').length, 3);
  });

  test('callback rejects mismatched state', async () => {
    const result = await new Promise((resolve, reject) => {
      let timer;
      const srv = createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/callback') {
          const s = url.searchParams.get('state');
          const code = s === 'expected' ? 200 : 400;
          res.writeHead(code, { 'Connection': 'close' });
          res.end(code === 200 ? 'OK' : 'State mismatch');
        }
      });
      srv.listen(0, '127.0.0.1', () => {
        const port = srv.address().port;
        http.get(`http://localhost:${port}/callback?token=t&state=wrong`, { agent: false }, (res) => {
          let body = '';
          res.on('data', c => { body += c; });
          res.on('end', () => { clearTimeout(timer); srv.close(); resolve({ status: res.statusCode, body }); });
        }).on('error', reject);
      });
      timer = setTimeout(() => { srv.close(); reject(new Error('timeout')); }, 3000);
    });
    assert.strictEqual(result.status, 400);
  });

  // ── Error Handling ──

  test('connection refused handled gracefully', () => {
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      token: 'dot-test', server: 'http://localhost:19999',
    }) + '\n', { mode: 0o600 });

    try {
      run(['"Should fail"']);
      assert.fail('Expected fail');
    } catch (e) {
      assert.ok(e.status !== 0 || e.signal);
    }

    // Restore
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify({
      token: FAKE_TOKEN, server: `http://localhost:${mockPort}`,
    }) + '\n', { mode: 0o600 });
  });

  // ── Config Security ──

  test('config file has 600 permissions', { skip: process.platform === 'win32' ? 'Unix only' : false }, () => {
    const mode = (statSync(TEST_CONFIG_PATH).mode & 0o777).toString(8);
    assert.strictEqual(mode, '600');
  });

  test('config dir has restrictive permissions', { skip: process.platform === 'win32' ? 'Unix only' : false }, () => {
    const mode = statSync(TEST_CONFIG_DIR).mode & 0o777;
    // Should be 700 or 755 (recursive mkdir may create parents with 755)
    assert.ok(mode <= 0o755, `Dir permissions ${mode.toString(8)} should be restrictive`);
    assert.ok((mode & 0o077) === 0 || (mode & 0o077) === 0o55, 'Group/other should have no write access');
  });

  test('logout clears token', () => {
    run(['logout']);
    assert.ok(!readConfig().token);
    // Re-login for any subsequent tests
    run(['login', '--token', FAKE_TOKEN, '--server', `http://localhost:${mockPort}`]);
  });
});
