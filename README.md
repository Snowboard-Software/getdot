# Dot CLI and agent skill

Query your company's data from Claude, Claude Code, Codex, Cursor, Gemini CLI or the terminal with [Dot (getdot.ai)](https://www.getdot.ai), the AI data analyst.

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

The installer downloads the current `dot` binary from your Dot server and adds the Dot skill ([SKILL.md](plugins/dot/skills/dot/SKILL.md) in this repository) to the AI coding agents it finds. Then sign in:

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

### Claude

Open your [Dot profile](https://app.getdot.ai/profile#claude) and click **Add to Claude**. Or add it by hand: in Claude, go to **Customize → Connectors → Add custom connector** and paste `https://app.getdot.ai/ai/mcp`. This works on claude.ai, Claude Desktop and Cowork.

### Claude Code

```bash
claude plugin install dot --marketplace Snowboard-Software/getdot
```

The plugin bundles Dot's MCP connector and the Dot skill. Run `/mcp` in a session to sign in. On Claude Code before 2.1.292, run `claude plugin marketplace add Snowboard-Software/getdot`, then `claude plugin install dot@getdot`.

Already added Dot in Claude? Claude Code picks up that connector when you sign in with your Claude account. The plugin uses the same server, so you see one set of Dot tools.

### Codex

```bash
codex mcp add dot --url https://app.getdot.ai/ai/mcp
```

Codex opens your browser to sign in. The ChatGPT desktop app and the IDE extension read the same configuration.

Or install the plugin, which also adds the Dot skill:

```bash
codex plugin marketplace add Snowboard-Software/getdot
codex plugin add dot@getdot
codex mcp login dot
```

### Other agents

```bash
npx skills add https://github.com/Snowboard-Software/getdot
```

This adds the Dot skill to Cursor, Gemini CLI and other agents. The CLI installer above adds it too.

Connect Cursor, Windsurf or any MCP client to `https://app.getdot.ai/ai/mcp`. ChatGPT uses the same full server: `https://app.getdot.ai/ai/mcp`.

### EU workspaces

The plugins connect to the US server. For a workspace on `eu.getdot.ai`, add the EU server directly:

```bash
claude mcp add --transport http --scope user dot https://eu.getdot.ai/ai/mcp
codex mcp add dot --url https://eu.getdot.ai/ai/mcp
```

In Claude, use **Add to Claude** on your [EU profile](https://eu.getdot.ai/profile#claude), or paste `https://eu.getdot.ai/ai/mcp`. ChatGPT uses the same EU URL: `https://eu.getdot.ai/ai/mcp`. Add the skill with `npx skills add` above.

### Clients without OAuth

Claude, Codex, ChatGPT, Cursor and Windsurf sign in with OAuth. Clients without OAuth send an MCP token in the `X-API-KEY` header. To get one, open your Profile in Dot, go to **Use Dot elsewhere > MCP**, open **Client can't do OAuth? Use an API token** and click **Generate token**. Setup for each client: [MCP docs](https://docs.getdot.ai/developers/mcp). The server is listed in the [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.zurferr/dot`.

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

This repository holds the Dot plugin for Claude Code and Codex ([plugins/dot](plugins/dot)), the agent skill and an early version of the CLI source. The installer always fetches the current CLI binary from your Dot server.

Maintainers: bump `version` in [plugins/dot/.claude-plugin/plugin.json](plugins/dot/.claude-plugin/plugin.json) with every change to the plugin, or installed copies keep the old one.

## License

MIT

## OpenAI directory package

Run `node scripts/build-plugin.mjs` to build `dist/dot-openai-1.0.1.zip`. The archive contains the OpenAI manifest, Dot skill, icon and one remote MCP server. It excludes the Claude manifest, lifecycle hooks and app references. Upload it through the OpenAI Platform Plugins page with MCP. Complete domain verification, tool review and the demo recording before submitting for review.
