# Router 接入指南

这个仓库推荐把前端和协议适配拆成两层：

1. `claude-code-haha` 负责 TUI、工具、MCP、插件、会话体验
2. `claude-code-router` 负责把 Anthropic 协议转发到本地模型或其他官方 API

## 仓库内现成模板

- 前端环境模板：[.env.local-first.example](../.env.local-first.example)
- 最小 Ollama 配置：[router/claude-code-router/config.ollama.minimal.json](../router/claude-code-router/config.ollama.minimal.json)
- 混合路由配置：[router/claude-code-router/config.hybrid.example.json](../router/claude-code-router/config.hybrid.example.json)
- Provider 环境变量模板：[router/claude-code-router/providers.env.example](../router/claude-code-router/providers.env.example)
- 自动生成的本地 Provider 环境文件：`router/claude-code-router/providers.local.env`
- 启动脚本：
  [scripts/start-local-first.ps1](../scripts/start-local-first.ps1)
  [scripts/start-local-first.sh](../scripts/start-local-first.sh)
  [scripts/setup-local-first.ts](../scripts/setup-local-first.ts)
  [scripts/start-router.ts](../scripts/start-router.ts)
  [scripts/dev-local-first.ts](../scripts/dev-local-first.ts)

## 推荐起步方式

### 1. 先跑纯本地最小版

- 启动 `Ollama`
- 运行 `bun run setup:local-first`
- 运行 `bun run dev:local-first`
- 运行 `bun run verify:local-first`

这会自动完成：

- 生成 `.env.local-first`
- 生成 `router/claude-code-router/providers.local.env`
- 选择当前机器可用的 Ollama 模型
- 启动本地 `claude-code-router`
- 再启动本仓库前端
- 最后做一轮本地 smoke test

如果你更想手动拆分成两步：

```powershell
bun run router:start
bun run start:local-first
```

### 2. 再切换到混合路由

`config.hybrid.example.json` 已经预留了 4 类后端：

- `ollama`
- `openai`
- `deepseek`
- `dashscope`（Qwen 官方兼容入口）

自动生成的纯本地默认路由策略是：

- 日常对话：本地 `ollama`
- 后台任务：本地 `ollama`
- 推理任务：本机可用的较强模型
- 长上下文：本机可用的较强模型

`config.hybrid.example.json` 仍然保留了混合策略模板：

- 日常对话：本地 `ollama`
- 后台任务：本地 `ollama`
- 推理任务：`deepseek-reasoner`
- 长上下文：`openai`

如果你更想全本地，可以把 `ROUTER_THINK` 和 `ROUTER_LONG_CONTEXT` 也改成 `ollama,...`

## 为什么这样做

这样做的好处是：

- 前端不用重写成多协议客户端
- Claude Code 的工具调用和交互手感保留最多
- Provider 切换全部收敛在 router 配置层
- 后续想做 benchmark 时，也能直接替换 router 配置，不必改前端

## 参考来源

- `claude-code-router` README: [GitHub](https://github.com/musistudio/claude-code-router)
- `anyclaude` README: [GitHub](https://github.com/coder/anyclaude)

如果你要长期运行和维护这套本地版本，也建议直接看：

- [docs/local-first-operations.md](./local-first-operations.md)
