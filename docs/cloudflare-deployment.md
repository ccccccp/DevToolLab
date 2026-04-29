# DevToolLab Cloudflare 部署说明

这份文档说明如何把当前仓库完整部署到 Cloudflare。

当前前提：
- 你已经有 Cloudflare 账号。
- 还没有购买自己的域名。
- 仓库里的 `worker` 已经是 Cloudflare Workers 形态。
- `web` 和 `admin` 目前是标准 Next.js 应用，若要也部署到 Cloudflare，需要使用 Cloudflare 支持的 Next.js 运行方案。

## 部署目标

推荐的最终形态是：
- `apps/worker` 部署到 Cloudflare Workers
- `apps/web` 部署到 Cloudflare Workers
- `apps/admin` 部署到 Cloudflare Workers
- 数据存储使用 D1
- 定时任务使用 Cron Triggers
- 以后买了域名，再把 Worker 绑定到自定义域名

如果你现在还没有域名，可以先全部使用 Cloudflare 提供的 `workers.dev` 访问地址上线。

## 1. 先理解当前仓库的边界

当前仓库里，真正的后端数据与调度逻辑在 `apps/worker`：
- 文章、工具、审核、用户、任务都从这里读写
- AI 摘要和抓取调度也在这里执行
- `worker` 的 `scheduled()` 处理器会接管 Cron Trigger

`web` 和 `admin` 主要负责前台展示和后台操作界面：
- `web` 负责内容展示
- `admin` 负责运营管理
- 它们通过 `DEVTOOLLAB_API_BASE_URL` 访问 worker 提供的数据接口

## 2. Cloudflare 资源准备

先在 Cloudflare 控制台准备这些资源：

- 一个 Cloudflare 账号
- 一个 D1 数据库
- 以后需要时再准备 R2 或 KV

当前代码里，真正用到的是 D1。R2/KV 目前不是必须项，不要为了部署强行多建资源。

### 2.1 创建 D1

建议先创建正式库，例如：
- `devtoollab-prod`

如果你还想保留测试环境，可以再建一个：
- `devtoollab-staging`

创建后，把数据库绑定到 `apps/worker/wrangler.jsonc` 的 `d1_databases` 里。

### 2.2 应用迁移

上线前必须把迁移执行到正式库。

本地开发库可先执行：

```bash
npm run db:migrate:local -w @devtoollab/worker
```

正式库执行时，使用远端迁移命令：

```bash
cd apps/worker
npx wrangler d1 migrations apply devtoollab --remote
```

如果你正式库名字不是 `devtoollab`，把命令里的名字替换成你的数据库名。

## 3. 部署 worker

`apps/worker` 是最先要部署的部分，因为它是数据和调度源头。

### 3.1 配置环境变量和密钥

worker 至少需要这些配置：

- `AI_PROVIDER`
- `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY` 或 `XAI_API_KEY`
- 对应的 `*_BASE_URL`
- 对应的 `*_MODEL`
- `DEVTOOLLAB_WORKER_API_SECRET`

其中：
- `DEVTOOLLAB_WORKER_API_SECRET` 要和 admin 侧一致
- `DEVTOOLLAB_WORKER_API_SECRET` 只用于 admin 和 worker 之间的内部请求鉴权

建议把敏感值放在 Cloudflare Secrets，不要直接写死在仓库里。

### 3.2 部署命令

进入 worker 目录后部署：

```bash
cd apps/worker
npx wrangler deploy
```

第一次部署后，Cloudflare 会给这个 Worker 分配一个 `workers.dev` 地址。

### 3.3 Cron Trigger

当前 worker 已经配置了 cron：

- `*/5 * * * *`

这表示每 5 分钟检查一次待执行的定时抓取任务。

注意：
- 线上会自动触发
- 本地 `wrangler dev` 默认不会自动触发
- 本地要测试 scheduled 逻辑，需要手动调用测试入口或开启 `--test-scheduled`

本地手动测试：

