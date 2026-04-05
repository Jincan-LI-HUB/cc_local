# 项目总结：如何把一份“泄露版 Claude Code 前端”化腐朽为神奇

核心方法可以概括为四句话：

- 明确目标，寻找条件
- 发现差异，揭示本质
- 构造相同，联系相似
- 抉择通道，转化矛盾

这不是一句口号，而是这次项目真正发生的事情。

我们没有从零“发明一个像 Claude Code 的东西”，而是反过来做了一件更难也更有价值的事：

把一份已经强耦合 Anthropic 生态、带着官方产品假设、带着历史行为惯性的代码，改造成一套可以在本地模型和本地网关上稳定运行、同时尽量保留 Claude Code 操作手感的系统。

---

## 第一部分：从已知状态到目标状态，我们到底差了什么

### 1. 我们最开始手里有什么

一开始我们已有的是：

- 一个 `claude-code-haha` 仓库
- 它在界面、交互、命令组织、工具调用节奏上，确实更接近 Claude Code 原版手感
- 但它的底层假设仍然是：
  - 默认连接 Anthropic 官方服务
  - 默认相信自己运行在 Claude 官方产品体系里
  - 默认模型是 Claude 的 Sonnet / Opus / Haiku
  - 默认很多能力来自第一方账户、第一方配置、第一方远程入口

也就是说，它像的是“表”，但内里仍然是“官方客户端”。

### 2. 我们真正想要的目标状态是什么

目标状态并不是“能跑就行”，而是同时满足四个条件：

1. 保留 Claude Code 的交互手感
2. 模型请求不再强制走 Anthropic 官方
3. 可以连接本地大模型，也可以连接其他 API
4. 整体使用方式仍然简单，最好一键启动，最好支持 MCP、slash commands、工具调用、会话恢复

这意味着我们的目标不是“另起炉灶写一个新前端”，而是：

- 保住旧前端的体验资产
- 把它背后的依赖逻辑改掉

### 3. 起点和终点之间真正的差距

如果只看表面，会以为差距只是“把 API 地址改成本地就行”。

但真正的差距远不止这一层。

#### 差距一：协议表面相似，但产品假设不同

`claude-code-haha` 使用的是 Anthropic 风格的消息和工具语义。  
本地模型、Ollama、OpenAI 兼容接口、第三方推理服务，虽然都“像聊天模型”，但并不天然等价于 Claude 官方后端。

这就导致一个核心问题：

- 前端以为自己面对的是“Anthropic 官方语义”
- 但后端实际上变成了“本地模型 + 兼容网关”

如果不处理中间这层差异，就会出现：

- thinking 参数不兼容
- 工具调用 schema 不兼容
- 模型列表和显示名不真实
- 登录态冲突
- 某些命令和入口虽然能显示，但根本没有意义

#### 差距二：界面像 Claude Code，不代表行为像 Claude Code

原始仓库的“像”，很大一部分来自：

- Ink/TUI 渲染
- slash commands
- 会话和状态栏
- 欢迎页和模型菜单

但这些界面表现背后绑定的是一整套行为前提：

- 用 Claude 账户
- 用官方模型名
- 用官方远程配置
- 用官方 Web / bridge / release notes / update 流程

所以我们面对的不是“界面问题”，而是“界面和行为绑定错位”的问题。

#### 差距三：我们要的是“本地优先”，原代码却是“官方优先”

原项目里大量逻辑默认认为：

- Anthropic first-party 是主路径
- 其它 provider 是例外路径

而我们的目标恰恰相反：

- 本地模型和本地网关要成为主路径
- Anthropic 官方能力要降级为非主路径，甚至在本地模式下被禁用

这意味着我们不能只做“兼容”，而必须做“主次翻转”。

#### 差距四：模型可选，不等于模型可用

用户最初关心的是：

- 能不能选本地模型
- 能不能选云端模型

但真正的问题是：

- 某个模型能不能承受 Claude Code 的工具调用节奏
- 某个模型能不能接受 thinking 控制
- 某个模型能不能在当前 router/Ollama 上真实跑通

所以问题本质不是“能不能显示在 `/model` 菜单里”，而是：

- 能不能进入这套 agent 工作流
- 能不能在保留手感的前提下稳定工作

#### 差距五：MCP 不是有没有配置，而是有没有进入当前工作流

桌面版 Claude 目录里原来就有很多 MCP 配置。  
但“有配置”不等于“在现在这个项目里可用”。

