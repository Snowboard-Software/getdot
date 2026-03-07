import { mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { getToken, getServer } from './config.mjs';
import { request, downloadFile } from './http.mjs';
import { getCache, setCache } from './cache.mjs';

/**
 * Ask Dot a question via the agentic endpoint.
 */
export async function ask(question, chatId, { noCache = false } = {}) {
  const token = getToken();
  if (!token) {
    console.error('Not authenticated. Run: getdot login');
    process.exit(1);
  }

  const server = getServer();
  const id = chatId || `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // Check cache (only for new conversations — follow-ups with --chat always go to server)
  if (!noCache && !chatId) {
    const userHash = createHash('sha256').update(token).digest('hex').slice(0, 8);
    const cached = getCache({ server, question, user: userHash });
    if (cached) {
      formatOutput(cached.message, cached.downloadedFiles, cached.chatId, cached.additionalData);
      return;
    }
  }

  const payload = JSON.stringify({
    messages: [{ role: 'user', content: question }],
    chat_id: id,
    skip_check: !!chatId,
  });

  const url = `${server}/api/agentic`;
  let res;
  try {
    res = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': token,
        'X-Response-Format': 'cli',
        'X-Requested-With': 'XMLHttpRequest',
      },
    }, payload);
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
      const err = JSON.parse(text);
      console.error(`Error: ${err.detail || text}`);
    } catch {
      console.error(`Error (${res.status}): ${text.slice(0, 500)}`);
    }
    process.exit(1);
  }

  let result;
  try {
    result = JSON.parse(res.buffer.toString());
  } catch {
    console.error('Error: unexpected response format from server.');
    process.exit(1);
  }

  if (!Array.isArray(result)) {
    console.error('Error: unexpected response format from server.');
    process.exit(1);
  }

  // Find last assistant message
  const lastAssistant = result.findLast(m => m.role === 'assistant');
  if (!lastAssistant) {
    console.error('No response from Dot.');
    process.exit(1);
  }

  const additionalData = lastAssistant.additional_data || {};
  const assets = additionalData.assets || {};

  // Create temp directory for downloads
  const actualChatId = additionalData.chat_id || id;
  const tempDir = join(tmpdir(), 'getdot', actualChatId);
  mkdirSync(tempDir, { recursive: true });

  // Download files
  const downloadedFiles = {};
  for (const [key, asset] of Object.entries(assets)) {
    if (!asset || typeof asset !== 'object') continue;

    try {
      if (asset.chart_download_url) {
        const fileName = `${key}.png`;
        const filePath = join(tempDir, fileName);
        await downloadFile(asset.chart_download_url, filePath);
        downloadedFiles[key] = filePath;
      }
      if (asset.csv_download_url) {
        const fileName = `${key}.csv`;
        const filePath = join(tempDir, fileName);
        await downloadFile(asset.csv_download_url, filePath, token);
        downloadedFiles[key] = filePath;
      }
      if (key.startsWith('file_') && asset.download_url) {
        const rawName = asset.path || key.replace('file_', '');
        const baseName = rawName.split('/').pop().replace(/^\.+/g, '');
        if (baseName) {
          const filePath = join(tempDir, baseName);
          await downloadFile(asset.download_url, filePath, token);
          downloadedFiles[key] = filePath;
        }
      }
    } catch (e) {
      console.error(`Warning: failed to download ${key}: ${e.message}`);
    }
  }

  // Cache the response (only for new conversations)
  if (!chatId) {
    const userHash = createHash('sha256').update(token).digest('hex').slice(0, 8);
    setCache({ server, question, user: userHash }, {
      message: lastAssistant,
      downloadedFiles,
      chatId: actualChatId,
      additionalData,
    });
  }

  formatOutput(lastAssistant, downloadedFiles, actualChatId, additionalData);
}

/**
 * Format and print the response for terminal / Claude Code consumption.
 */
function formatOutput(message, downloadedFiles, chatId, additionalData) {
  const assets = additionalData.assets || {};
  const formattedResult = additionalData.formatted_result || [];
  const lines = [];

  for (const item of formattedResult) {
    const itemType = item.type;
    const ref = item.data;

    if (itemType === 'text') {
      lines.push(ref);
      lines.push('');
    } else if (itemType === 'dataframe' && ref && assets[ref]) {
      const asset = assets[ref];
      if (asset.sql_query) {
        lines.push('SQL Query:');
        lines.push(`  ${asset.sql_query}`);
        lines.push('');
      }
      if (asset.text_preview) {
        const shape = asset.shape;
        const shapeStr = shape ? ` (${shape[0]} rows x ${shape[1]} columns)` : '';
        lines.push(`Data${shapeStr}:`);
        for (const row of asset.text_preview.split('\n')) {
          if (row.trim()) lines.push(`  ${row}`);
        }
        lines.push('');
      }
      if (asset.text_summary) {
        lines.push(`  ${asset.text_summary}`);
        lines.push('');
      }
      if (downloadedFiles[ref]) {
        lines.push(`Data saved to: ${downloadedFiles[ref]}`);
      }
    } else if (itemType === 'chart' && ref && assets[ref]) {
      const asset = assets[ref];
      if (asset.interpretation) {
        lines.push(asset.interpretation);
        lines.push('');
      }
      if (downloadedFiles[ref]) {
        lines.push(`Chart saved to: ${downloadedFiles[ref]}`);
      }
    } else if (itemType === 'file' && ref && assets[ref]) {
      if (downloadedFiles[ref]) {
        lines.push(`File saved to: ${downloadedFiles[ref]}`);
      }
    }
  }

  // If no formatted_result, fall back to message content
  if (formattedResult.length === 0 && message.content) {
    lines.push(message.content);
    lines.push('');
  }

  // Dot URL and follow-up tip
  if (additionalData.dot_url) {
    lines.push('');
    lines.push(`Open in Dot: ${additionalData.dot_url}`);
  }
  lines.push(`Use --chat ${chatId} for follow-up questions`);

  // Suggested follow-ups
  const suggestions = message.suggested_follow_ups;
  if (suggestions && suggestions.length > 0) {
    lines.push('');
    lines.push('Suggested follow-ups:');
    for (const s of suggestions) {
      lines.push(`  - ${s}`);
    }
  }

  console.log(lines.join('\n'));
}
