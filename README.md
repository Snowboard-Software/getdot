# Dot CLI and agent skill

Query your company's data from the terminal, Claude Code, Cursor, Codex or Gemini CLI with [Dot (getdot.ai)](https://www.getdot.ai), the AI data analyst.

Ask a question in plain English. Dot finds the right tables, writes and runs SQL on your own warehouse, and answers with the result, the SQL it ran, and charts. It applies the same permissions as your Dot workspace.

## Install

macOS and Linux:

```bash
curl https://app.getdot.ai/install | sh    # US region
curl https://eu.getdot.ai/install | sh     # EU region
```

Windows (PowerShell):

```powershell
irm https://app.getdot.ai/install.ps1 | iex    # US region
irm https://eu.getdot.ai/install.ps1 | iex     # EU region
```

The installer downloads the current `dot` binary from your Dot server and adds the Dot skill ([SKILL.md](SKILL.md) in this repository) to the AI coding agents it finds. Then sign in:

```bash
dot login
```

Don't have a workspace yet? [Start free](https://www.getdot.ai/pricing): 300 credits, no credit card.

## Ask questions

```bash
dot "What were total sales last month?"
dot "Break down by region" --chat <chat-id>
dot catalog
```

Each answer prints the explanation, the SQL query, a data preview and a link to the full analysis in Dot. Charts and CSV files are saved locally, so your coding agent can read them.

## Manage your workspace

```bash
dot notes list          # business context Dot uses to answer
dot tables list         # tables Dot can query
dot env list            # environments for testing changes before Production
dot apps pull <id>      # data apps as code
dot eval run suite.json # check answers against trusted numbers, for example in CI
```

Run `dot --help` for every command.

## Use Dot from AI agents

**Agent skill.** The installer adds it for you. To add it by hand:

```bash
npx skills add https://github.com/Snowboard-Software/getdot
```

**Remote MCP server.** Connect Claude, Cursor, Windsurf, ChatGPT or any MCP client to:

- US: `https://app.getdot.ai/ai/mcp`
- EU: `https://eu.getdot.ai/ai/mcp`

Claude, Cursor and Windsurf sign in with OAuth. Clients without OAuth send an MCP token in the `X-API-KEY` header (in Dot: Settings > Integrations > API Token > Generate MCP Token). Setup for each client: [MCP docs](https://docs.getdot.ai/developers/mcp). The server is listed in the [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.zurferr/dot`.

## CI and headless servers

Set the token through your CI secret store and choose the regional server:

```bash
export DOT_API_BASE_URL="https://app.getdot.ai"
export DOT_API_TOKEN="YOUR_API_TOKEN"
```

See [Evaluations in CI](https://docs.getdot.ai/developers/api/evaluations-in-ci).

## Links

- Website: https://www.getdot.ai
- Docs: [CLI](https://docs.getdot.ai/developers/cli), [MCP](https://docs.getdot.ai/developers/mcp), [API](https://docs.getdot.ai/developers/api)
- Security: https://www.getdot.ai/security (SOC 2 Type II, GDPR)

This repository holds the agent skill and an early version of the CLI source. The installer always fetches the current CLI binary from your Dot server.

## License

MIT
