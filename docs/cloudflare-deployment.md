# DevToolLab Cloudflare 部署说明

本文说明如何把当前仓库完整部署到 Cloudflare，按现在的项目状态编写，适用于你已经有 Cloudflare 账号、但还没买域名的情况。

当前仓库的部署边界是：

- `apps/worker`：Cloudflare Worker，负责 API、数据库、抓取、AI 摘要、审核流转、定时任务。
- `apps/web`：Next.js 前台内容站，已经接入 Cloudflare OpenNext 适配层。
- `apps/admin`：Next.js 后台管理站，已经接入 Cloudflare OpenNext 适配层。

## 1. 总体结论

现在这个项目可以分三部分部署：

1. `worker` 直接部署到 Cloudflare Workers。
2. `web` 通过 `@opennextjs/cloudflare` 部署到 Cloudflare Workers。
3. `admin` 通过 `@opennextjs/cloudflare` 部署到 Cloudflare Workers。

如果你现在还没有买域名，可以先全部跑在 Cloudflare 提供的 `workers.dev` 子域名下。
这样可以先验证完整业务链路，后面买了域名再绑定自定义域名。

## 2. 当前仓库里已经做好的 Cloudflare 适配

### 2.1 `worker`

`apps/worker` 目前已经是 Cloudflare Worker 形态，包含：

- D1 数据库绑定
- Cron Trigger
- AI 模型调用配置
- 后台接口鉴权头 `x-devtoollab-worker-secret`

### 2.2 `web`

`apps/web` 已经接入 Cloudflare 官方推荐的 Next.js Workers 方案，新增了：

- `apps/web/open-next.config.ts`
- `apps/web/wrangler.jsonc`
- `apps/web/public/_headers`
- `preview` / `deploy` 脚本

### 2.3 `admin`

`apps/admin` 也已经接入同样的 OpenNext 方案，新增了：

- `apps/admin/open-next.config.ts`
- `apps/admin/wrangler.jsonc`
- `apps/admin/public/_headers`
- `preview` / `deploy` 脚本

## 3. 需要先准备的 Cloudflare 资源

上线前，至少要准备这些资源：

- 一个 Cloudflare 账号
- 一个 D1 数据库
- Worker 的运行时变量和 Secrets

当前项目实际用到的是：

- D1
- Workers
- Cron Triggers

R2 和 KV 目前不是必须项，后续如果要做缓存或更复杂的静态资源策略，再按需增加。

## 4. 数据库准备

### 4.1 创建 D1

建议先创建正式库，例如：

- `devtoollab-prod`

如果你还想保留测试环境，也可以再建一个：

- `devtoollab-staging`

### 4.2 本地迁移

本地开发库执行：

```bash
npm run db:migrate:local -w @devtoollab/worker
```

### 4.3 远端迁移

远端正式库同步迁移执行：

```bash
npm run db:migrate:remote -w @devtoollab/worker
```

当前仓库里这个命令对应的是 `devtoollab-prod`。

### 4.4 常见注意点

- Worker 的 D1 绑定名是 `DB`。
- 本地迁移脚本已经改成按绑定名执行，不要再手写旧名字。
- 如果远端 D1 名字变了，记得同步更新 `apps/worker/package.json` 里的远端迁移命令。

## 5. 部署 worker

`worker` 是整套系统的数据与调度核心，建议先部署它。

### 5.1 必要环境变量

Worker 至少要配置这些变量：

- `AI_PROVIDER`
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `XAI_API_KEY`
- 对应的 `*_BASE_URL`
- 对应的 `*_MODEL`
- `DEVTOOLLAB_WORKER_API_SECRET`

其中：

- `DEVTOOLLAB_WORKER_API_SECRET` 必须和 `admin` 一致。
- 这是 admin 和 worker 之间内部接口校验用的密钥。

建议把敏感值存成 Cloudflare Secrets，不要直接写进仓库。

### 5.2 部署命令

进入 worker 目录后执行：

```bash
cd apps/worker
npx wrangler deploy
```

部署后 Cloudflare 会给这个 Worker 分配一个 `workers.dev` 地址。

### 5.3 Cron Trigger

当前 worker 的 cron 配置是：

- `*/5 * * * *`

含义是每 5 分钟检查一次待执行的定时抓取任务。

注意：

- 线上会自动触发。
- 本地 `wrangler dev` 默认不会自动触发 cron。
- 本地要测试 scheduled 逻辑，可以手动调用 scheduled 入口，或者使用 `--test-scheduled`。

## 6. 部署 web

`apps/web` 现在不是静态站点导出，而是走 Cloudflare 推荐的 Next.js Workers/OpenNext 方案。

### 6.1 已有配置

`apps/web` 已经具备：

- `open-next.config.ts`
- `wrangler.jsonc`
- `preview` / `deploy` 脚本

### 6.2 部署命令

```bash
npm run deploy -w @devtoollab/web
```

本地预览：

```bash
npm run preview -w @devtoollab/web
```

### 6.3 关键运行时变量

`web` 至少要能拿到：

- `DEVTOOLLAB_API_BASE_URL`