真正要解决的是：

- 怎么把桌面版 Claude 的 MCP 搬进项目
- 怎么把 token、connection string 等敏感信息安全迁移
- 怎么让 local-first 启动脚本自动加载这些迁移结果
- 怎么让 `/mcp` 页面展示得不吵、不乱、还能诊断

### 4. 任务最终被转化成了什么核心问题

如果把所有细节压缩成一句话，这次项目真正要解决的是：

**如何在不重写前端核心交互的前提下，把一个“Anthropic 官方优先”的客户端，改造成一个“本地网关优先、本地模型优先”的 Claude Code 风格工作台。**

进一步拆开，就是三个核心问题：

1. 如何把“官方依赖”换成“兼容网关”
2. 如何把“官方行为假设”换成“本地优先假设”
3. 如何把“可运行”提升为“可长期使用”

这三个问题里，最核心的问题其实不是 API，而是：

**前端语义和后端现实之间的对齐。**

也就是：

- 前端以为自己是谁
- 后端实际上是什么
- 用户最终感受到的是否还是那个熟悉的工作节奏

---

## 第二部分：我们用了什么代码，一步一步完成这次改造

这一部分按真实过程来讲，而不是按最后看起来整洁的结构来讲。

### 第一步：先确定“不要推翻前端，只改运行通道”

这是整个项目最重要的路线判断。

我们没有走：

- 重写一个多 provider 前端
- 把所有模型协议抽象成统一 provider 层
- 在前端里为 OpenAI / Ollama / DeepSeek / Qwen 各写一套逻辑

原因很简单：

- 那样工作量大
- 风险高
- 最容易丢失 Claude Code 原本的操作手感

所以我们采用的是：

- 前端继续说 Anthropic 风格“语言”
- 中间加一个 `Anthropic-compatible` 网关
- 把适配工作压到 router 层

这里的关键文件和脚本包括：

- [scripts/start-router.ts](/E:/Workspace/claude-code-haha/scripts/start-router.ts)
- [scripts/setup-local-first.ts](/E:/Workspace/claude-code-haha/scripts/setup-local-first.ts)
- [scripts/start-local-first.ts](/E:/Workspace/claude-code-haha/scripts/start-local-first.ts)
- [scripts/dev-local-first.ts](/E:/Workspace/claude-code-haha/scripts/dev-local-first.ts)
- [router/claude-code-router/config.ollama.minimal.json](/E:/Workspace/claude-code-haha/router/claude-code-router/config.ollama.minimal.json)
- [router/claude-code-router/config.hybrid.example.json](/E:/Workspace/claude-code-haha/router/claude-code-router/config.hybrid.example.json)

这一步对应的方法论是：

- 明确目标：保留前端手感
- 寻找条件：Anthropic-compatible 网关存在
- 抉择通道：不改前端语义，只改后端通路

### 第二步：引入 `local-first`，把“官方优先”翻成“本地优先”

这一步不是简单加个环境变量，而是给整个项目增加一种“新的存在方式”。

我们定义了 `local-first` 模式，让它成为整个运行链的主开关。

关键文件：

- [src/utils/localFirst.ts](/E:/Workspace/claude-code-haha/src/utils/localFirst.ts)
- [src/utils/privacyLevel.ts](/E:/Workspace/claude-code-haha/src/utils/privacyLevel.ts)

然后围绕这个开关，逐步去掉那些只有官方产品场景才合理的入口。

主要包括：

- 登录 / OAuth 相关路径
- Web setup / remote-control / desktop handoff / mobile handoff
- release notes / upgrade / feedback 这类第一方产品入口
- 远程 managed settings 和 policy limits 同步
- 官方 MCP registry 预取

相关文件：

- [src/utils/auth.ts](/E:/Workspace/claude-code-haha/src/utils/auth.ts)
- [src/services/remoteManagedSettings/syncCache.ts](/E:/Workspace/claude-code-haha/src/services/remoteManagedSettings/syncCache.ts)
- [src/services/policyLimits/index.ts](/E:/Workspace/claude-code-haha/src/services/policyLimits/index.ts)
- [src/services/mcp/officialRegistry.ts](/E:/Workspace/claude-code-haha/src/services/mcp/officialRegistry.ts)
- [src/commands.ts](/E:/Workspace/claude-code-haha/src/commands.ts)
- [src/main.tsx](/E:/Workspace/claude-code-haha/src/main.tsx)
- [src/entrypoints/cli.tsx](/E:/Workspace/claude-code-haha/src/entrypoints/cli.tsx)

