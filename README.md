# @altronis/altronis-mcp

MCP server **and** CLI for [Altronis](https://altronis.sg) — Singapore AI consulting. It gives an AI agent (or you, from a shell) a set of read-only tools over the public altronis.sg endpoints: ask the Lyra consultant, generate a grant-matched AI transformation plan, and pull curated Singapore AI events, news, and business-formation data.

One codebase, two entry points:

- `altronis-mcp` — a stdio MCP server for Claude Desktop, Claude Code, Cursor, and any MCP client.
- `altronis` — the same tools as a command-line tool.

Read-only by design: no tool mutates anything or captures leads.

## Install

```bash
npm install -g @altronis/altronis-mcp
# or run without installing:
npx @altronis/altronis-mcp --help
```

## Use as an MCP server

Add it to your MCP client config. For Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "altronis": {
      "command": "npx",
      "args": ["-y", "@altronis/altronis-mcp"]
    }
  }
}
```

For Claude Code:

```bash
claude mcp add altronis -- npx -y @altronis/altronis-mcp
```

Then ask your agent things like *"use altronis to draft an AI plan for a Singapore precision-manufacturing SME"* or *"what AI events are on in Singapore this month?"*.

## Use as a CLI

```bash
altronis ask "does an on-prem LLM satisfy PDPA?"
altronis plan --sector manufacturing "40-person precision stamping SME, manual QC reports, uses Excel + WhatsApp"
altronis events 5
altronis news 5
altronis ecosystem
altronis services
altronis tool altronis_ask '{"question":"..."}'   # call any tool by name
altronis list                                       # list all tools
```

Output is JSON on stdout; logs go to stderr.

## Tools

| Tool | What it does |
|------|--------------|
| `altronis_ask` | Ask Agent Lyra, the Altronis consultant, an AI/strategy/governance/grants question. |
| `altronis_transformation_plan` | Grant-matched AI transformation plan for a Singapore SME. `sector` = `sport`, `manufacturing`, or `fnb`. |
| `altronis_sg_ai_events` | Upcoming AI events in Singapore (curated). |
| `altronis_sg_ai_news` | Latest curated Singapore-relevant AI news. |
| `altronis_sg_ecosystem` | Singapore business-formation + industry-mix snapshot (SingStat). |
| `altronis_services` | Altronis's six service pillars, engagement model, and contact. |

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `ALTRONIS_BASE_URL` | `https://altronis.sg` | Point at a different origin (e.g. staging or self-hosted). |
| `ALTRONIS_TIMEOUT_MS` | `30000` | Per-request timeout. |

## Develop

```bash
npm install
npm run build     # tsc -> dist/
npm test          # unit tests (mocked fetch)
npm run smoke     # live integration test against altronis.sg
npm run dev       # run the MCP server from source (tsx)
npm run cli -- ask "..."   # run the CLI from source
```

## License

MIT © Altronis (altronis.sg)
