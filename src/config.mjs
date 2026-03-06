import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.config', 'getdot');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function clearConfig() {
  try {
    writeFileSync(CONFIG_PATH, '{}\n', { mode: 0o600 });
  } catch {
    // ignore
  }
}

export function getToken() {
  return loadConfig().token || null;
}

export function getServer() {
  return loadConfig().server || 'https://app.getdot.ai';
}