这一步解决的是：

- 前端不再误以为自己还活在官方产品环境里
- 用户看到的命令和行为开始与本地部署现实一致

### 第三步：先让它能跑起来，再让它“像原来那样好用”

一开始最直接的问题是：

- 前端会强连官方
- 本地网关没真正接起来
- 启动链不稳定

于是我们做了第一轮基础设施收口：

#### 1. 统一环境文件

让这套系统真正有“可启动”的最小配置。

关键文件：

- [.env.local-first.example](/E:/Workspace/claude-code-haha/.env.local-first.example)
- [router/claude-code-router/providers.env.example](/E:/Workspace/claude-code-haha/router/claude-code-router/providers.env.example)
- [scripts/local-first-utils.ts](/E:/Workspace/claude-code-haha/scripts/local-first-utils.ts)

#### 2. 让脚本自动探测模型

而不是要求每次手写配置。

关键能力：

- 探测本机 `ollama list`
- 根据模型名给不同模型打分
- 挑默认模型、think 模型、general 模型

关键文件：

- [scripts/local-first-utils.ts](/E:/Workspace/claude-code-haha/scripts/local-first-utils.ts)
- [scripts/setup-local-first.ts](/E:/Workspace/claude-code-haha/scripts/setup-local-first.ts)

#### 3. 让 router 配置能自动同步到 CCR 实际读取的位置

这是个非常关键的现实问题。

我们发现 `ccr` 当前版本对 `--config` 支持并不稳定，所以不能理想主义地以为“传个 config 路径就好了”。

于是我们改成：

- 启动前把模板配置同步到
  [C:\Users\lenovo\.claude-code-router\config.json](/C:/Users/lenovo/.claude-code-router/config.json)
- 如果原来有旧配置，自动备份

这一步看起来像妥协，实际上是把“不稳定依赖”变成“可控行为”。

关键文件：

- [scripts/start-router.ts](/E:/Workspace/claude-code-haha/scripts/start-router.ts)
- [scripts/local-first-utils.ts](/E:/Workspace/claude-code-haha/scripts/local-first-utils.ts)

### 第四步：处理“模型能显示”和“模型能工作”之间的差异

这一步是项目从“可跑”到“可用”的关键。

一开始用户看到 `/model` 菜单里仍然是：

- Sonnet
- Opus
- Haiku

甚至模型会自称：

- 我是 Claude Sonnet 4.6

这说明：

- 后端也许已经改了
- 但前端的展示语义还没改

所以我们做了几件事：

#### 1. 改 provider 识别逻辑

让前端知道：

- 现在不是 Anthropic first-party
- 而是一个本地 Anthropic-compatible gateway

关键文件：

- [src/utils/model/providers.ts](/E:/Workspace/claude-code-haha/src/utils/model/providers.ts)

#### 2. 改模型显示逻辑

让欢迎页、状态栏、模型菜单优先显示真实本地模型。

关键文件：

- [src/utils/model/model.ts](/E:/Workspace/claude-code-haha/src/utils/model/model.ts)
- [src/utils/model/modelOptions.ts](/E:/Workspace/claude-code-haha/src/utils/model/modelOptions.ts)
- [src/utils/logoV2Utils.ts](/E:/Workspace/claude-code-haha/src/utils/logoV2Utils.ts)
- [src/utils/status.tsx](/E:/Workspace/claude-code-haha/src/utils/status.tsx)

#### 3. 改系统提示词

不再强迫模型自称“官方 Claude 托管模型”。

关键文件：

- [src/constants/system.ts](/E:/Workspace/claude-code-haha/src/constants/system.ts)
- [src/constants/prompts.ts](/E:/Workspace/claude-code-haha/src/constants/prompts.ts)

#### 4. 扩展自定义模型列表

把我们真正要用的这些模型加入 `/model` 可选列表：

- `qwen3.5:35b`
- `gemma4:31b`
- `deepseek-coder:6.7b`
- `deepseek-coder-v2:16b`
- `deepseek-coder-v2:236b`
- `qwen3.5:397b-cloud`
- `minimax-m2.7:cloud`

关键文件：

