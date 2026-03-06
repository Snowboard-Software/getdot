---
name: getdot
description: >
  Query company data using Dot, an AI data analyst with access to your
  databases. Use when users ask about data, metrics, KPIs, reports, SQL,
  dashboards, or say "ask dot" or "check the numbers".
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

## How to use

Run `getdot` via Bash with the question in quotes:

```bash
getdot "What were total sales last month?"
```

### Follow-up questions

Every response includes a chat ID. Use `--chat` to continue the conversation:

```bash
getdot "Now break down by region" --chat cli-m1abc2d-x4y5z6
```

### Output format

The output includes:
- **Text explanation** — natural language answer to the question
- **SQL query** — the exact SQL that was executed
- **Data preview** — first rows as CSV-like text with column stats
- **Chart** — saved as PNG to a local temp path (you can read it — you're multimodal)
- **CSV data** — saved locally for further analysis
- **Dot URL** — link to the full interactive analysis in the browser
- **Suggested follow-ups** — use these proactively if relevant

### Reading output files

Charts are saved as PNG files to `/tmp/getdot/<chat-id>/`. You can read these
files directly since you have multimodal capabilities. CSV files are also saved
there and can be parsed for further analysis.

### Tips for good questions

- Be specific: include metric names, time periods, filters
- One question at a time works best
- Use follow-ups (`--chat`) to refine rather than asking compound questions
- If you need a chart, say "show me a chart of..." or "visualize..."

### Error: not authenticated

If you get "Not authenticated", tell the user to run:

```bash
npm install -g getdot
getdot login
```

### Examples

```bash
# Simple question
getdot "What were total sales last month?"

# With follow-up
getdot "Compare to the same period last year" --chat cli-m1abc2d-x4y5z6

# Chart request
getdot "Show me a chart of monthly revenue trend for the past 12 months"

# Specific filters
getdot "Top 10 customers by order count in Q4 2025, US only"
```
