---
name: dot
description: >
  Query company data using Dot, an AI data analyst with access to your
  databases. Ask questions in plain English; Dot finds the right tables,
  writes SQL, and returns answers, tables, charts and files. Also reads
  dashboards, manages schedules, and teaches Dot (tables, notes,
  environments, evaluations) through the dot CLI. Use when users ask about
  data, metrics, KPIs, reports, SQL, dashboards, or say "ask dot" or
  "check the numbers".
compatibility: >
  Works in two modes: through the Dot MCP connector (any Claude surface),
  or through the dot CLI (terminals with network access, e.g. Claude Code).
metadata:
  author: Snowboard-Software
---

# Dot: AI data analyst

Dot connects to your company's databases. You ask a question in plain English; Dot finds the right tables, writes SQL, runs it, and returns the answer with tables, charts and files.

## Pick your transport

1. **Shell with network access** (Claude Code, a terminal): use the `dot` CLI (*Using the dot CLI*). It does everything MCP does and more: files on disk, pipes, schedules, the model, admin.
2. **Dot MCP tools available** (`ask_dot`, `get_catalog`) and no shell: *Using Dot over MCP*. This is the path on claude.ai, Claude Desktop and Cowork, where sandboxes usually cannot reach arbitrary servers.
3. **Neither works?** Tell the user how to wire Dot up from their Dot profile page ("Use Dot elsewhere"): **Add to Claude** opens Claude with the connector filled in, Codex takes `codex mcp add dot --url https://app.getdot.ai/ai/mcp`, and a terminal takes `curl https://app.getdot.ai/install | sh`. A failed install with `Could not resolve host` means no network egress: use the connector.

Pick the transport silently: the user only needs Dot's answer.

## Using Dot over MCP

Pick the transport silently: the user only needs Dot's answer, not which path you took.

Hosts that render MCP Apps (claude.ai, Claude Desktop) show Dot's work in a live widget: Dot's progress, then its
answer (text, charts, tables, follow-up suggestions the user can click, downloads). The user already sees it there.

**Tools:**

- `ask_dot(question, chat_id?)`: starts Dot's analysis and returns a chat_id at once. It schedules and sends nothing
  and changes no memory, apps or connected systems; it keeps the chat and the files it writes in Dot, and may file a
  data gap or propose a definition for review ("revenue excludes refunds"), which changes nothing until a person in
  Dot accepts it. Pass the chat_id of an earlier answer for a follow-up, or to have that answer written up as a PDF
  or PowerPoint.
- `take_action(request, chat_id?)`: Dot acts with full access when the user asks it to: schedules or sends an answer
  ("email me this every Monday at 9"), optionally only when a condition holds; changes, pauses or deletes a schedule;
  remembers a personal preference ("I report in EUR"); or reads a connector or website `ask_dot` reported it could
  not reach. With an answer's chat_id it acts on that answer, without one in a new chat. Returns the chat_id at once,
  like `ask_dot`. Check recipients other than the user with them first. When an `ask_dot` run was asked for one of
  these, `get_result` says so and names the chat_id to pass.
- `get_result(chat_id)`: waits for the answer to `ask_dot`, `take_action` or `build_app` server-side (no need to
  pause first) and returns it as text, with the SQL, a data preview and the chart. If it says "Still processing",
  call it again. Never re-submit while waiting: a repeated question is a second, paid run.
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
"Dot couldn't find" a chat means a bad chat id: start a fresh `ask_dot`.

**Limits:** files on disk, the model (tables, notes, environments) and administration need the CLI; schedules are
`take_action`'s.

## Using the dot CLI

### Setup and sign-in

If `dot` is missing: `curl -fsSL https://app.getdot.ai/install | sh` (Windows: `irm https://app.getdot.ai/install.ps1 | iex`), then `export PATH="$HOME/.local/bin:$PATH"`.

Signing in without a browser: run `dot login`; it prints a link and a `dot login --poll <code>` command, then exits. Show the user the link, and once they approved it run the poll command (exit 0 signed in, 2 not approved yet: ask again and re-poll, 1 expired: start over). `dot status --json` says who you are, which server and environment, and whether the login works; when something is wrong it names the `fix`. In CI, set `DOT_API_TOKEN` (and `DOT_API_BASE_URL`).

### Rules that keep you out of trouble

