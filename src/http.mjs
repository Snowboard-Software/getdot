/**
 * Shared HTTP request utilities — zero dependencies.
 */

/**
 * Make an HTTPS/HTTP request using Node built-ins.
 * Returns { status, headers, buffer }.
 */
export function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? import('https') : import('http');
    mod.then(({ default: http }) => {
      const req = http.request(url, options, (res) => {
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
    }).catch(reject);
  });
}

/**
 * Download a file from a URL to a local path. Follows up to 5 redirects.
 * Auth headers are only sent to the original host, not to redirect targets.
 */
export async function downloadFile(url, destPath, token, maxRedirects = 5) {
  const { writeFileSync } = await import('fs');
  const originalHost = new URL(url).host;

  let currentUrl = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const headers = {};
    // Only send auth token to the original host, not external redirects
    if (token && new URL(currentUrl).host === originalHost) {
      headers['X-API-KEY'] = token;
    }
    const res = await request(currentUrl, { method: 'GET', headers });
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const location = res.headers.location;
      // Handle relative redirects
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
