import { mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { requireAuth } from './config.mjs';
import { apiRequest, downloadFile } from './http.mjs';
import { getCache, setCache } from './cache.mjs';

/**
 * Ask Dot a question via the agentic endpoint.
 */
export async function ask(question, chatId, { noCache = false } = {}) {
  const { token, server } = requireAuth();
  const id = chatId || `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const userHash = createHash('sha256').update(token).digest('hex').slice(0, 8);

  // Check cache (only for new conversations -- follow-ups with --chat always go to server)
  if (!noCache && !chatId) {
    const cached = getCache({ server, question, user: userHash });
    if (cached) {
      formatOutput(cached.message, cached.downloadedFiles, cached.chatId, cached.additionalData);
      return;
    }
  }

  const result = await apiRequest(
    `${server}/api/agentic`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': token,
        'X-Response-Format': 'cli',
        'X-Requested-With': 'XMLHttpRequest',
      },
    },
    JSON.stringify({
      messages: [{ role: 'user', content: question }],
      chat_id: id,
      skip_check: !!chatId,
    }),
  );

  if (!Array.isArray(result)) {
    console.error('Error: unexpected response format from server.');
    process.exit(1);
  }

  const lastAssistant = result.findLast(m => m.role === 'assistant');
  if (!lastAssistant) {
    console.error('No response from Dot.');
    process.exit(1);
  }

  const additionalData = lastAssistant.additional_data || {};
  const assets = additionalData.assets || {};
  const rawChatId = additionalData.chat_id || id;
  // Sanitize chat ID to prevent path traversal from malicious server responses
  const actualChatId = rawChatId.replace(/[\/\\\.]+/g, '_').replace(/^_+|_+$/g, '');

  const tempDir = join(tmpdir(), 'dot', actualChatId || 'unknown');
  mkdirSync(tempDir, { recursive: true });

  const downloadedFiles = await downloadAssets(assets, tempDir, token);

  // Cache the response (only for new conversations)
  if (!chatId) {
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
 * Download all assets (charts, CSVs, files) to the temp directory.
 */
async function downloadAssets(assets, tempDir, token) {
  const downloadedFiles = {};

  for (const [key, asset] of Object.entries(assets)) {
    if (!asset || typeof asset !== 'object') continue;

    try {
      if (asset.chart_download_url) {
        const filePath = join(tempDir, `${key}.png`);
        await downloadFile(asset.chart_download_url, filePath, token);
        downloadedFiles[key] = filePath;
      }
      if (asset.csv_download_url) {
        const filePath = join(tempDir, `${key}.csv`);
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

  return downloadedFiles;
}

/**
 * Format and print the response for terminal / Claude Code consumption.
 */
function formatOutput(message, downloadedFiles, chatId, additionalData) {
  const assets = additionalData.assets || {};
  const formattedResult = additionalData.formatted_result || [];
  const lines = [];

  for (const item of formattedResult) {
    const { type, data: ref } = item;

    if (type === 'text') {
      lines.push(ref);
      lines.push('');
    } else if (type === 'dataframe' && ref && assets[ref]) {
      formatDataframe(lines, assets[ref], downloadedFiles[ref]);
    } else if (type === 'chart' && ref && assets[ref]) {
      formatChart(lines, assets[ref], downloadedFiles[ref]);
    } else if (type === 'file' && ref && downloadedFiles[ref]) {
      lines.push(`File saved to: ${downloadedFiles[ref]}`);
    }
  }

  // Fall back to message content if no formatted_result
  if (formattedResult.length === 0 && message.content) {
    lines.push(message.content);
    lines.push('');
  }

  if (additionalData.dot_url) {
    lines.push('');
    lines.push(`Open in Dot: ${additionalData.dot_url}`);
  }
  lines.push(`Use --chat ${chatId} for follow-up questions`);

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

function formatDataframe(lines, asset, filePath) {
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
  if (filePath) {
    lines.push(`Data saved to: ${filePath}`);
  }
}

function formatChart(lines, asset, filePath) {
  if (asset.interpretation) {
    lines.push(asset.interpretation);
    lines.push('');
  }
  if (filePath) {
    lines.push(`Chart saved to: ${filePath}`);
  }
}
