import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = join(root, 'plugins/dot');
const manifest = JSON.parse(readFileSync(join(plugin, '.codex-plugin/plugin.json'), 'utf8'));
const mcp = JSON.parse(readFileSync(join(plugin, '.mcp.json'), 'utf8'));
const files = [];
function walk(directory) {
  for (const entry of readdirSync(join(plugin, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported archive entry: ${path}`);
  }
}
walk('.codex-plugin');
walk('skills');
walk('assets');
files.push('.mcp.json');
if (manifest.hooks || manifest.apps || manifest.extensions?.['com.openai']?.hooks || manifest.extensions?.['com.openai']?.apps) {
  throw new Error('Public submissions cannot include hooks or app references');
}
if (Object.keys(mcp.mcpServers).length !== 1 || mcp.mcpServers.dot.url !== 'https://app.getdot.ai/ai/mcp') {
  throw new Error('The directory package must use only the US Dot server');
}
const output = join(root, 'dist', `dot-openai-${manifest.version}.zip`);
mkdirSync(dirname(output), { recursive: true });
rmSync(output, { force: true });
execFileSync('zip', ['-q', '-X', output, ...files.sort()], { cwd: plugin });
console.log(output);
