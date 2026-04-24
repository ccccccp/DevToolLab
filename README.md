# DevToolLab

单仓多应用初始化骨架：

- `apps/web`：前台内容站与工具站
- `apps/admin`：后台运营系统
- `apps/worker`：抓取、AI 处理、对外 API、定时任务
- `packages/shared`：共享类型与示例数据

## 快速开始

```bash
npm install
npm run dev:web
```

其他常用命令：

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
- 建表迁移在 `apps/worker/migrations`
- 初始种子在 `apps/worker/seed.sql`
- `web` 和 `admin` 默认通过 `http://127.0.0.1:8787` 访问 Worker API
- 如果 API 地址不同，可设置环境变量 `DEVTOOLLAB_API_BASE_URL`
- 当前 `database_id` 是本地开发占位值，接远端 Cloudflare D1 前需要先创建真实数据库再替换

## Worker 本地 OpenAI 调试

- `apps/worker/.env.local`：
  - 作用于本地 Node / `npm` / smoke test 进程
  - 适合放 `HTTP_PROXY`、`HTTPS_PROXY`、`NODE_USE_ENV_PROXY`
- `apps/worker/.dev.vars`：
  - 作用于 `wrangler dev` 启动后的 Worker 运行时绑定，也就是代码里的 `c.env`
  - 本地如果要让 Worker 直接走 OpenAI 兼容中转地址，应在这里设置：
    - `OPENAI_BASE_URL=http://127.0.0.1:8788/v1`
    - `OPENAI_API_KEY=...`

注意：
- 只改 `.env.local` 不足以影响 Worker 运行时代码里的 `c.env`
- `wrangler.jsonc` 里的 `vars` 是默认值，本地开发时会被 `.dev.vars` 覆盖
- `.env.local` 和 `.dev.vars` 都是本地文件，不应提交真实密钥
- 这个项目现在内置了一个本地 OpenAI 中转服务，默认端口 `8788`
- 启动顺序建议是：
  - `npm run dev:openai-proxy`
  - `npm run dev:worker`

## 部署与环境变量 (Deployment)

在生产环境下部署时，必须正确配置以下三类环境变量，以确保各应用间通信正常且敏感信息安全。

### 1. 前端应用 (apps/admin & apps/web)
这两个应用通常部署在 Vercel 或 Cloudflare Pages 上。
- `DEVTOOLLAB_API_BASE_URL`: **必须**。指向 Worker API 的真实线上地址（如 `https://api.yourdomain.com`）。
- `NEXT_PUBLIC_WEB_URL`: (Admin 端专用) 指向 C 端网站域名，用于预览已发布的文章。

### 2. 后端 API (apps/worker)
部署在 Cloudflare Workers。
- **wrangler.jsonc (公开变量)**: 
    - `OPENAI_MODEL`: 使用的 AI 模型。
    - `OPENAI_BASE_URL`: API 代理地址。
- **Secret (敏感变量)**: 
    - 不要写在配置文件中！请使用命令设置：`npx wrangler secret put OPENAI_API_KEY`。

### 3. 为什么需要多处配置？
- **安全性**: 敏感的 API Key 必须通过 Secret 存储，不能随代码提交。
- **跨域 (CORS)**: 前端域名与 API 域名通常不同。Worker 内部已开启 CORS 支持，但前端必须通过 `DEVTOOLLAB_API_BASE_URL` 明确知道向哪里发起请求。
- **Next.js 限制**: 只有以 `NEXT_PUBLIC_` 开头的变量才会被浏览器读取，其他变量仅在服务端可用。

## 当前约束

- 先保持单仓，不拆独立 UI 仓库
- 先做最小可运行骨架，再补业务能力
- Worker 先承接 API 与流水线入口，复杂异步能力后续再加
