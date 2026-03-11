/**
 * Shared HTTP request utilities — zero dependencies.
 */

import https from 'https';
import http from 'http';
import { writeFileSync } from 'fs';

/**
 * Make an HTTPS/HTTP request using Node built-ins.
 * Returns { status, headers, buffer }.
 */
export function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Make an authenticated API request. Handles auth errors and JSON parsing.
 * Returns the parsed JSON response.
 */
export async function apiRequest(url, options, body) {
  let res;
  try {
    res = await request(url, options, body);
  } catch (err) {
    const server = new URL(url).origin;
    console.error(`Connection failed: ${err.message}`);
    console.error(`Server: ${server}`);
    process.exit(1);
  }

  if (res.status === 401) {
    console.error('Authentication failed. Run: dot login');
    process.exit(1);
  }

  if (res.status >= 400) {
    const text = res.buffer.toString();
    try {
      console.error(`Error: ${JSON.parse(text).detail || text}`);
    } catch {
      console.error(`Error (${res.status}): ${text.slice(0, 500)}`);
    }
    process.exit(1);
  }

  try {
    return JSON.parse(res.buffer.toString());
  } catch {
    console.error('Error: unexpected response format from server.');
    process.exit(1);
  }
}

/**
 * Download a file from a URL to a local path. Follows up to 5 redirects.
 * Auth headers are only sent to the original host, not to redirect targets.
 */
export async function downloadFile(url, destPath, token, maxRedirects = 5) {
  const originalHost = new URL(url).host;

  let currentUrl = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const headers = {};
    if (token && new URL(currentUrl).host === originalHost) {
      headers['X-API-KEY'] = token;
    }
    const res = await request(currentUrl, { method: 'GET', headers });
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const location = res.headers.location;
      currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
      continue;
    }
    if (res.status >= 400) {
      throw new Error(`Download failed (${res.status}): ${currentUrl}`);
    }
    writeFileSync(destPath, res.buffer);
    return;
  }
  throw new Error(`Too many redirects: ${url}`);
}
