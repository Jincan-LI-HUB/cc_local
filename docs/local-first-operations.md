# Claude Code Local-First 操作手册

这份文档专门说明如何把当前仓库作为：

- `claude-code-haha` 前端
- `claude-code-router` 协议网关
- `Ollama / OpenAI / DeepSeek / DashScope`

组合成一套可长期使用的本地 Claude Code 风格工作流。

## 目标架构

推荐默认架构：

1. `claude-code-haha`
   - 负责终端交互、slash commands、工具调用、MCP、插件、会话历史
2. `claude-code-router`
   - 负责把 Anthropic-compatible 请求转到本地模型或远端 API
3. `Ollama`
   - 负责本地模型推理

## 当前这台机器的推荐本地模型分工

根据当前已安装模型，脚本会优先选择“支持 tools 的本地模型”作为默认交互模型。

当前这台机器的推荐分工是：

- 默认 coding / 交互：`qwen3.5:35b`
- think / 重推理：`qwen3.5:35b`
- general / 长上下文 / 普通对话：`gemma4:31b`
- 备选非默认：`deepseek-coder:6.7b`

说明：

- `deepseek-coder:6.7b` 当前会拒绝 OpenAI/Anthropic 兼容工具调用参数
- 而 `claude-code-haha` 的真实工作流会频繁带上工具 schema
- 所以为了保留 Claude Code 的操作手感，默认路由必须优先选支持 tools 的模型

这套分工已经被脚本自动识别并写入：

- [providers.local.env](../router/claude-code-router/providers.local.env)

## 首次安装

在仓库根目录执行：

```powershell
npm install -g @musistudio/claude-code-router
bun install
bun run setup:local-first
```

执行后会生成：

- [.env.local-first](../.env.local-first)
- [providers.local.env](../router/claude-code-router/providers.local.env)

## 一键启动

最推荐的启动方式：

```powershell
bun run dev:local-first
```

它会自动完成：

1. 检查并补齐本地运行配置
2. 同步 router 配置到 `C:\Users\lenovo\.claude-code-router\config.json`
3. 启动或重启 `claude-code-router`
4. 启动本仓库前端

## 单轮测试

如果你只想快速确认链路是通的：

```powershell
bun run dev:local-first -- -p "Reply with exactly: OK"
```

正常返回：

```text
OK
```

## 日常使用方式

### 方式 1：完整交互模式

```powershell
bun run dev:local-first
```

适合：

- 日常 coding
- 工具调用
- MCP
- 会话恢复
- 多轮交互

### 方式 2：脚本/CI/单轮问答

```powershell
bun run dev:local-first -- -p "帮我总结当前目录项目结构"
```

适合：

- 批处理
- shell 管道
- 快速 smoke test

### 方式 3：分开控制 router 和前端

先启动 router：

```powershell
bun run router:start
```

再启动前端：

```powershell
bun run start:local-first
```

适合：

- 需要反复重开前端
- 单独排查 router
- 后面切换 hybrid 配置

## 自检

每次改完模型、key、router 策略后，建议跑：

```powershell
bun run verify:local-first
```

它会验证：

1. local-first 模式是否成功启动
2. first-party 命令是否已隐藏
3. router 的 `/v1/messages` 是否可用
4. 前端 `-p` 模式是否走通本地网关
5. hybrid router 是否能启动
6. hybrid 默认路由是否仍然可用

## 当前关键配置文件

### 1. 前端环境变量

文件：

- [.env.local-first](../.env.local-first)

关键字段：

- `CLAUDE_CODE_LOCAL_FIRST=1`
- `ANTHROPIC_BASE_URL=http://127.0.0.1:3456`
- `ANTHROPIC_AUTH_TOKEN=local-router`

### 2. 本地/混合 provider 配置

文件：

- [providers.local.env](../router/claude-code-router/providers.local.env)

当前推荐本地配置：

```env
OLLAMA_MODEL=qwen3.5:35b
OLLAMA_THINK_MODEL=qwen3.5:35b
OLLAMA_GENERAL_MODEL=gemma4:31b
ROUTER_DEFAULT=ollama,qwen3.5:35b
ROUTER_BACKGROUND=ollama,qwen3.5:35b
ROUTER_THINK=ollama,qwen3.5:35b
ROUTER_LONG_CONTEXT=ollama,gemma4:31b
```

### 3. CCR 实际运行配置

文件：

