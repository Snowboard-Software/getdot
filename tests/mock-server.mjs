/**
 * Mock Dot server for E2E testing.
 * Starts on a random port and prints the port to stdout.
 * Stays alive until the parent process signals or stdin closes.
 */

import { createServer } from 'http';

const FAKE_TOKEN = 'dot-eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGUyZS5jb20iLCJvcmdfaWQiOiJlMmUub3JnIiwiZXhwIjoxOTAwMDAwMDAwfQ.e2etest';

// Minimal valid PNG
const CHART_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de' +
  '0000000c4944415478016360f8cf0000000201016598c3460000000049454e44ae426082',
  'hex'
);
const CSV_DATA = 'date,total,region\n2026-02-01,45230.50,US\n2026-02-02,38120.00,EU\n';

const server = createServer((req, res) => {
  res.setHeader('Connection', 'close');
  const url = new URL(req.url, 'http://localhost');

  // Agentic endpoint
  if (url.pathname === '/api/agentic' && req.method === 'POST') {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey === 'invalid') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Invalid API key' }));
      return;
    }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Invalid JSON body' }));
        return;
      }
      const chatId = parsed.chat_id || 'test-chat-123';
      const port = server.address().port;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { role: 'user', content: parsed.messages?.[0]?.content || '' },
        {
          role: 'assistant',
          content: 'Sales were $1.2M last month, up 15% from January.',
          additional_data: {
            formatted_result: [
              { type: 'text', data: 'Sales were $1.2M last month, up 15% from January.' },
              { type: 'dataframe', data: 'df_revenue' },
              { type: 'chart', data: 'viz_monthly_sales' },
            ],
            assets: {
              df_revenue: {
                text_preview: 'date,total,region\n2026-02-01,45230.50,US\n2026-02-02,38120.00,EU',
                text_summary: 'total — mean: 41,675, min: 38,120, max: 45,231 | region — 2 unique',
                shape: [2, 3],
                sql_query: "SELECT date, total, region FROM revenue WHERE date >= '2026-02-01'",
                csv_download_url: `http://127.0.0.1:${port}/api/download_csv?chat_id=${chatId}&df_key=df_revenue`,
              },
              viz_monthly_sales: {
                interpretation: 'This chart shows monthly revenue trending upward.',
                chart_download_url: `http://127.0.0.1:${port}/api/asset/test-token.png`,
              },
            },
            dot_url: `https://app.getdot.ai/?c=${chatId}`,
            chat_id: chatId,
          },
          suggested_follow_ups: ['Break down by region', 'Compare to last year'],
        },
      ]));
    });
    return;
  }

  // Chart PNG
  if (url.pathname.startsWith('/api/asset/') && url.pathname.endsWith('.png')) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(CHART_PNG);
    return;
  }

  // Catalog endpoint
  if (url.pathname === '/api/cli/catalog' && req.method === 'GET') {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey === 'invalid') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Invalid API key' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      org_id: 'e2e.org',
      capabilities: ['SQL queries', 'Visualizations', 'Scheduled reports'],
      custom_skills: [{ name: 'forecast_revenue', description: 'Revenue forecasting' }],
      connections: [
        { id: 'test-snowflake', type: 'snowflake', table_count: 3 },
        { id: 'test-dbt', type: 'dbt', table_count: 2 },
      ],
      tables: [
        { id: 'public.orders', name: 'public.orders', description: 'Order transactions', column_count: 42, num_rows: 1200000, connection_id: 'test-snowflake' },
        { id: 'public.customers', name: 'public.customers', description: 'Customer master data', column_count: 28, num_rows: 50000, connection_id: 'test-snowflake' },
        { id: 'public.products', name: 'public.products', description: 'Product catalog', column_count: 15, num_rows: 2300, connection_id: 'test-snowflake' },
        { id: 'analytics.revenue', name: 'analytics.revenue', description: 'Monthly revenue model', column_count: 8, num_rows: 360, connection_id: 'test-dbt' },
        { id: 'analytics.users', name: 'analytics.users', description: 'Active users model', column_count: 12, num_rows: 45000, connection_id: 'test-dbt' },
      ],
      external_assets: { 'Looker Dashboard': 5, 'Looker Look': 3 },
      total_tables: 5,
    }));
    return;
  }

  // CSV
  if (url.pathname === '/api/download_csv') {
    res.writeHead(200, { 'Content-Type': 'text/csv' });
    res.end(CSV_DATA);
    return;
  }

  // CLI auth redirect
  if (url.pathname === '/cli-auth') {
    const cbPort = url.searchParams.get('port');
    const state = url.searchParams.get('state');
    res.writeHead(302, { Location: `http://127.0.0.1:${cbPort}/callback?token=${encodeURIComponent(FAKE_TOKEN)}&state=${state}` });
    res.end();
    return;
  }

  // Error endpoint for testing
  if (url.pathname === '/api/error') {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: 'Internal server error' }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(0, '127.0.0.1', () => {
  // Print port so parent can read it
  process.stdout.write(String(server.address().port));
});

// Shutdown when parent disconnects
process.stdin.resume();
process.stdin.on('end', () => {
  server.close();
  process.exit(0);
});

// Also handle SIGTERM
process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
