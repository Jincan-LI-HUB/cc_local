# Claude Code Local-First Final Summary

## Goal

This fork turns `claude-code-haha` into a local-first Claude Code style client that:

- keeps the Claude Code terminal workflow and interaction feel as much as possible
- routes model traffic through a local Anthropic-compatible gateway
- supports local Ollama models and optional third-party API backends
- hides or disables Anthropic first-party flows that do not make sense in a local deployment

## Final Architecture

The final runtime path is:

1. `claude-code-haha` frontend keeps Anthropic-style message and tool semantics
2. `claude-code-router` provides an Anthropic-compatible `/v1/messages` gateway
3. the gateway routes requests to:
   - local Ollama models
   - optional OpenAI / DeepSeek / DashScope-style backends

This means we did **not** rewrite the frontend into a multi-provider app.  
Instead, we moved provider adaptation into the router layer.

## What We Changed

### 1. Added `local-first` mode

We introduced a local-first mode and wired it into the app startup path so the fork behaves like a self-hosted client instead of a first-party Anthropic client.

Main areas:

- local-first env and helpers
- local-first startup scripts
- local-first router bootstrap
- local-first docs and examples

Key files:

- `src/utils/localFirst.ts`
- `src/utils/privacyLevel.ts`
- `scripts/setup-local-first.ts`
- `scripts/start-local-first.ts`
- `scripts/dev-local-first.ts`
- `scripts/start-router.ts`

### 2. Disabled Anthropic first-party only features

In local-first mode, we disabled or hid features that depend on Anthropic-owned infrastructure:

- login and OAuth style flows
- managed auth key behavior
- remote managed settings sync
- policy limits sync
- official MCP registry prefetch that assumes first-party services
- update and release-note style first-party UX entrypoints
- other remote-control / web-setup style flows

Key files:

- `src/utils/auth.ts`
- `src/services/remoteManagedSettings/syncCache.ts`
- `src/services/policyLimits/index.ts`
- `src/services/mcp/officialRegistry.ts`
- `src/commands.ts`
- `src/main.tsx`
- `src/entrypoints/cli.tsx`

### 3. Kept Claude Code style UX, but pointed it at local models

We preserved the TUI, slash commands, session flow, and tool-use loop, but changed the model/provider behavior so the app no longer pretends it is talking directly to Anthropic when using a local gateway.

Key fixes:

- local gateway is treated as a custom Anthropic-compatible provider
- auth conflict with local token vs managed login was removed
- local-first prompts no longer force the model to identify as official hosted Claude
- status and logo areas show local gateway oriented labels

Key files:

- `src/utils/model/providers.ts`
- `src/utils/model/model.ts`
- `src/utils/status.tsx`
- `src/utils/logoV2Utils.ts`
- `src/constants/system.ts`
- `src/constants/prompts.ts`

### 4. Fixed thinking and tool compatibility issues

Some local models do not support Claude-style `thinking` controls or tool-calling in the same way.

We changed behavior so:

- local-first no longer blindly sends thinking settings to unsupported models
- setup prefers a tool-capable default local model
- unsupported local models remain selectable, but are not used as the default interactive model

Resulting default strategy on this machine:

- default model: `qwen3.5:35b`
- think model: `qwen3.5:35b`
- long-context/general model: `gemma4:31b`
- `deepseek-coder:6.7b` remains selectable, but is not the default interactive model

Key files:

- `src/utils/thinking.ts`
- `src/utils/model/modelSupportOverrides.ts`
- `scripts/setup-local-first.ts`

### 5. Added multi-model picker support

Originally the frontend mostly exposed Claude-branded choices plus a very limited custom model path.

We expanded this so `/model` can surface multiple custom router-backed models from configuration.

Configured support now includes the user-requested set:

- `qwen3.5:35b`
- `gemma4:31b`
- `deepseek-coder:6.7b`
- `deepseek-coder-v2:16b`
- `deepseek-coder-v2:236b`
- `qwen3.5:397b-cloud`
- `minimax-m2.7:cloud`

