---
name: dot
description: >
  Query company data using Dot, an AI data analyst with access to your
  databases. Ask questions in plain English; Dot finds the right tables,
  writes SQL, and returns answers with charts. Also manages notes, tables,
  dashboards-as-code, and environments through the dot CLI. Use when users
  ask about data, metrics, KPIs, reports, SQL, dashboards, or say "ask
  dot" or "check the numbers".
compatibility: >
  Works in two modes: through the Dot MCP connector (any Claude surface),
  or through the dot CLI (terminals with network access, e.g. Claude Code).
metadata:
  author: Snowboard-Software
---

# Dot: AI data analyst

Dot connects to your company's databases. You ask a question in plain English; Dot finds the right tables, writes SQL, executes it, and returns the answer with charts and data.

## Pick your transport

Two ways to reach Dot. Check in this order:

1. **Dot MCP tools available?** If you can call `ask_dot` / `get_catalog` (the Dot connector), use them: see *Using Dot over MCP*. This is the path on claude.ai, Claude Desktop, and Claude Cowork, where sandboxes usually cannot reach arbitrary servers.
2. **Shell with open network?** (Claude Code, a real terminal): use the `dot` CLI: see *Using the dot CLI*. It covers everything MCP does plus workspace management (tables, notes, dashboards, environments).
3. **Neither works?** Don't fight the sandbox. Tell the user how to wire Dot up, from their Dot profile page ("Use Dot elsewhere"):
   - In Claude: Settings → Connectors → Add custom connector → paste `https://app.getdot.ai/ai/mcp`.
   - In a terminal: `curl https://app.getdot.ai/install | sh`.

A failed install attempt in a sandbox typically dies with `curl: (6) Could not resolve host` or `Failed to fetch latest version`: that means no network egress. The MCP connector is the way in; it does not depend on sandbox egress.

## Using Dot over MCP

Pick the transport silently: the user only needs Dot's answer, not which path you took.

Hosts that render MCP Apps (claude.ai, Claude Desktop) show Dot's work in a live widget: Dot's progress, then its
answer (text, charts, tables, follow-up suggestions the user can click, downloads). The user already sees it there.

**Tools:**

