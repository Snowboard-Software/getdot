/**
 * Local file-based response cache for getdot CLI.
 *
 * Cache location: ~/.cache/getdot/
 * Each entry is a JSON file keyed by SHA-256 hash of the request.
 * TTL is per-entry and checked on read.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const CACHE_DIR = join(homedir(), '.cache', 'getdot');

// TTLs in milliseconds
export const TTL = {
  catalog: 60 * 60 * 1000,  // 1 hour
  ask: 5 * 60 * 1000,       // 5 minutes
};

function ensureCacheDir() {
  mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Generate a cache key from a category + params object.
 */
function cacheKey(category, params) {
  const hash = createHash('sha256')
    .update(JSON.stringify({ category, ...params }))
    .digest('hex')
    .slice(0, 16);
  return `${category}-${hash}`;
}

/**
 * Get a cached entry if it exists and hasn't expired.
 * Returns the cached data or null.
 */
export function getCache(category, params, ttl) {
  try {
    const key = cacheKey(category, params);
    const filePath = join(CACHE_DIR, `${key}.json`);
    const raw = readFileSync(filePath, 'utf-8');
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > ttl) {
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Store data in the cache.
 */
export function setCache(category, params, data) {
  try {
    ensureCacheDir();
    const key = cacheKey(category, params);
    const filePath = join(CACHE_DIR, `${key}.json`);
    const entry = { timestamp: Date.now(), category, data };
    writeFileSync(filePath, JSON.stringify(entry));
  } catch {
    // Non-fatal: cache write failures shouldn't break the CLI
  }
}

/**
 * Clear all cached entries, or just a specific category.
 */
export function clearCache(category) {
  try {
    if (!category) {
      rmSync(CACHE_DIR, { recursive: true, force: true });
      return;
    }
    ensureCacheDir();
    for (const file of readdirSync(CACHE_DIR)) {
      if (file.startsWith(`${category}-`)) {
        rmSync(join(CACHE_DIR, file), { force: true });
      }
    }
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