Key files:

- `src/utils/model/modelOptions.ts`
- `src/utils/managedEnvConstants.ts`
- `scripts/local-first-utils.ts`
- `router/claude-code-router/config.ollama.minimal.json`
- `router/claude-code-router/config.hybrid.example.json`
- `router/claude-code-router/providers.env.example`
- `.env.local-first.example`

### 6. Stabilized the startup welcome UI

There were two stages to fixing the startup UI:

1. we first forced a condensed local-first logo to stop the repeated expanding redraw
2. we then refined it so local-first now:
   - briefly stays in a stable condensed startup state
   - waits for terminal width to settle
   - switches back to the richer original welcome layout

This preserves the nicer full welcome UI while avoiding the repeated "PPT-like" width expansion on startup.

Key file:

- `src/components/LogoV2/LogoV2.tsx`

### 7. Hardened one-command startup and simplified MCP management

We tightened the local-first startup chain so `bun run dev:local-first` is more
reliable on this Windows setup.

Changes:

- local-first startup now retries router bring-up instead of assuming one start
  attempt is enough
- the dev launcher now hands off to `start-local-first.ts` after router
  readiness is confirmed
- local-first `/mcp` now focuses on project MCPs and hides noisy built-in
  plugin MCP entries from the interactive manager
- full MCP diagnostics remain available via CLI

Key files:

- `scripts/dev-local-first.ts`
- `src/components/mcp/MCPSettings.tsx`
- `src/components/mcp/MCPListPanel.tsx`
- `docs/local-first-operations.md`
- `docs/mcp-desktop-import.md`

## Router and Model Strategy

### Frontend

The frontend still speaks Anthropic-style request semantics.

### Gateway

`claude-code-router` acts as the translation layer and exposes an Anthropic-compatible API surface.

### Local model policy

Default local strategy:

- `ROUTER_DEFAULT=ollama,qwen3.5:35b`
- `ROUTER_BACKGROUND=ollama,qwen3.5:35b`
- `ROUTER_THINK=ollama,qwen3.5:35b`
- `ROUTER_LONG_CONTEXT=ollama,gemma4:31b`

Additional configured selectable models:

- `deepseek-coder:6.7b`
- `deepseek-coder-v2:16b`
- `deepseek-coder-v2:236b`
- `qwen3.5:397b-cloud`
- `minimax-m2.7:cloud`

## Files Generated or Used by the Workflow

Generated local files:

- `.env.local-first`
- `router/claude-code-router/providers.local.env`

CCR effective user config:

- `%USERPROFILE%\\.claude-code-router\\config.json`

Primary operational docs:

- `docs/local-first-operations.md`
- `docs/router-setup.md`

## Verified Outcomes

We verified the following during the implementation:

- local-first startup path runs
- router-backed Anthropic-compatible requests succeed
- `start-local-first` prompt mode returns successful model output
- auth conflicts from first-party login state were removed in local-first
- `/model` can now show multiple custom models
- selecting `qwen3.5:397b-cloud` worked in the TUI
- startup layout no longer performs the repeated expanding redraw

## Remaining Limitations

- Claude-branded names such as Sonnet / Opus / Haiku may still exist in some legacy UI paths unless further hidden
- actual availability of cloud-style Ollama model names depends on the Ollama/backend side really supporting them
- this fork is optimized for local-first behavior, not for preserving every Anthropic cloud-only feature

## Recommended Daily Usage

From the project root:

```powershell
bun install
bun run setup:local-first
bun run dev:local-first
```

Quick single-prompt test:

```powershell
bun run dev:local-first -- -p "Reply with exactly: OK"
```

Verification:

```powershell
bun run verify:local-first
```

If using a split startup:

```powershell
bun run router:start
bun run start:local-first
```

## Git Branch Used For This Work

Primary branch:

- `codex/local-first-final`

User repository:

- `https://github.com/Jincan-LI-HUB/cc_local`