- [config.json](/C:/Users/lenovo/.claude-code-router/config.json)

注意：

- 当前 `ccr` 版本对 `--config` 的守护进程支持并不稳定
- 本仓库脚本会自动把仓库模板同步到这个位置
- 如果原配置不同，会自动备份

## 如何切换到混合路由

如果要接 OpenAI / DeepSeek / Qwen 官方 API：

编辑：

- [providers.local.env](../router/claude-code-router/providers.local.env)

填上：

```env
OPENAI_API_KEY=你的 OpenAI Key
DEEPSEEK_API_KEY=你的 DeepSeek Key
DASHSCOPE_API_KEY=你的 DashScope Key
```

然后根据需要调整：

```env
ROUTER_DEFAULT=ollama,deepseek-coder:6.7b
ROUTER_BACKGROUND=ollama,deepseek-coder:6.7b
ROUTER_THINK=deepseek,deepseek-reasoner
ROUTER_LONG_CONTEXT=openai,gpt-4.1
```

启动混合 router：

```powershell
bun run router:start:hybrid
bun run start:local-first
```

## 推荐的三种运行策略

### 策略 A：全本地优先

适合：

- 追求隐私
- 降低成本
- 本地机器性能足够

推荐：

```env
ROUTER_DEFAULT=ollama,qwen3.5:35b
ROUTER_BACKGROUND=ollama,qwen3.5:35b
ROUTER_THINK=ollama,qwen3.5:35b
ROUTER_LONG_CONTEXT=ollama,gemma4:31b
```

### 策略 B：本地开发 + 远端深推理

适合：

- 平时本地写代码
- 复杂问题交给远端 reasoning

推荐：

```env
ROUTER_DEFAULT=ollama,qwen3.5:35b
ROUTER_BACKGROUND=ollama,qwen3.5:35b
ROUTER_THINK=deepseek,deepseek-reasoner
ROUTER_LONG_CONTEXT=ollama,gemma4:31b
```

### 策略 C：本地开发 + 远端长上下文

适合：

- 平时在本地跑
- 超长上下文时切 OpenAI

推荐：

```env
ROUTER_DEFAULT=ollama,deepseek-coder:6.7b
ROUTER_BACKGROUND=ollama,deepseek-coder:6.7b
ROUTER_THINK=ollama,qwen3.5:35b
ROUTER_LONG_CONTEXT=openai,gpt-4.1
```

## 常用命令速查

生成本地配置：

```powershell
bun run setup:local-first
```

一键启动：

```powershell
bun run dev:local-first
```

前端单轮：

```powershell
bun run dev:local-first -- -p "你好"
```

只启动 router：

```powershell
bun run router:start
```

启动 hybrid router：

```powershell
bun run router:start:hybrid
```

查看 router 状态：

```powershell
bun run router:status
```

停止 router：

```powershell
bun run router:stop
```

跑自检：

```powershell
bun run verify:local-first
```

## 排障

### 1. 前端能启动，但没回复

先确认：

```powershell
bun run router:status
```

再确认 Ollama 是否有模型：

```powershell
ollama list
```

### 2. 改了 provider 配置却没生效

重新启动 router：

```powershell
bun run router:start
```

或者 hybrid：

```powershell
bun run router:start:hybrid
```

### 3. CCR 配置被覆盖

这是当前脚本的设计行为，因为 `ccr` 当前版本运行时主要依赖：

- [config.json](/C:/Users/lenovo/.claude-code-router/config.json)

如果之前有旧配置，脚本会自动备份到：

- `C:\Users\lenovo\.claude-code-router\config.codex-backup.*.json`

### 4. 想恢复到纯本地默认策略

执行：

```powershell
bun run setup:local-first
bun run router:start
```

如果你之前手改过 `providers.local.env`，也可以直接把以下四项改回：

```env
ROUTER_DEFAULT=ollama,deepseek-coder:6.7b
ROUTER_BACKGROUND=ollama,deepseek-coder:6.7b
ROUTER_THINK=ollama,qwen3.5:35b
ROUTER_LONG_CONTEXT=ollama,gemma4:31b
```

## 建议的日常流程

推荐你们团队后续这样用：

1. 本地开发默认跑 `bun run dev:local-first`
2. 每次改路由或模型后跑 `bun run verify:local-first`
3. 复杂推理需求再切到 hybrid
4. 优先把“前端体验”和“provider 路由”分层维护，不要把 provider 逻辑重新塞回前端
