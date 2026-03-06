#!/usr/bin/env node

import { ask } from '../src/ask.mjs';
import { catalog } from '../src/catalog.mjs';
import { loginBrowser, loginToken, showStatus, logout } from '../src/login.mjs';

const args = process.argv.slice(2);

// Parse --chat and --server flags
let chatId = null;
let serverUrl = null;
let tokenValue = null;
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--chat' && i + 1 < args.length) {
    chatId = args[++i];
  } else if (args[i] === '--server' && i + 1 < args.length) {
    serverUrl = args[++i];
  } else if (args[i] === '--token' && i + 1 < args.length) {
    tokenValue = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    printHelp();
    process.exit(0);
  } else {
    positional.push(args[i]);
  }
}

const command = positional[0];

if (!command) {
  printHelp();
  process.exit(0);
}

switch (command) {
  case 'login':
    if (tokenValue) {
      loginToken(tokenValue, serverUrl);
      console.log('Token saved. Run "getdot status" to verify.');
    } else {
      try {
        await loginBrowser(serverUrl);
        console.log('Login successful!');
        showStatus();
      } catch (e) {
        console.error(`Login failed: ${e.message}`);
        process.exit(1);
      }
    }
    break;

  case 'logout':
    logout();
    break;

  case 'status':
    showStatus();
    break;

  case 'catalog':
    await catalog();
    break;

  default: {
    // Treat everything as a question
    const question = positional.join(' ');
    await ask(question, chatId);
    break;
  }
}

function printHelp() {
  console.log(`getdot — Query your company data from the terminal

Usage:
  getdot "What were total sales last month?"
  getdot "Filter to US only" --chat <chat-id>
  getdot login                        # Browser-based login
  getdot login --token <TOKEN>        # Manual token login
  getdot login --server <URL>         # Custom server
  getdot catalog                      # Show available data overview
  getdot status                       # Show login status
  getdot logout                       # Clear credentials

Options:
  --chat <id>      Continue a previous conversation
  --server <url>   Custom Dot server URL
  --token <token>  API token for manual login
  -h, --help       Show this help message`);
}
