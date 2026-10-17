# Installing the Dot MCP server

Dot (getdot.ai) is an AI data analyst. Its MCP server is hosted by Dot, so there is nothing to build or run locally: you connect to a remote URL.

## 1. Pick the server URL

Use the region the user signs into Dot with:

- US: `https://app.getdot.ai/ai/mcp`
- EU: `https://eu.getdot.ai/ai/mcp`

If you are not sure, ask the user which address they open Dot at (`app.getdot.ai` or `eu.getdot.ai`).

## 2. Get a token from the user

Ask the user to create an MCP token in Dot: **Settings > Integrations**, choose the client, open the **API Token** tab, click **Generate MCP Token** and copy it. Never invent a token. A user without a Dot workspace can start free at https://www.getdot.ai/pricing.

## 3. Add the server

Add this entry to the MCP settings file (for Cline: `cline_mcp_settings.json`), replacing the token, and the URL for EU users:

```json
{
  "mcpServers": {
    "dot": {
      "type": "streamableHttp",
      "url": "https://app.getdot.ai/ai/mcp",
      "headers": {
        "X-API-KEY": "YOUR_DOT_MCP_TOKEN"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

The token goes in the `X-API-KEY` header. Tokens in the URL are not supported.

## 4. Check it works

List the server's tools, then ask Dot a simple question about the user's data, for example "Which tables can you see?". Dot answers with the tables it can query and applies the user's Dot permissions to every query.

Docs: https://docs.getdot.ai/developers/mcp
