/**
 * Local file-based response cache for getdot CLI.
 *
 * Cache location: ~/.cache/getdot/
 * Each entry is a JSON file keyed by SHA-256 hash of the request.
 * Entries never expire — use --no-cache or --clear-cache for fresh data.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const CACHE_DIR = join(homedir(), '.cache', 'dot');

function ensureCacheDir() {
  mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Generate a cache key from params.
 */
function cacheKey(params) {
  const hash = createHash('sha256')
    .update(JSON.stringify(params))
    .digest('hex')
    .slice(0, 16);
  return `ask-${hash}`;
}

/**
 * Get a cached entry if it exists.
 * Returns the cached data or null.
 */
export function getCache(params) {
  try {
    const key = cacheKey(params);
    const filePath = join(CACHE_DIR, `${key}.json`);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw).data;
  } catch {
    return null;
  }
}

/**
 * Store data in the cache.
 */
export function setCache(params, data) {
  try {
    ensureCacheDir();
    const key = cacheKey(params);
    const filePath = join(CACHE_DIR, `${key}.json`);
    writeFileSync(filePath, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Non-fatal: cache write failures shouldn't break the CLI
  }
}

/**
 * Clear all cached entries.
 */
export function clearCache() {
  try {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Return cache stats: number of entries, total size.
 */
export function cacheStats() {
  try {
    ensureCacheDir();
    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    let totalSize = 0;
    for (const f of files) {
      totalSize += statSync(join(CACHE_DIR, f)).size;
    }
    return { entries: files.length, size: totalSize };
  } catch {
    return { entries: 0, size: 0 };
  }
}
