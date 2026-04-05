# Claude Desktop MCP Migration

## Goal

This project now supports importing MCP servers from the user's Claude Desktop
configuration into the local-first workflow.

The migration is designed to be safe by default:

- project-shared MCP definitions go into `.mcp.json`
- sensitive tokens and connection strings go into `.env.mcp.local`
- `.env.mcp.local` is gitignored
- local-first startup scripts load `.env.mcp.local` automatically

## Source Config

Default Windows source file:

- `C:\Users\lenovo\AppData\Roaming\Claude\claude_desktop_config.json`

## Generated Files

Project MCP config:

- `.mcp.json`

Local ignored secrets file:

- `.env.mcp.local`

Example secrets template:

- `.env.mcp.local.example`

## Imported Servers

The current import brought these Claude Desktop MCP servers into this project:

- `playwright`
- `windows`
- `filesystem`
- `git`
- `github`
- `pandas-mcp`
- `alphavantage`
- `financial-datasets`
- `postgres`
- `n8n-mcp`

## Notes

- Windows `npx` commands were normalized to `npx.cmd` so they work better in
  this repository's Windows runtime.
- Secret values such as GitHub tokens, bearer tokens, API keys, and database
  connection strings were moved out of `.mcp.json`.
- The generated `.mcp.json` is a snapshot of this machine's MCP setup, so some
  absolute paths and local services may need adjustment on another computer.
- The `filesystem` MCP server still points at `D:\`, which is powerful and may
  be broader than this project actually needs.
- CLI inspection commands such as `claude mcp list` and `claude mcp get` now
  redact imported secrets before printing them.

## Usage

To rerun the import:

```powershell
bun run mcp:import:desktop
```

To import from a different Desktop config path:

```powershell
bun run mcp:import:desktop -- --source C:\path\to\claude_desktop_config.json
```

After import, start the app normally:

```powershell
bun run dev:local-first
```

Because `dev:local-first` and `start:local-first` now load `.env.mcp.local`,
the imported MCP servers can use the migrated secrets automatically.

## Local-First MCP UI Behavior

In local-first mode, the interactive `/mcp` panel is intentionally focused on
project MCPs imported into this repository.

- project MCPs remain visible in the TUI manager
- built-in plugin MCPs are hidden from that panel to reduce noise
- full MCP diagnostics are still available from the CLI

Use this when you want the full picture:

```powershell
bun ./scripts/start-local-first.ts mcp list
```