- `ask_dot(question, chat_id?)`: starts Dot's analysis and returns a chat_id at once. Pass the chat_id of an earlier
  answer for a follow-up, or to act on that answer when the user asks: schedule it ("email me this every Monday at
  9"), optionally only when a condition holds, write it up as a PDF or PowerPoint, or file a definition for review.
  Check recipients other than the user with them first.
- `get_result(chat_id)`: waits for the answer server-side (no need to pause first) and returns it as text, with the
  SQL, a data preview and the chart. If it says "Still processing", call it again. Never re-submit while waiting: a
  repeated question is a second, paid run.
- `get_catalog(query?)`: instant and free. With a query it finds the dashboards the user can open, the org's
  definitions, related tables and the user's earlier Dot chats; without one, an overview of the data.
- `show_app(app_id, filters?, tab?)`: shows a published Dot app live in the conversation, by its title or id,
  optionally opened on a slice: `filters={"region": ["EMEA"], "period": {"start": "2026-01-01", "end": null}}`,
  `tab="Pay"`. Its result lists every filter you can set (current value, options) and the tabs; a name or value
  the app does not offer is refused with the valid ones. When the user changes a filter in the widget, you are told.
- `build_app(request, app_id?, chat_id?)`: Dot's app builder makes a new app or changes one, as a draft the user sees
  live and publishes with the widget's button. Never say an app is published unless the user did it.
- `view_app(chat_id? | app?, filters?, tab?)`: renders an app and returns pictures of it with each card's values as
  text (KPIs, chart values, rows), so you can read what it says at a slice ("the median for Canada") or judge its
  design before asking Dot for changes with `build_app`. Takes tens of seconds.

**Writing the reply:** when the widget shows the answer, do not restate it. Give the takeaway in a sentence, then
what Dot cannot: context, implications, caveats, next steps. Quote Dot's numbers exactly when you use them. The user
can ask Dot follow-ups in the widget; if they mention something you have not seen, `get_result` returns Dot's latest
answer.

**Errors:** a result containing `error code:` means that analysis failed: report it rather than polling again.
"Chat not found" means a bad chat id: start a fresh `ask_dot`.

**Limits:** managing tables, notes, environments and dashboards as code needs the CLI.

## Using the dot CLI

### Setup

If `dot` is not found in PATH:

```bash
# macOS/Linux
curl -fsSL https://app.getdot.ai/install | sh
export PATH="$HOME/.local/bin:$PATH"   # current session; new shells get it from your rc file

# Windows
irm https://app.getdot.ai/install.ps1 | iex
```

Then authenticate:

```bash
dot login                                    # Terminal: opens the browser. No terminal: prints a sign-in link
dot login --poll <code>                      # Claim a sign-in link after the user approved it
dot login --token <TOKEN> --server <URL>     # Manual token (headless/CI)
dot status --json                            # Verify: identity, server, live credential check
```

`DOT_API_TOKEN` (+ optional `DOT_API_BASE_URL`) work as env-var alternatives to the saved login, useful in CI.

### Evaluations and CI

Use `dot eval` to check trusted numerical answers. It uses the same evaluation
engine and run history as the web UI. Runs do not change the model or learn from
the questions; creation saves a versioned evaluation file in the selected environment. Read `dot eval --help` for the full command contract.

Set `DOT_ENV=""` for a saved evaluation in Production, or set it to the source
environment ID for a draft. File runs read that source's saved identity/provenance
and test the supplied questions against `--target`, even if the target predates
the definition. Runs by evaluation ID use the saved questions at the target's
commit, so that target must contain the evaluation. Omitted `--target` uses the
active environment or Production. The synced `evaluations/<id>.yaml` model file
has a different schema from CLI suites; use `export` to produce a portable suite.

```bash
dot eval export <evaluation-id> --output suite.json
dot eval validate suite.json
dot eval run suite.json --dry-run --target <environment-id>
dot eval target --target <environment-id> --json
dot eval run suite.json --target <environment-id> \
  --output artifacts/evaluation.json --junit artifacts/evaluation.xml
dot eval compare <baseline-run-id> <candidate-run-id> --json
```

`dot eval validate suite.json` checks the file offline without signing in or
changing it. It reports whether the file has a saved evaluation ID; that does
not verify the saved evaluation or execution permissions. `run --dry-run`
checks the saved evaluation, question set, optional baseline and selected target
commit through read-only requests. It shows the planned gate without starting
a run or consuming evaluation credits. Source provenance, execution permissions
and credits remain submission-time checks. Use `--json` for machine-readable
validation/preflight output; dry-runs do not write JSON/JUnit run reports.

For a new set, `dot eval init suite.json` or `dot eval init --output suite.yaml`
writes an example to replace with reviewed answers. YAML (`.yaml`/`.yml`)
supports comments and multiline questions; `validate`, `create`, and `run`
accept either YAML or JSON with the same schema. Exports and reports remain JSON.
A draft suite needs `name` and nonempty `questions`; each case needs
`question` and `expected_answer` (zero is valid). `create` generates missing
question IDs and persists them. Keep those IDs stable for runs; new questions
added after saving need new unique IDs. Omitted `answer_type`
infers number/currency/percent/date; specify count or ratio explicitly. Tolerance
defaults to 3%, and dates always use 0. Quote formatted values and dates in YAML.
`dot eval create suite.json` (or `suite.yaml`) saves it once and writes the
evaluation and question IDs into the file. Commit that file; future runs use
its questions as an immutable snapshot without editing the saved set. Preserve
source provenance, exact expected values and tolerances when exporting/editing.
Never widen a tolerance or change an expected answer to make a failing run pass.

Runs wait for completion and return exit 0 for a passed release gate, 1 for a
quality failure, and 2 for errors or incomplete evidence. Never treat a completed
run alone as success. `--baseline <run-id>` also rejects newly regressed cases;
the baseline must have the same questions, answers and tolerances. On timeout or
interruption the CLI requests cancellation. A retry of uncertain submission must
reuse the printed `--idempotency-key` with exactly the same request.

CI runs disable CLI auto-updates. The recorded execution profile uses read-only
Economy mode and a recovery nudge when needed; it is not a first-attempt score
for every production agent mode. Numbers are compared with their configured
tolerance; no additional model judge grades correctness.

### Signing in as a coding agent (no browser, one command at a time)

Every command is non-blocking without a terminal: nothing waits on a browser
or asks a question. When credentials are missing or dead:

1. Run `dot login`. It prints a sign-in URL and a poll command, then exits.
2. Show the URL to the user and ask them to open it (any browser, any device)
   and approve.
3. Run the printed `dot login --poll <code>`. Exit 0 = signed in and saved.
   Exit 2 = the user has not approved yet: ask again, then re-poll. Exit 1 =
   the link expired: start over with `dot login`.
4. `dot status --json` confirms: `{"logged_in": true, ..., "server_check": "ok"}`.
   When something is wrong it names the reason (and where one applies, the fix,
   e.g. `"fix": "dot login"`); parse that instead of guessing from prose.

At an interactive terminal, credential problems self-heal: the CLI offers to
open the browser login on the spot and then re-runs your command. In scripts,
CI, and agent sandboxes the errors in the table below are printed instead.

For a manual token (headless/CI): the user generates it in Dot under Profile → Use Dot elsewhere → CLI → "Headless or CI?", then `dot login --token <TOKEN> --server <URL>`.

### Decision tree

```
User asks what data is available?   →  dot catalog
What Dot can do / how to set up X /
how the Dot API works?              →  dot help "question"
User asks a vague question?         →  dot catalog first, then ask targeted question
User asks a specific data question? →  dot "question"
User wants to continue a thread?    →  dot "follow up" --chat <id>
Asked to build/update a dashboard?  →  dot apps pull → edit → push (Dashboards as code)
Asked to test model changes safely? →  dot env create/use (Environments)
dbt column renamed or schema moved? →  dot apps plan → refactor (dbt workflow)
```

### Ask about Dot itself

```bash
dot help "How do I connect Snowflake?"
```

Answers from Dot's product documentation and its HTTP API reference: what Dot can do, whether
something is supported, how a feature or connector is set up, how an endpoint works. It answers
`NOT_IN_DOCS` rather than guessing. When the answer cites API operations it prints where to read
their exact request and response fields.

### Ask a question

```bash
dot "What were total sales last month?"
```

Response time: 15–60 seconds (Dot generates SQL, runs the query, creates a visualization).

**Example output:**

```
There were $1.2M in total sales last month, up 15% from January.

SQL Query:
  SELECT SUM(amount) AS total_sales
  FROM orders
  WHERE order_date >= '2026-02-01' AND order_date < '2026-03-01'

Data (1 rows x 1 columns):
  total_sales
  1,234,567.89

Data saved to: /tmp/dot/cli-m1abc2d-x4y5z6/df_sales.csv
This chart shows monthly sales trending upward over the past 12 months.

Chart saved to: /tmp/dot/cli-m1abc2d-x4y5z6/viz_monthly.png

Open in Dot: https://app.getdot.ai/?c=cli-m1abc2d-x4y5z6
Follow up: dot "Your next question" --chat cli-m1abc2d-x4y5z6

Suggested follow-ups:
  - Break down by region
  - Compare to last year
```

**How to handle the response:**

1. **Text answer**: the first lines are the natural-language answer. Present this to the user.
2. **Chart PNG**: if you see `Chart saved to: <path>`, READ the file. You're multimodal: describe what the chart shows.
3. **CSV / file**: `Data saved to:` and `File saved to:` paths are yours to read for deeper analysis or custom calculations.
4. **Follow up**: `dot "Now break down by region" --chat <id>` continues the conversation; use it for refinements instead of compound questions.
5. **Suggested follow-ups**: offer these proactively when relevant.

### Discover available data

```bash
dot catalog
```

Returns instantly (no LLM call): data source connections with table counts, the top 50 tables with descriptions, and available capabilities. Run it first when the question is vague.

### Workspace management

You can manage what Dot knows and what data it can access: this is how you train Dot to give accurate answers.

**Tables are the foundation.** The most important thing to document per table: granularity (what does one row represent?) and primary key.

```bash
dot tables list [--all]                              # Active tables, grouped by connection
dot tables get <id>                                  # Table details with all columns
dot tables scan <id> [id2 ...] [--concurrency N]     # Refresh samples + descriptions (parallel)
dot tables activate <id> [id2 ...]                   # Flip active flag (run scan first for fresh metadata)
dot tables deactivate <id> [id2 ...]                 # Hide table(s) from Dot
```

First-time activation runs both: `scan` (samples rows, generates descriptions, 10–40s per table) then `activate`. Re-enabling a previously-scanned table needs only `activate`. For semantic layers with many columns, also curate which fields are active.

**Notes teach Dot the business logic**: metric definitions, operating principles, SQL patterns, domain context.

```bash
dot notes list                          # All notes (tree view)
dot notes get <id>
dot notes create <title> [content]      # Also: --file <path>, stdin, --parent <id>, --group <name>
dot notes update <id> [content]         # Also: --title, --file, --group
dot notes delete <id>
dot notes activate <id>                 # Active notes are used by Dot
dot notes deactivate <id>
```

**Coaching the workspace** (when asked to help set Dot up): read the catalog and existing notes, then interview the expert: "How do you define revenue: booked, recognized, or invoiced?", "Filter out internal users by default?" Turn answers into notes with strong language ("Always", "Never", "Only use X when Y"). Before adding a note, read the existing ones and check no two define the same metric differently. When Dot gives a wrong answer, fix the root: wrong table → activate the right one; wrong logic → add the correct definition; missing context → add it.

**Chat history** for reviewing what Dot did: `dot chat <chat-id>` (all messages, SQL, tool calls).

### Dashboards as code (apps)

A Dot app is a dashboard authored as one `.app` file: HTML layout plus `<query>` tags holding natural-language requests. On push the server compiles each request to SQL (an LLM step) and pins the result in a server-owned `.app.lock` sidecar; rendering executes the locked SQL and never calls an LLM. Locally, files live under `apps/`: id `_shared__revenue` maps to `apps/_shared/revenue.app`, personal id `<email>__<name>` to `apps/<email>/<name>.app`. A `.dot-sync.json` next to `apps/` records your last sync per (environment, app); it is per-checkout state, so gitignore it.

The loop:

```bash
dot apps pull _shared__revenue     # writes .app + .app.lock, records the sync baseline (--all for every app)
# edit apps/_shared/revenue.app
dot apps push _shared__revenue     # server builds + activates; prose changes invoke an LLM compile
# → Pushed apps/_shared/revenue.app to Production: build ok
```

If the server changed since your last sync, push refuses before anything builds:

```
Push rejected: _shared__revenue changed on Production since your last sync.
  your base:  2f7a90c11b3d
  server now: 8c4e02aa917f
Fetch latest first: dot apps pull _shared__revenue   (then reapply your edit and push)
Or overwrite the server version: dot apps push _shared__revenue --force
```

Deleted on the server since your sync → push refuses too; `--force` recreates from your copy, or delete your local file to accept the deletion. Pull is guarded the same way: it refuses to clobber local edits you haven't pushed (`dot apps pull <id> --force` discards them).

**Creating a new app**: write the file first, then push the id; the server creates it. `_shared__<name>` needs app-admin rights; `<your-email>__<name>` is always yours. Minimal valid source:

```html
<!doctype html>
<html lang="en">
<head>
  <title>Revenue Operations</title>
  <query name="trend" connection="<connection-id>" lead-table="db.analytics.fct_mrr_monthly">
    Monthly ending MRR trend for the finance review.
  </query>
</head>
<body>
  <h1>Revenue Operations</h1>
  <chart source="trend" type="area"/>
</body>
</html>
```

Maintenance one-liners:

```bash
dot apps validate <id> [--json]      # sqlglot parse + EXPLAIN every locked query; exit 1 naming broken columns
dot apps status <id> [--json|--all]  # lock freshness; "stale (digest)" = lock bytes hand-edited; exit 1 when stale
dot apps resolve <id>                # recompile ONLY stale request queries; layout/copy edits recompile nothing
dot apps bless <id> [query ...]      # accept hand-edited locked SQL: re-gates via EXPLAIN, re-stamps the digest
dot apps preview <id>                # print the app URL (env-aware; --favor-prod for review mode)
dot apps pr --title "..." --body "..."   # commit .app/.app.lock changes, push branch, open PR (--issue ENG-123)
```

**Never hand-edit `.app.lock`.** It is the server-compiled computation; any byte edit breaks its digest and the edit will not serve. Edit the `.app` source and push. If you genuinely must hand-fix SQL, edit the lock and `bless` it.

### Environments (branch, preview, merge)

Environments are git-branch-like copies of the org model (table docs, notes, apps). Production is `main` and read-only for model edits; branch, change, merge back.

```bash
dot env list                                   # All environments
dot env create mrr-policy [--from <id|name>]   # Branch the model
dot env use mrr-policy                         # Scope later commands to it (saved per-user)
dot env current                                # What's active now (also: show <id>, rename, delete --confirm)
dot env unset                                  # Back to Production
```

Scoping: the active environment scopes every workspace-management request. Override with `--env <id>` or `DOT_ENV` in the shell (`DOT_ENV=` empty forces Production for one command). **`--env` placement: only `dot apps` accepts it after the subcommand.** For everything else put it before the subcommand or use `DOT_ENV`. Placed after, it is never applied: at best silently ignored, at worst swallowed as a positional argument (an extra table id, note content). `dot env use` state is per-user-global; in scripts and CI always pass the env explicitly.

Point the environment at a dev warehouse schema, then sync its table docs:

```bash
dot env target set mrr-policy <connection-id> --schema analytics_dev   # also --database, --warehouse
dot env sync-target mrr-policy                                         # refresh env table docs from the dev target
```

Review and promote:

```bash
dot env diff                       # changed files vs Production (defaults to the active env)
dot env conflicts                  # predict merge conflicts before trying
dot env merge mrr-policy --confirm [--delete-after]
dot env merge mrr-policy --accept-env <path> --accept-prod <path> --confirm   # resolve conflicts per file
```

Merge rebuilds every app the environment touched. Activation is all-or-nothing: until every rebuilt app builds, production keeps their pre-merge version. The merge is still done; the CLI prints what is still updating, and Dot keeps retrying on its own.

### dbt workflow

When a dbt branch renames a column or moves schemas, the repair is mechanical: no LLM:

```bash
# 1. Build the dbt branch to a dev schema (dbt run --target dev), then derive the bridge:
dot apps plan --state target/manifest.json --previous-state prod-manifest.json
# → Schema mapping: analytics -> analytics_pr_42
#   Rename candidates: db.analytics.fct_mrr_monthly.closed_at:close_date

# 2. Branch Dot and bind the dev schema:
dot env create pr-42 && dot env use pr-42
dot env target set pr-42 <connection-id> --schema analytics_pr_42
dot env sync-target pr-42

# 3. Blast radius (admin-only), then confirm the break:
dot apps deps db.analytics.fct_mrr_monthly.closed_at
dot apps validate _shared__revenue      # fails, naming the renamed column (EXPLAIN on the dev schema)

# 4. Mechanical rewrite of the locked SQL (sqlglot AST, zero LLM); --dry-run to preview:
dot apps refactor _shared__revenue --rename db.analytics.fct_mrr_monthly.closed_at:close_date
dot apps validate _shared__revenue      # green

# 5. Promote: ORDER MATTERS: deploy dbt to prod FIRST, then merge the Dot environment.
#    Reversed, production briefly serves SQL naming a column prod does not have.
dot env merge pr-42 --confirm
```

Rename specs: column renames need at least `schema.table.column` on the old side (two-part refs parse as table renames); `old_table:new_table` renames a table. `plan` diffs dbt manifests; rename detection reads schema.yml column docs, so undocumented models are skipped (it says so). Multi-schema manifests need `--confirm-multi-schema`. If `refactor` prints a `source_refs` note, the `.app` prose still names the old column: update it too.

### Apps and environment gotchas

- All `dot apps` verbs except `plan` and `pr` require org Git sync (GitHub/GitLab) and exit with instructions when missing.
- Admin-only: `deps`, `status --all`, `refactor --all`. Per-app verbs need edit access on that app.
- No active environment means push/pull target Production directly: check `dot env current` first.
- Push can run minutes (prose changes trigger an LLM compile). On timeout the build may still finish server-side: check `dot apps status <id>`.
- Sync baselines live in `.dot-sync.json` at the directory holding `apps/`; run pull/push from the same directory. A fresh clone has no baseline: the first push warns and skips the divergence check; pull once to establish it.

### Cache

Responses are cached permanently per question.

```bash
dot "question"                          # Uses cache if available
dot "question" --no-cache               # Force fresh request
dot --clear-cache                       # Wipe all cached responses
```

Use `--no-cache` when the question involves "today", "current", "latest", or the user says "refresh". Follow-ups (`--chat`) are never cached.

### Error handling

| Error | Meaning | Fix |
|-------|---------|-----|
| `Not authenticated` | No token saved | `dot login` |
| `authentication failed (401)` | Token expired, revoked, or for a different server | `dot login` |
| `token not permitted (403)` | An MCP or other scoped token: not usable with the CLI | `dot login` |
| `... not found` / `... failed (404)` | Resource doesn't exist (message names it) | Check the ID |
| `connection failed` | Server unreachable | Check internet, verify with `dot status` |
| `request timed out` | Server took too long | GETs auto-retry on 502/503/504; pushes and merges do NOT; re-run them deliberately |

### Housekeeping

```bash
dot status [--json]  # Identity, org, server, environment, CLI version, live credential check
dot chat <id>        # Full conversation history with SQL and tool calls
dot update           # Update the CLI now (it also self-updates in the background)
dot logout           # Forget the saved credentials
```

## Feedback

```bash
dot wish "I want better date filtering"
```

Use `dot wish` whenever the user wants to request a feature, report a bug, or give feedback. Over MCP, point them at the chat in Dot instead (`[Open in Dot]` link).
