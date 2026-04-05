# Local-First Mode

`local-first` mode is the recommended deployment mode when this fork is used as a local Claude Code frontend backed by a self-hosted or third-party model gateway.

## What It Does

When `CLAUDE_CODE_LOCAL_FIRST=1` is set, the runtime treats the session as a local gateway deployment and disables Anthropic first-party product surfaces by default.

The current implementation:

- forces privacy level to `essential-traffic`
- disables telemetry and other nonessential startup traffic
- disables remote managed settings and policy-limits fetches
- hides first-party slash commands such as `login`, `remote-control`, `feedback`, `release-notes`, `upgrade`, `chrome`, `desktop`, and `mobile`
- disables `claude auth` CLI subcommands
- blocks direct `remote-control` startup

## Recommended Environment

```env
CLAUDE_CODE_LOCAL_FIRST=1
DISABLE_TELEMETRY=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
ANTHROPIC_BASE_URL=http://127.0.0.1:3456
ANTHROPIC_AUTH_TOKEN=sk-local-gateway
```

## Gateway Strategy

This fork still speaks Anthropic message/tool semantics internally. The recommended architecture is:

1. `claude-code-haha` as the terminal frontend
2. a local `Anthropic-compatible` gateway as the protocol adapter
3. model routing handled by the gateway, not by the TUI

Suggested first PoC:

- Gateway: [claude-code-router](https://github.com/musistudio/claude-code-router)
- Local model backend: `Ollama`
- Remote providers to benchmark through the gateway: `OpenAI`, `Qwen`, `DeepSeek`

For comparison against the official CLI workflow, keep [anyclaude](https://github.com/coder/anyclaude) as a benchmark option.

For repository-ready templates and launcher scripts, see [router-setup.md](./router-setup.md).