如果你后面绑定自定义域名，再把这个地址改成正式 worker API 地址即可。

## 7. 部署 admin

`apps/admin` 也已经切到 Cloudflare OpenNext 方案。

### 7.1 已有配置

`apps/admin` 已经具备：

- `open-next.config.ts`
- `wrangler.jsonc`
- `preview` / `deploy` 脚本

### 7.2 部署命令

```bash
npm run deploy -w @devtoollab/admin
```

本地预览：

```bash
npm run preview -w @devtoollab/admin
```

### 7.3 关键运行时变量

`admin` 至少需要这些变量：

- `DEVTOOLLAB_API_BASE_URL`
- `NEXT_PUBLIC_WEB_URL`
- `ADMIN_SESSION_SECRET`
- `DEVTOOLLAB_WORKER_API_SECRET`

其中：

- `DEVTOOLLAB_API_BASE_URL` 指向 worker 的生产地址。
- `NEXT_PUBLIC_WEB_URL` 指向前台 web 的生产地址。
- `ADMIN_SESSION_SECRET` 用来签发后台会话。
- `DEVTOOLLAB_WORKER_API_SECRET` 用来访问 worker 的内部管理接口。

## 8. 没有域名时怎么上线

你现在还没买域名，所以推荐先这样做：

1. 先把 `worker` 部署出去。
2. 再把 `web` 和 `admin` 都部署到各自的 `workers.dev` 子域名。
3. 先用这三个 `workers.dev` 地址跑完整链路。

这时你可以先验证：

- 前台文章列表是否正常
- 后台登录是否正常
- 文章创建、发布、审核是否正常
- 定时抓取和 AI 摘要是否正常

等域名买好以后，再把三个服务分别绑定到自定义域名。

## 9. 上线前检查清单

建议至少确认这些项都没问题：

- `apps/worker/wrangler.jsonc` 里的 D1 绑定已经指向正式库。
- `DEVTOOLLAB_WORKER_API_SECRET` 在 `worker`、`web`、`admin` 三边一致。
- `ADMIN_SESSION_SECRET` 已设置为足够长的随机串。
- `DEVTOOLLAB_API_BASE_URL` 已指向正确的 worker 地址。
- `NEXT_PUBLIC_WEB_URL` 已指向正确的 web 地址。
- worker 的 AI 模型密钥和模型名已经配置。
- D1 迁移已经同步到正式库。
- Cron Trigger 已在 worker 上生效。

## 10. 验证顺序

建议按这个顺序验证：

1. 打开 `worker` 的生产地址，确认 `/health`、`/api/dashboard` 等接口可用。
2. 打开 `admin`，确认登录、注册、账户页、用户管理页可用。
3. 创建或编辑一篇文章，确认保存、发布、审核状态同步正常。
4. 禁用一个后台账号，确认旧登录态失效。
5. 手动触发一次 scheduled 任务，确认抓取链路正常。
6. 查看 worker 日志，确认 AI 摘要、任务执行、审核流转没有报错。

## 11. 常见问题

### 11.1 迁移时报 `no such table`

通常说明 D1 迁移没有跑到正式库。

处理方式：

- 先执行远端迁移
- 再重新部署 worker

### 11.2 admin 访问 worker 返回 401

通常是内部密钥不一致。

处理方式：

- 检查 `DEVTOOLLAB_WORKER_API_SECRET`
- 确保 admin 和 worker 两边值一致

### 11.3 本地不自动触发定时任务

这是正常现象。

处理方式：

- 用手动 scheduled 入口测试
- 或者用 `--test-scheduled`

### 11.4 还没买域名

这是可以接受的。

处理方式：

- 先用 `workers.dev`
- 域名买好后再绑定自定义域名

## 12. 后续买域名后的调整

等你买了域名，可以把这三个服务分别绑定到自己的子域名，例如：

- `www.example.com` -> `web`
- `admin.example.com` -> `admin`
- `api.example.com` -> `worker`

如果后面要做正式生产，这通常是最终推荐形态。

## 13. 迁移到其他平台是否受影响

影响不大，但要分清楚层次。

### 13.1 业务代码层

目前 `web` 和 `admin` 的业务代码还是标准 Next.js 写法，没有直接绑定到 Cloudflare 特有 API，所以可迁移性还可以。

### 13.2 部署层

真正和 Cloudflare 绑定的是：

- `open-next.config.ts`
- `wrangler.jsonc`
- `public/_headers`
- `preview` / `deploy` 命令

如果以后迁移到其他平台，通常主要改这部分。

### 13.3 什么时候会更难迁移

如果后续你开始在 `web` 或 `admin` 里直接依赖：

- D1
- KV
- R2
- Workers 专属 API

那迁移成本会更高。

当前这套结构里，核心数据和鉴权还是以 `worker` 为中心，所以还没有把前台和后台彻底锁死在 Cloudflare 上。

## 14. 推荐的落地顺序

如果你现在要按最稳妥的方式上：

1. 先部署 `worker`
2. 再部署 `web`
3. 再部署 `admin`
4. 最后绑定域名

如果你想先快速验证，也可以先三者都跑 `workers.dev`，等业务稳定后再上自定义域名。

