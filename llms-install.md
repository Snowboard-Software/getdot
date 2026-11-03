# Installing the Dot MCP server

Dot (getdot.ai) is an AI data analyst. Its MCP server is hosted by Dot, so there is nothing to build or run locally: you connect to a remote URL. In Claude Code or Codex, the Dot plugin does all of this in one step: see the [README](README.md#use-dot-from-ai-agents).

## 1. Pick the server URL

Use the region the user signs into Dot with:

- US: `https://app.getdot.ai/ai/mcp`
- EU: `https://eu.getdot.ai/ai/mcp`

If you are not sure, ask the user which address they open Dot at (`app.getdot.ai` or `eu.getdot.ai`).

## 2. Add the server

Add this entry to the MCP settings file (for Cline: `cline_mcp_settings.json`), with the EU URL for EU users:

```json
{
  "mcpServers": {
    "dot": {
      "type": "streamableHttp",
      "url": "https://app.getdot.ai/ai/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Dot signs the user in with OAuth, so no token is needed: on the first connection the client opens a browser, the user signs in to Dot and allows access. A user without a Dot workspace can start free at https://www.getdot.ai/pricing.

## 3. If the client cannot do OAuth

If the client never offers a sign-in and the server keeps answering `401 Unauthorized`, use an MCP token instead. Ask the user to create one in Dot: open their **Profile**, scroll to **Use Dot elsewhere**, choose the **MCP** tab, open **Client can't do OAuth? Use an API token**, click **Generate token** and copy it. A new token replaces the previous one. Never invent a token.

Add the token to the same entry as a header:

```json
"headers": {
  "X-API-KEY": "YOUR_DOT_MCP_TOKEN"
}
```

The token goes in the `X-API-KEY` header. Tokens in the URL are not supported.

## 4. Check it works

List the server's tools, then ask Dot a simple question about the user's data, for example "Which tables can you see?". Dot answers with the tables it can query and applies the user's Dot permissions to every query.

Docs: https://docs.getdot.ai/developers/mcp