- [src/utils/model/modelOptions.ts](/E:/Workspace/claude-code-haha/src/utils/model/modelOptions.ts)
- [router/claude-code-router/config.ollama.minimal.json](/E:/Workspace/claude-code-haha/router/claude-code-router/config.ollama.minimal.json)
- [router/claude-code-router/config.hybrid.example.json](/E:/Workspace/claude-code-haha/router/claude-code-haha/router/claude-code-router/config.hybrid.example.json)

### 第五步：解决 thinking 和工具调用的真实兼容问题

这是最能体现“发现差异，揭示本质”的地方。

用户最开始看到的报错是：

- 某模型不支持 thinking

这一下就把问题的本质暴露出来了：

- 我们不是只在换模型名
- 我们是在把 Claude 的行为约束施加到别的模型上

于是我们开始区分：

- 哪些模型适合做默认交互
- 哪些模型只能做备选
- 哪些模型不能接受某些 Claude 风格参数

最终我们让脚本自动偏向：

- 默认交互：`qwen3.5:35b`
- 长上下文/通用：`gemma4:31b`
- `deepseek-coder:6.7b` 保留为可选，但不做默认交互

关键文件：

- [src/utils/thinking.ts](/E:/Workspace/claude-code-haha/src/utils/thinking.ts)
- [src/utils/model/modelSupportOverrides.ts](/E:/Workspace/claude-code-haha/src/utils/model/modelSupportOverrides.ts)
- [scripts/setup-local-first.ts](/E:/Workspace/claude-code-haha/scripts/setup-local-first.ts)

这一步解决的是：

- “能显示”不等于“能做默认模型”
- “能跑一句话”不等于“能承受 agent 工作流”

### 第六步：解决启动 UI 抖动，让“像”不只是表面像

这一步最能说明：

我们追求的不是“只要别崩就行”，而是“尽量保留那种熟悉的感觉”。

一开始欢迎页会像放 PPT 一样逐步变宽，这是因为：

- 启动早期宽度还不稳定
- 布局不断重算
- 最终导致欢迎头部反复重绘

我们先用压缩模式止血，然后再做更细的修复：

- 先进入稳定状态
- 等终端宽度稳定
- 再回到原来的完整欢迎布局

关键文件：

- [src/components/LogoV2/LogoV2.tsx](/E:/Workspace/claude-code-haha/src/components/LogoV2/LogoV2.tsx)

这一步解决的是：

- 不只是“别抖”
- 而是“既不抖，又尽量保留原来的观感”

### 第七步：把 Claude Desktop 里的 MCP 迁进项目

这是“构造相同，联系相似”的典型案例。

我们已经在桌面版 Claude 里配置了大量 MCP：

- playwright
- windows
- filesystem
- git
- github
- pandas-mcp
- alphavantage
- financial-datasets
- postgres
- n8n-mcp

问题不是“这些 MCP 存不存在”，而是：

- 它们还在旧世界里
- 没进入新项目
- 没进入新的 local-first 启动链

于是我们做了 MCP 迁移脚本。

关键文件：

- [scripts/import-claude-desktop-mcp.ts](/E:/Workspace/claude-code-haha/scripts/import-claude-desktop-mcp.ts)
- [src/utils/claudeDesktop.ts](/E:/Workspace/claude-code-haha/src/utils/claudeDesktop.ts)
- [src/utils/platform.ts](/E:/Workspace/claude-code-haha/src/utils/platform.ts)

具体做法：

1. 读取桌面版 Claude 配置
2. 解析 `mcpServers`
3. 把项目共享配置写入 [`.mcp.json`](/E:/Workspace/claude-code-haha/.mcp.json)
4. 把 secrets 拆进 `.env.mcp.local`
5. 生成 [`.env.mcp.local.example`](/E:/Workspace/claude-code-haha/.env.mcp.local.example)
6. 让 local-first 启动脚本自动加载 `.env.mcp.local`

这一步真正重要的是：

- 不只是迁移配置
- 而是把“历史积累”接入“新的运行秩序”

### 第八步：修 MCP 管理页，让项目 MCP 成为主视图

迁移 MCP 成功后，新的问题马上出现了：

- `/mcp` 页面里 built-in plugin MCP 太多
- 全都堆出来显得很乱
- 项目真正关心的 MCP 被淹没了

这里我们没有粗暴地删功能，而是做了“主次重排”：

- 在 `local-first` 下，MCP 管理页优先聚焦项目级 MCP
- built-in plugin MCP 不再占满主视图
- 如果要看完整健康状态，依然可以用 CLI：
  `bun ./scripts/start-local-first.ts mcp list`

