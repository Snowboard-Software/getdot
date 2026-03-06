# getdot

Query your company data from the terminal using [Dot](https://getdot.ai), your AI data analyst.

Dot writes SQL, runs queries, generates charts, and explains results — all from your terminal, Claude Code, or Cursor.

## Install

```bash
npm install -g getdot
```

Requires Node.js 18+. Zero dependencies.

## Quick Start

```bash
# Login (opens browser)
getdot login

# Ask a question
getdot "What were total sales last month?"

# Follow up
getdot "Break down by region" --chat cli-m1abc2d-x4y5z6
```

## Usage

```
getdot "your question"                # Ask a data question
getdot "follow up" --chat <id>        # Continue a conversation
getdot login                          # Browser-based login
getdot login --token <TOKEN>          # Manual token login
getdot login --server <URL>           # Custom Dot server
getdot status                         # Show login status
getdot logout                         # Clear credentials
```

## Output

Every response includes:

- **Text explanation** — natural language answer
- **SQL query** — the exact query that was executed
- **Data preview** — first rows with column statistics
- **Chart** — saved as PNG to `/tmp/getdot/<chat-id>/` (Claude Code can read these)
- **CSV data** — full dataset saved locally
- **Dot URL** — link to full interactive analysis in the browser
- **Follow-up suggestions** — related questions you might want to ask

### Example Output

```
Sales were $1.2M last month, up 15% from January.

SQL Query:
  SELECT date_trunc('month', order_date) as month, SUM(amount) as total
  FROM orders WHERE order_date >= '2026-02-01' GROUP BY 1 ORDER BY 1

Data (30 rows x 3 columns):
  date, total, region
  2026-02-01, 45230.50, US
  2026-02-02, 38120.00, US
  ...

Chart saved to: /tmp/getdot/abc123/viz_monthly_sales.png
Data saved to: /tmp/getdot/abc123/df_revenue.csv

Open in Dot: https://app.getdot.ai/?c=abc123
Use --chat abc123 for follow-up questions

Suggested follow-ups:
  - Break down by region
  - Compare to last year
```

## AI Editor Integration

### Claude Code

Add the skill to Claude Code so it automatically uses Dot for data questions:

```bash
mkdir -p ~/.claude/skills/getdot
cp node_modules/getdot/SKILL.md ~/.claude/skills/getdot/SKILL.md
```

Then just ask Claude Code data questions naturally — it will use `getdot` via Bash.

### Cursor

Place `SKILL.md` in your project's `.cursor/skills/` directory:

```bash
mkdir -p .cursor/skills
cp node_modules/getdot/SKILL.md .cursor/skills/getdot.md
```

## Authentication

### Browser Login (recommended)

```bash
getdot login
```

Opens your browser to Dot, authenticates, and saves a token locally.

### Manual Token

Generate an API token from your Dot profile page, then:

```bash
getdot login --token dot-eyJhbGci...
```

### Custom Server

```bash
getdot login --server https://eu.getdot.ai
```

Tokens are stored in `~/.config/getdot/config.json` with `600` permissions.

## How It Works

1. `getdot` sends your question to Dot's agentic API endpoint
2. Dot writes SQL, executes it against your connected databases, and generates charts
3. The response comes back with text previews (not raw data) and download URLs
4. `getdot` downloads charts and CSVs to temp files locally
5. Output is formatted for both human reading and AI editor consumption

Your data stays secure — Dot enforces the same permissions as the web UI.

## License

MIT