1. **Look before you ask.** `dot search "<topic>"` finds dashboards, definitions, tables and the user's past chats, free and instant. A trusted dashboard or definition beats a fresh answer; a past chat can be continued.
2. **Ask once, then wait.** `dot ask "<question>"` prints the chat id first (stderr), progress while Dot works, and the answer on stdout. Answers take 15 s to a few minutes. If the command stops early (exit 75, or your shell timed out), the run is still going: `dot chats wait <chat-id>` (or plain `dot chats wait` for the last one) picks it up. Re-running the same `dot ask` shows the run already going or just answered instead of paying again; integrations that retry pass `--idempotency-key <key>`. If a run stops without an answer (exit 1, `run_lost`, or `chats show` says interrupted), `dot chats retry <chat-id>` asks it again.
3. **Follow up in the same chat.** `dot ask "<refinement>" --chat <chat-id>` keeps context. Ask Dot to act on an answer in plain words: "email me this every Monday at 9", "only when revenue drops 10%", "make this a PDF".
4. **Use the data, not the preview.** Each table's SQL, row count and first rows print with the answer (`--brief` prints only Dot's words and where each file is), and tables up to 50,000 rows are saved as CSV (`Data saved to: <path>`). Read those files for further work; `dot chats export <chat-id> [df_key] -o - | ...` streams all rows. Charts are saved as PNG (`Chart saved to:`): read them. Files Dot made (PDF, PPTX) are saved too (`File saved to:`).
5. **Parse JSON, not prose.** Add `--json` when you will parse: stdout is exactly one JSON document, errors included (`{"error": {"code", "message", "fix"}}`). Branch on the exit code: 0 ok, 1 failed, 3 not found, 4 conflict, 64 usage, 65 invalid input, 69 unreachable, 75 still running, 77 not permitted, 78 sign in.
6. **Check before you change.** Model writes go to the active environment (Production when none: `dot status --json` says which). Run mutations with `--dry-run` first. Destructive commands need `--yes`: get the user's go-ahead before passing it for them.
7. **Quote Dot's numbers exactly**, and say which chat they came from.

### Commands by job

```
dot search "<topic>"                       find dashboards, definitions, tables, past chats
dot ask "<question>" [--chat <id>]         answer a question (--json, --detach, --wait N, --mode)
dot chats wait|show [<id>]                 reattach to a running answer / print the latest one
dot chats export <id> [df_key] -o <path|-> all rows as CSV or XLSX (--format), or a file
dot chats list [--search w] [--running]    your conversations; --everyone --rated down (or --flagged, Dot's own review) finds answers that went wrong
dot chats stop|steer|rate <id> ...         wrap up, redirect mid-run, rate up/down with a reason
dot apps list|show|data|pdf <app>          dashboards: filters and tabs, numbers at --filter k=v, PDF
dot schedules list|show|create|pause|resume|run|delete   deliveries and alerts (create --dry-run first, then run the exact create it prints; times are UTC unless --timezone)
dot catalog                                connections and the most used tables
dot help "<question about Dot>"            answers from Dot's docs and API reference
```

Teaching Dot (modelers and admins):

```
dot tables list|get|scan|activate|deactivate|describe   what Dot may use, what columns mean
dot notes list|get|create|update|delete|activate        business definitions and rules
dot env list|create|use|diff|conflicts|merge            branch the model, review, merge
dot proposals list|show|diff|merge|reject|assign        the Context Agent inbox
dot eval init|create|validate|run                       trusted-answer checks and CI gates
dot apps pull|push|validate|refactor|plan|pr            dashboards as code (Git sync)
dot users|groups|connections|usage|audit                workspace administration
dot api <path> [-X METHOD] [-f k=v]                     any other endpoint, with your login
```

Every command has `dot <command> --help` with examples, and `dot commands --json` lists them all with their flags.

### Teaching Dot well

- Per table, document the grain (what one row is) and the primary key: `dot tables describe <id> --description "..."`, and columns with `--column name=text`.
- A first activation is `scan` then `activate`; re-enabling a scanned table needs only `activate`.
- Notes use strong words ("Always", "Never", "Only use X when Y"). Search existing notes first so no two define a metric differently.
- `dot notes activate|deactivate <id>` switches every note below it too, as the Model page's switch does.
- When an answer is wrong (`dot chats list --everyone --rated down` or `--flagged`, then `dot chats show <id> --all`), fix the cause: the wrong table (activate the right one), missing logic (a note), unclear columns (describe them). Then ask again.
- Try model changes in an environment (`dot env create`, `dot env use`), check them with `dot eval run`, and merge with `dot env merge <env> --dry-run`, then `--yes`.
- dbt renamed a column? `dot apps plan --state target/manifest.json --previous-state prod.json`, then `dot apps refactor <app> --rename db.schema.table.old:new`, then `dot apps validate`. Deploy dbt to production before merging the Dot environment.
- `.app.lock` files are compiled by the server: never hand-edit them (edit the `.app` and push, or `dot apps bless` a deliberate SQL edit).

## Feedback

`dot wish "<what you want>"` sends the Dot team a feature request or bug report. Over MCP, point the user at the chat in Dot instead.
