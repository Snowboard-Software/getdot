---
name: getdot
description: >
  Query company data using Dot, an AI data analyst with access to your
  databases. Use when users ask about data, metrics, KPIs, reports, SQL,
  dashboards, or say "ask dot" or "check the numbers".
compatibility: Requires getdot CLI binary installed and authenticated
metadata:
  author: Snowboard-Software
  version: "0.1.0"
---

# getdot — AI Data Analyst CLI

`getdot` lets you query your company's databases through Dot, an AI data analyst.
Dot writes SQL, runs queries, generates charts, and explains results.

## When to use

Use `getdot` when the user asks about:
- Data questions: "What were sales last month?", "Show me top customers"
- Metrics and KPIs: "What's our churn rate?", "Revenue by region"
- SQL queries: "Write a query to find...", "Check the database for..."
- Reports: "Generate a summary of...", "Break down..."
- Any time they say "ask dot", "check the numbers", or "query the data"

## Decision: catalog vs ask

- If the user asks WHAT data is available, run `getdot catalog`
- If the question is vague (no specific metric, table, or time period), run `getdot catalog` first to understand what's available, then ask a targeted question
- If the user asks a specific data question, go straight to `getdot "..."`

## How to use

### Discover available data first

Before asking questions, run `getdot catalog` to see what data is available:

```bash
getdot catalog
```

This returns instantly (no LLM call) and shows:
- Available capabilities (SQL, visualizations, scheduled reports, text analysis)
- Custom skills configured for the org
- Data source connections with table counts
- Top 50 tables sorted by usage, with descriptions and column/row counts
- External assets (Looker dashboards, etc.)

### Ask questions

Run `getdot` via Bash with the question in quotes. Set a generous timeout — Dot runs a full AI analysis pipeline (SQL generation, execution, visualization) which takes 15-60 seconds, sometimes up to 2 minutes for complex queries:

```bash
getdot "What were total sales last month?"
```

### Follow-up questions

Every response includes a chat ID. Use `--chat` to continue the conversation:

```bash
getdot "Now break down by region" --chat cli-m1abc2d-x4y5z6
```

### When to bypass cache

Responses are cached permanently. Use `--no-cache` when:
- The question involves "today", "right now", "latest", or "current"
- The user says "refresh", "update", or "re-run"
- The user seems unsatisfied with a previous answer

```bash
getdot "What are today's sales numbers?" --no-cache
```

### After receiving a response

1. Parse the output text and present the explanation to the user
2. If a chart PNG path is shown ("Chart saved to: /tmp/getdot/...png"), READ the PNG file — you have multimodal capabilities and can describe what the chart shows
3. If a CSV path is shown and the user needs detailed analysis, read and analyze the CSV data
4. Present suggested follow-ups if they seem relevant to the user's goal
5. If the user wants to continue, use `--chat` with the chat ID from the output

### Output format

The output includes:
- **Text explanation** — natural language answer to the question
- **SQL query** — the exact SQL that was executed
- **Data preview** — first rows as CSV-like text with column stats
- **Chart** — saved as PNG to `/tmp/getdot/<chat-id>/` (read it — you're multimodal)
- **CSV data** — saved locally for further analysis
- **Dot URL** — link to the full interactive analysis in the browser
- **Suggested follow-ups** — use these proactively if relevant

### Multi-step analysis

You can orchestrate multi-step data analysis:
1. Run `getdot catalog` to understand available data
2. Ask an initial question with `getdot "..."`
3. Read the CSV output for deeper analysis or custom calculations
4. Ask follow-up questions using `--chat` to refine results
5. Compare results across multiple queries

### Caching

- `getdot "question"` — cached forever until `--clear-cache`
- Follow-ups with `--chat` are never cached (always fresh)
- `getdot catalog` is never cached (already fast, no LLM)

Use `--no-cache` to force a fresh request, or `--clear-cache` to wipe all cached data.

### Tips for good questions

- Start with `getdot catalog` to understand what tables and data are available
- Be specific: include metric names, time periods, filters
- One question at a time works best
- Use follow-ups (`--chat`) to refine rather than asking compound questions
- If you need a chart, say "show me a chart of..." or "visualize..."

### Error: command not found

If `getdot` is not found, tell the user to install it:

```bash
curl -fsSL https://app.getdot.ai/install.sh | sh
getdot login
```

### Error: Not authenticated

If you get "Not authenticated", the user needs to log in:

```bash
getdot login
```

### Error: Authentication failed

If you get "Authentication failed", the token may have expired. The user needs to re-login:

```bash
getdot login
```

### Error: Connection failed

If getdot can't reach the server, tell the user to check their internet connection.
If using a custom server, verify the URL with `getdot status`.

### Debugging

Run `getdot status` to check who is logged in, which server is configured, and whether the token is expired.

### Examples

```bash
# See what data is available
getdot catalog

# Simple question
getdot "What were total sales last month?"

# With follow-up
getdot "Compare to the same period last year" --chat cli-m1abc2d-x4y5z6

# Chart request
getdot "Show me a chart of monthly revenue trend for the past 12 months"

# Specific filters
getdot "Top 10 customers by order count in Q4 2025, US only"

# Force fresh answer (bypass cache)
getdot "What were total sales last month?" --no-cache
```
