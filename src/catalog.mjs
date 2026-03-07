import { getToken, getServer } from './config.mjs';
import { request } from './http.mjs';
import { getCache, setCache, TTL } from './cache.mjs';

/**
 * Fetch and display the org data catalog.
 */
export async function catalog({ noCache = false } = {}) {
  const token = getToken();
  if (!token) {
    console.error('Not authenticated. Run: getdot login');
    process.exit(1);
  }

  const server = getServer();

  // Check cache
  if (!noCache) {
    const cached = getCache('catalog', { server }, TTL.catalog);
    if (cached) {
      formatCatalog(cached, server);
      return;
    }
  }

  let res;
  try {
    res = await request(`${server}/api/cli/catalog`, {
      method: 'GET',
      headers: { 'X-API-KEY': token, 'X-Requested-With': 'XMLHttpRequest' },
    });
  } catch (err) {
    console.error(`Connection failed: ${err.message}`);
    console.error(`Server: ${server}`);
    process.exit(1);
  }

  if (res.status === 401) {
    console.error('Authentication failed. Run: getdot login');
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

  let data;
  try {
    data = JSON.parse(res.buffer.toString());
  } catch {
    console.error('Error: unexpected response format from server.');
    process.exit(1);
  }

  // Cache the response
  setCache('catalog', { server }, data);

  formatCatalog(data, server);
}

function formatNumber(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCatalog(data, server) {
  const lines = [];

  lines.push(`Dot Data Catalog — ${data.org_id}`);
  lines.push(`Server: ${server}`);
  lines.push('');

  if (data.capabilities && data.capabilities.length > 0) {
    lines.push(`Capabilities: ${data.capabilities.join(', ')}`);
  }

  if (data.custom_skills && data.custom_skills.length > 0) {
    const names = data.custom_skills.map(s => s.name || s).join(', ');
    lines.push(`Custom Skills: ${names}`);
  }

  if (data.capabilities || data.custom_skills) lines.push('');

  const connections = data.connections || [];
  if (connections.length > 0) {
    lines.push(`Data Sources (${connections.length} connection${connections.length !== 1 ? 's' : ''}):`);
    for (const conn of connections) {
      const count = conn.table_count != null ? ` — ${conn.table_count} tables` : '';
      lines.push(`  ${conn.id} (${conn.type})${count}`);
    }
    lines.push('');
  }

  const tables = data.tables || [];
  const total = data.total_tables || tables.length;
  if (tables.length > 0) {
    const showing = tables.length < total ? `, showing top ${tables.length}` : '';
    lines.push(`Tables (${total} active${showing}):`);
    for (const t of tables) {
      const cols = t.column_count != null ? `${t.column_count} cols` : null;
      const rows = formatNumber(t.num_rows);
      const meta = [cols, rows ? `${rows} rows` : null].filter(Boolean).join(', ');
      const metaStr = meta ? ` (${meta})` : '';
      const desc = t.description ? ` — ${t.description}` : '';
      lines.push(`  ${t.name || t.id}${desc}${metaStr}`);
    }
    lines.push('');
  }

  const assets = data.external_assets || {};
  const assetEntries = Object.entries(assets);
  if (assetEntries.length > 0) {
    const parts = assetEntries.map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`);
    lines.push(`External Assets: ${parts.join(', ')}`);
    lines.push('');
  }

  lines.push('Tip: getdot "What were total sales last month?"');

  console.log(lines.join('\n'));
}
