# web / admin 接入 Cloudflare 的适配说明

这份文档只说明 `apps/web` 和 `apps/admin` 怎么按 Cloudflare 官方推荐方式接入 Next.js 适配层，以及这层适配对后续迁移的影响。

## 为什么要加适配层

Cloudflare 官方对 Next.js 的推荐路径是把现有 Next.js 应用通过 `@opennextjs/cloudflare` 适配到 Workers 运行时，而不是走静态导出。

原因很直接：

- `web` 和 `admin` 都是 App Router 应用。
- 这两个应用都用到了服务端能力，例如 Route Handler、Server Action、Middleware、会话读取、服务端请求。
- 纯静态 Pages 导出不适合这类 full-stack Next.js 应用。

所以这里采用的是：

- `next build` 仍然负责生成 Next 构建结果。
- `opennextjs-cloudflare build` 负责把 Next 构建结果转成 Cloudflare Workers 可运行的产物。
- `opennextjs-cloudflare deploy` 负责部署到 Cloudflare。

## 这次已经补好的内容

### `apps/web`

- 新增 `open-next.config.ts`
- 新增 `wrangler.jsonc`
- 新增 `public/_headers`
- 新增 `preview` / `deploy` 脚本

### `apps/admin`

- 新增 `open-next.config.ts`
- 新增 `wrangler.jsonc`
- 新增 `public/_headers`
- 新增 `preview` / `deploy` 脚本

### 仓库级别

- 根目录 `.gitignore` 已加入 `.open-next/`
- 根目录 `package.json` 增加了 `preview:web`、`preview:admin`、`deploy:web`、`deploy:admin`

## Cloudflare 上的推荐配置

`apps/web/wrangler.jsonc` 和 `apps/admin/wrangler.jsonc` 都采用了同样的基本结构：

- `main: ".open-next/worker.js"`
- `assets.directory: ".open-next/assets"`
- `compatibility_flag` 包含 `nodejs_compat`
- 额外加入 `global_fetch_strictly_public`
- `services` 增加 `WORKER_SELF_REFERENCE`

这套配置和 Cloudflare / OpenNext 的官方手册是一致的。

## 部署步骤

### 本地预览

在对应应用目录运行：

```bash
npm run preview -w @devtoollab/web
npm run preview -w @devtoollab/admin
```

### Cloudflare 部署

在对应应用目录运行：

```bash
npm run deploy -w @devtoollab/web
npm run deploy -w @devtoollab/admin
```

如果你用 Cloudflare Dashboard 的 Git 集成，也可以把 Deploy command 指向这两个脚本。

### 运行时变量

部署到 Cloudflare 后，需要继续配置这些变量：

- `DEVTOOLLAB_API_BASE_URL`
- `NEXT_PUBLIC_WEB_URL`
- `ADMIN_SESSION_SECRET`
- `DEVTOOLLAB_WORKER_API_SECRET`

如果后续还要加 OpenAI / DeepSeek / Grok 的模型变量，也还是按原来那套环境变量去配。

## 对以后迁移到其他平台的影响

影响不大，但要分两种情况看。

### 业务代码层面

影响很小。

现在的改动主要集中在：

- `open-next.config.ts`
- `wrangler.jsonc`
- `public/_headers`
- `preview` / `deploy` 脚本

这些都属于部署适配层，不是业务逻辑层。

你现在的页面、路由、组件、服务端逻辑、表单交互都没有被绑死在 Cloudflare 专属 API 上。

### 迁移回其他平台时

通常只需要做这些事：

- 删除或替换 `open-next.config.ts`
- 删除或替换 `wrangler.jsonc`
- 把 `preview` / `deploy` 脚本改回目标平台需要的命令
- 重新处理环境变量和密钥注入方式

如果迁移到：

- `Vercel`
- 自建 Node.js 服务
- 其他支持 Next.js 的平台

通常不需要重写页面和业务逻辑，只需要换部署层。

### 需要注意的点

- 如果未来某些代码开始直接依赖 Cloudflare 特有能力，比如 D1、KV、R2、Workers-only API，那么这部分会和平台绑定更紧。
- 目前 `web` 和 `admin` 还没有直接写 Cloudflare 数据绑定，主要还是通过 `worker` 接口拿数据，所以可迁移性还比较好。

## 结论

现在的做法是把 Cloudflare 适配限制在部署层，不把业务层写死。

这意味着：

- 现在可以按 Cloudflare 官方推荐方式部署
- 以后如果要换平台，代价主要是部署配置，不是大规模改业务代码
