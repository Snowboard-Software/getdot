import { createServer } from 'http';
import { execFile } from 'child_process';
import { platform } from 'os';
import { randomBytes } from 'crypto';
import { loadConfig, saveConfig, clearConfig, getServer, DEFAULT_SERVER } from './config.mjs';

/**
 * Open a URL in the default browser (cross-platform, no dependencies).
 */
function openBrowser(url) {
  const os = platform();

  if (os === 'darwin') {
    execFile('open', [url]);
  } else if (os === 'win32') {
    execFile('cmd', ['/c', 'start', '', url]);
  } else {
    execFile('xdg-open', [url]);
  }
}

/**
 * Browser-based login flow:
 * 1. Start local HTTP server on a random port
 * 2. Open browser to Dot's /cli-auth page with port + CSRF state
 * 3. /cli-auth creates a token and redirects to our local callback
 * 4. Save token to config
 */
export async function loginBrowser(serverUrl) {
  const server = serverUrl || getServer();
  const state = randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    let settled = false;

    function finish(err, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      httpServer.close();
      if (err) reject(err);
      else resolve(value);
    }

    const httpServer = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const token = url.searchParams.get('token');
      const returnedState = url.searchParams.get('state');

      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>State mismatch. Please try again.</h2></body></html>');
        finish(new Error('State mismatch'));
        return;
      }

      if (!token) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>No token received. Please try again.</h2></body></html>');
        finish(new Error('No token received'));
        return;
      }

      saveConfig({
        token,
        server,
        created_at: new Date().toISOString(),
      });

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Logged in! You can close this tab and return to your terminal.</h2></body></html>');
      finish(null, token);
    });

    httpServer.listen(0, '127.0.0.1', () => {
      const port = httpServer.address().port;
      const authUrl = `${server}/cli-auth?port=${port}&state=${state}`;
      console.log(`Opening browser to authorize...`);
      console.log(`If the browser doesn't open, visit: ${authUrl}`);
      openBrowser(authUrl);
    });

    const timer = setTimeout(() => {
      finish(new Error('Login timed out after 120 seconds. Please try again.'));
    }, 120_000);
  });
}

/**
 * Manual token login: getdot login --token TOKEN
 */
export function loginToken(token, serverUrl) {
  const server = serverUrl || getServer();
  saveConfig({
    token,
    server,
    created_at: new Date().toISOString(),
  });
}

/**
 * Show login status.
 */
export function showStatus() {
  const config = loadConfig();
  if (!config.token) {
    console.log('Not logged in. Run: getdot login');
    return;
  }

  // Decode JWT payload to show email/org (token format: dot-<jwt>)
  try {
    const jwt = config.token.replace(/^dot-/, '');
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    console.log(`Logged in as: ${payload.sub || payload.user_id}`);
    console.log(`Organization: ${payload.org_id}`);
    if (payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      console.log(`Token expires: ${expDate.toLocaleDateString()}`);
    }
  } catch {
    console.log('Logged in (token present)');
  }

  console.log(`Server: ${config.server || DEFAULT_SERVER}`);
}

/**
 * Logout: clear config.
 */
export function logout() {
  clearConfig();
  console.log('Logged out.');
}