```bash
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

## 4. 部署 web 和 admin

这两个应用是 Next.js 全栈应用，不建议用纯静态导出。
Cloudflare 官方对这类应用的推荐路径是部署到 Workers，并使用 OpenNext 适配层。

### 4.1 为什么不是静态 Pages

因为当前 `web` / `admin` 里有这些能力：
- Route Handlers
- Server Actions
- 动态会话
- 后台提交动作

这些都不是纯静态站能完整承载的。

### 4.2 推荐方案

如果你要把 `web` 和 `admin` 也完整搬到 Cloudflare，建议按 Cloudflare 官方 Next.js Workers 方案补适配层。

对每个 Next.js 应用分别做一次：

- 安装 `@opennextjs/cloudflare`
- 增加 `open-next.config.ts`
- 让构建产物输出到 `.open-next`
- 用 `nodejs_compat`
- 再用 `wrangler deploy`

官方推荐的方式是让 Next.js 项目通过 OpenNext 适配到 Workers。

### 4.3 你当前仓库的实际落地顺序

建议顺序如下：

1. 先把 `worker` 部署成功。
2. 再把 `web` 改成 Cloudflare Workers 目标。
3. 最后把 `admin` 改成 Cloudflare Workers 目标。

如果你想先快速上线，也可以先只部署 `worker`，`web/admin` 暂时还留在现有环境。但这不算“完整 Cloudflare 化”。

### 4.4 需要的关键环境变量

`web` 和 `admin` 都要能找到 worker 的 API 地址：

- `DEVTOOLLAB_API_BASE_URL`

`admin` 额外需要：

- `ADMIN_SESSION_SECRET`
- `DEVTOOLLAB_WORKER_API_SECRET`
- `NEXT_PUBLIC_WEB_URL`

如果还没有自定义域名，可以先把这些地址指向对应的 `workers.dev` URL。

## 5. 没有域名时怎么上线

你现在还没买域名，所以建议先用 Cloudflare 自动分配的地址。

可用的地址类型：
- Worker 的 `workers.dev` 子域名
- Next.js 应用部署后的 `workers.dev` 子域名

这种方式适合：
- 验证完整业务链路
- 给自己或团队内部使用
- 先做灰度和预发布

不建议直接拿 `workers.dev` 当最终正式品牌域名，但它足够让项目先完整跑起来。

## 6. 生产环境配置清单

上线前，至少确认下面这些都已设置：

- `apps/worker/wrangler.jsonc` 里的 D1 绑定指向正式数据库
- worker 的 AI 模型密钥已经配置
- `DEVTOOLLAB_WORKER_API_SECRET` 在 admin 和 worker 两边一致
- `ADMIN_SESSION_SECRET` 已设置为足够长的随机值
- `DEVTOOLLAB_API_BASE_URL` 指向 worker 的生产地址
- `NEXT_PUBLIC_WEB_URL` 指向 web 的生产地址
- Cron Trigger 已在 worker 上生效

## 7. 上线前检查顺序

建议按这个顺序验证：

1. 打开 `worker` 的生产地址，确认 health / dashboard / posts 接口可用。
2. 登录 `admin`，确认会话和用户管理可用。
3. 创建或编辑一篇文章，确认保存、发布、审核状态同步正常。
4. 禁用一个后台账号，确认旧登录态会失效。
5. 手动触发一次 scheduled 任务，确认抓取链路正常。
6. 查看 worker 日志，确认 AI 生成、审核、任务完成都没有报错。

## 8. 常见问题

### 8.1 迁移没跑

症状：
- 接口报 `no such table`

处理：
- 先执行 D1 迁移，再重启或重新部署 worker

### 8.2 worker 接口返回 401

症状：
- admin 请求 worker 时被拒绝

处理：
- 检查 `DEVTOOLLAB_WORKER_API_SECRET` 是否两边一致

### 8.3 本地不自动跑调度

症状：
- 本地 `wrangler dev` 里没有自动抓取

处理：
- 这是正常现象
- 用 `--test-scheduled` 或手动请求 scheduled 入口测试

### 8.4 还没有域名

症状：
- 想绑定正式域名但还没买

处理：
- 先用 `workers.dev` 上线
- 域名买好后，再在 Cloudflare 上绑定自定义域名

## 9. 后续买域名后的做法

等你买了域名，再把：
- `web`
- `admin`
- 可能还有 `worker`

绑定到自己的子域名，比如：
- `www.example.com`
- `admin.example.com`
- `api.example.com`

Cloudflare 官方对自定义域名是支持的，绑定后可以不用自己手工配证书。

## 参考

- Cloudflare Workers
- Cloudflare D1
- Cron Triggers
- Cloudflare Workers `workers.dev`
- Next.js on Cloudflare Workers

