# DevToolLab

单仓多应用初始化骨架。

- `apps/web`：前台内容站
- `apps/admin`：后台运营系统
- `apps/worker`：抓取、AI 处理、对外 API、定时任务
- `packages/shared`：共享类型与示例数据

## 快速开始

```bash
npm install
npm run dev:web
```

常用命令：

```bash
npm run dev:admin
npm run dev:worker
npm run dev:openai-proxy
npm run db:migrate:local
npm run db:seed:local
npm run build
npm run typecheck
```

## 本地 D1

- D1 绑定在 `apps/worker/wrangler.jsonc`
- 迁移文件在 `apps/worker/migrations`
- 初始种子在 `apps/worker/seed.sql`
- `web` 和 `admin` 默认通过 `http://127.0.0.1:8787` 访问 Worker API
- 如果 API 地址不同，可设置 `DEVTOOLLAB_API_BASE_URL`

## Worker 本地 AI 调试

`apps/worker/scripts/openai-proxy.mjs` 是本地 OpenAI 兼容中转服务，适合在需要代理上网的环境下测试 AI 请求。

## AI 配置

Worker 的文章生成和摘要流程使用统一的 OpenAI 兼容适配层，支持以下 provider：

- `openai`
- `deepseek`
- `grok`

只保留一个选择开关：

- `AI_PROVIDER`：`openai`、`deepseek` 或 `grok`

其余配置都写成 provider 专属变量，切换模型时只改环境变量，不改代码：

- `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`、`OPENAI_TIMEOUT_MS`
- `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`、`DEEPSEEK_TIMEOUT_MS`
- `XAI_API_KEY`、`XAI_BASE_URL`、`XAI_MODEL`、`XAI_TIMEOUT_MS`

默认值如下：

- `openai`：`https://api.openai.com/v1`，`gpt-4o-mini`
- `deepseek`：`https://api.deepseek.com/v1`，`deepseek-v4-flash`
- `grok`：`https://api.x.ai/v1`，`grok-4`

如果要从 OpenAI 切到 DeepSeek 或 Grok，直接改 `AI_PROVIDER`，再补对应 provider 的 Key、Base URL 和模型名即可。

## 部署变量

### 前端应用

`apps/web` 和 `apps/admin` 常见部署变量：

- `DEVTOOLLAB_API_BASE_URL`：Worker API 地址
- `NEXT_PUBLIC_WEB_URL`：`admin` 用于预览文章跳转

### Worker

部署到 Cloudflare Workers 时，建议把敏感配置放到 Secret：

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `XAI_API_KEY`

不要把密钥写进 `wrangler.jsonc`。可以使用：

```bash
npx wrangler secret put OPENAI_API_KEY
```

`wrangler.jsonc` 里的 `vars` 只放默认值，例如 `AI_PROVIDER`、`OPENAI_BASE_URL`、`OPENAI_MODEL`、`OPENAI_TIMEOUT_MS`。

## 当前约束

- 先保持单仓，不拆独立 UI 仓库
- 先做最小可运行骨架，再补业务功能
- Worker 先承接 API 与流水线入口，复杂异步能力后续再加
