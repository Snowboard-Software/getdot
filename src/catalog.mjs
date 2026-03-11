import { requireAuth } from './config.mjs';
import { apiRequest } from './http.mjs';

/**
 * Fetch and display the org data catalog.
 */
export async function catalog() {
  const { token, server } = requireAuth();

  const data = await apiRequest(`${server}/api/cli/catalog`, {
    method: 'GET',
    headers: { 'X-API-KEY': token, 'X-Requested-With': 'XMLHttpRequest' },
  });

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

  const assetEntries = Object.entries(data.external_assets || {});
  if (assetEntries.length > 0) {
    const parts = assetEntries.map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`);
    lines.push(`External Assets: ${parts.join(', ')}`);
    lines.push('');
  }

  lines.push('Tip: dot "What were total sales last month?"');

  console.log(lines.join('\n'));
}