关键文件：

- [src/components/mcp/MCPSettings.tsx](/E:/Workspace/claude-code-haha/src/components/mcp/MCPSettings.tsx)
- [src/components/mcp/MCPListPanel.tsx](/E:/Workspace/claude-code-haha/src/components/mcp/MCPListPanel.tsx)

这一步非常重要，因为它体现了一个原则：

**不是所有信息都该在主界面出现。**

真正好的界面不是“把所有东西都展示出来”，而是：

- 让最相关的东西先出现
- 把诊断信息留给需要的时候

### 第九步：修一键启动，让“能启动”变成“稳定能启动”

这是后期最现实的一步，也是最像工程的地方。

用户实际遇到的问题是：

- `bun run dev:local-first`
- 只打印一句：
  `Synced CCR config to ...`
- 然后看起来没打开

这时真正要做的不是“解释”，而是“追链路”。

我们逐段排查发现：

1. 前端命令本身没错
2. router 有时没真的起来
3. 在这台 Windows 机器上，`ccr start` 不够稳定
4. `ccr restart` 反而更稳定
5. `dev:local-first` 需要更明确的重试和更清晰的失败提示

所以我们改了：

#### 1. `dev-local-first.ts`

- 增加 router readiness 重试
- 增加更明确的失败提示
- 让它确认 router ready 后，再 handoff 给 `start-local-first.ts`

#### 2. `start-router.ts`

- 在这台 Windows 环境下默认走更稳的 `ccr restart`
- 不再依赖不稳定的 start 路径

关键文件：

- [scripts/dev-local-first.ts](/E:/Workspace/claude-code-haha/scripts/dev-local-first.ts)
- [scripts/start-router.ts](/E:/Workspace/claude-code-haha/scripts/start-router.ts)

这一步是非常典型的：

- 不是重新设计系统
- 而是在真实环境里识别最脆弱的那一段
- 然后用最小但有效的改动把它做稳

### 第十步：持续修正文档，让系统“可交接、可复用”

这次项目不是只改代码，还不断把认知沉淀进文档。

我们陆续完善了：

- [README.md](/E:/Workspace/claude-code-haha/README.md)
- [README.en.md](/E:/Workspace/claude-code-haha/README.en.md)
- [docs/local-first.md](/E:/Workspace/claude-code-haha/docs/local-first.md)
- [docs/router-setup.md](/E:/Workspace/claude-code-haha/docs/router-setup.md)
- [docs/local-first-operations.md](/E:/Workspace/claude-code-haha/docs/local-first-operations.md)
- [docs/mcp-desktop-import.md](/E:/Workspace/claude-code-haha/docs/mcp-desktop-import.md)
- [docs/local-first-final-summary.md](/E:/Workspace/claude-code-haha/docs/local-first-final-summary.md)

文档在这里不是附属品，而是工程的一部分。

因为这次项目的目标不是“当前作者自己知道怎么跑”，而是：

- 别人也能接手
- 以后自己也能回看
- 配置、路径、启动方式、排障方式都有明确说明

---

## 第三部分：我们主要做了什么

如果只用最简洁的话来概括，这次项目主要做了三件事。

### 1. 我们没有重写 Claude Code，而是重定向了 Claude Code

我们保住了原本最宝贵的东西：

- 终端操作手感
- slash commands
- 工具调用循环
- MCP 交互结构

同时把它背后的“官方依赖”替换成了：

- 本地网关
- 本地模型
- 可选的第三方模型服务

### 2. 我们没有追求表面兼容，而是解决了语义错位

真正修掉的不是几个字符串、几个模型名，而是这些更本质的问题：

- 前端以为自己是谁
- 模型实际上是谁
- 参数到底该怎么传
- 哪些入口该保留，哪些入口该关闭
- 哪些信息该显示，哪些信息该收起来

### 3. 我们把一个“勉强能跑的 fork”做成了一套“可以长期用的工作流”

最终成果不是单个 patch，而是一整套可持续使用的本地方案：

- `local-first` 运行模式
- router 启动链
- 本地/混合模型策略
- 多模型选择
- MCP 迁移与加载
- 启动稳定性增强
- 文档化和可交接化

一句话总结：

**我们做的不是“把 Claude Code 改到能连本地模型”，而是把它从一个依附官方生态的前端，转化成了一套本地优先、仍保留原始工作节奏的生产级工作台。**

