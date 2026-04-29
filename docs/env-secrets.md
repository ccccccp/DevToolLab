# DevToolLab 生产密钥生成建议

这份说明专门写 `ADMIN_SESSION_SECRET` 和 `DEVTOOLLAB_WORKER_API_SECRET` 怎么生成、怎么区分使用。

## 原则

- 两个 secret 不建议用同一个值。
- 生产环境要用随机、不可预测、足够长的字符串。
- 不要把本地开发值直接复制到生产。
- 不要用项目名、日期、手机号、邮箱这类可猜测内容。

## 两个变量分别做什么

- `ADMIN_SESSION_SECRET`：用于后台会话 Cookie 签名。
- `DEVTOOLLAB_WORKER_API_SECRET`：用于 `admin -> worker` 的内部接口鉴权。

它们职责不同，最好分开，方便以后单独轮换。

## 推荐生成方式

### PowerShell

可以直接生成两份随机值：

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

如果你想要更长一点，也可以把 `48` 改成 `64`。

### Cloudflare Dashboard

也可以直接在 Cloudflare 后台的 `Variables and Secrets` 里手动粘贴两份不同的随机串：

- `ADMIN_SESSION_SECRET`
- `DEVTOOLLAB_WORKER_API_SECRET`

这种方式最直观，适合生产环境。

### 项目脚本

仓库根目录也提供了一个脚本，方便你本地直接生成：

```bash
npm run gen:secret
```

如果你想一次生成两份，可以直接用：

```bash
npm run gen:secrets
```

## 一个可执行模板

建议你在生产环境这样理解：

- `ADMIN_SESSION_SECRET` = 后台登录会话的签名密钥
- `DEVTOOLLAB_WORKER_API_SECRET` = 后台访问 worker 内部 API 的鉴权密钥

两者都可以是随机串，但不要相同。

## 本地开发

本地开发时为了方便，两个值临时一样也能跑，但只建议用于本地调试，不要带到正式环境。

## 额外建议

- 生成后不要再写回仓库。
- 不要把 secret 放进聊天记录、截图、issue。
- 如果以后怀疑泄露，优先轮换 `DEVTOOLLAB_WORKER_API_SECRET`，再轮换 `ADMIN_SESSION_SECRET`。
