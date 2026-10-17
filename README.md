# QQ Bot CF

跑在 Cloudflare Workers 上的 QQ 机器人：接入 QQ 开放平台官方网关，用任意 OpenAI 兼容模型在群聊和单聊里对话，自带可视化管理后台。

## 🚀 部署

全程**不需要填任何 ID**：D1 库会自动查找，没有就创建。

### 1. 连接 GitHub

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Create Worker** → **Connect Git repository**
2. 授权 GitHub，选这个仓库（或先 fork 一份到自己账号），点 **Begin setup**
3. **把部署命令改成 `npm run deploy`**（默认的 `npx wrangler deploy` 会丢 D1 绑定）
4. 点 **Deploy**

部署完成会自动：建/找 D1 库 → 部署 Worker。之后站点会显示「尚未完成配置」页。

### 2. 补两个密钥

[Cloudflare 控制台](https://dash.cloudflare.com/) → 本 Worker → Settings → **Variables and Secrets** → Add，**类型选 Secret**，加这两个：

- `ADMIN_TOKEN` —— 后台登录密码，16 位以上随机串
- `CONFIG_ENC_KEY` —— 加密主密钥，16 位以上随机串，加完不要改

加完点 **Deploy** 生效。

### 3. 登录后台

1. 数据表会在 Worker 启动时自动建好（无需手动建表）
2. 打开 `/login`，用 `ADMIN_TOKEN` 登录
3. 后台填 QQ AppID / Secret（未上线机器人开「沙箱环境」）和 AI Base URL / API Key，点「保存并重启」

---

## 🔄 更新

同步上游最新代码：GitHub 上打开你的 fork → **Sync fork** → 合并上游，Cloudflare 会自动重新构建部署。

- 密钥、业务配置、聊天记录都**不会丢**（详情见常见问题）
- **新版本自动接管**：部署后旧实例发现自己和 Worker 版本不一致，会主动断开让位，最多 1 分钟内新实例自动顶上，不用手动重启
- 若没 fork，直接 `git pull` 上游后 `npm run deploy` 即可

---

## ✨ 特性

- **零服务器**：一个 Worker + 一个 Durable Object + 一张 D1 表，全程免费额度内
- **官方网关**：WebSocket 长连接，断线自动重连，每分钟巡检一次；部署后新版本会自己接管，无需手动重启
- **多 AI 容错**：后台「AI 对话」可加多套 Base URL / Key / 模型，按顺序尝试，前一个超时或报错自动切下一个
- **密钥加密**：QQ Secret 与 AI Key 以 AES-256-GCM 加密后入库，后台不回显明文
- **标识脱敏**：会话 openid 入库前先做 SHA-256 指纹，只留 8 位十六进制，原始 openid 不落库、不入日志
- **零运行时依赖**：`dependencies` 是空的，只有 `wrangler` 一个开发依赖

---

## ❓ 常见问题

**为什么必须用 `npm run deploy`？**

`wrangler deploy` 会按配置文件**整体覆盖** Worker 的绑定，配置里没声明的绑定会被清掉——这就是「更新一次代码，数据库连接就没了」的根因。

但 `database_id` 每个账号不同，不能写死进仓库。所以仓库里的 `wrangler.toml` 故意不带 D1 段，由 `npm run deploy` 在部署时自动生成一份带绑定的配置再部署。

| 命令 | D1 绑定 |
|---|---|
| `npm run deploy` | ✅ 自动处理 |
| `npx wrangler deploy` | ❌ 被清掉 |

**密钥必须存成 Secret 吗？**

必须。Cloudflare 把「环境变量」和「Secret」分开处理：

- **普通变量（Text）**：每次 `wrangler deploy` 都会按配置整体覆盖，控制台手动加的会被清空（官方「source of truth」机制）
- **Secret（加密变量）**：deploy 不会删，除非手动 `wrangler secret delete <key>`

`ADMIN_TOKEN`、`CONFIG_ENC_KEY` 必须存成 Secret，否则每次重新部署都会消失，站点回到「尚未完成配置」页。（配置里已加 `keep_vars = true` 兜底，但正确做法仍是选 Secret。）

**更新代码后 D1 绑定不见了 / 后台显示「D1 数据库 待绑定」**

部署命令还是 `npx wrangler deploy`。改成 `npm run deploy` 再重新部署。数据不会丢，只是绑定被清空了。

**更新代码后站点变成「尚未完成配置」/ 提示环境变量缺失**

`wrangler deploy` 不会删 Secret，通常是：Worker 被删掉重建、控制台手动删过 Secret、或部署到了另一个 Worker 名。去控制台 Variables and Secrets 补上即可，`CONFIG_ENC_KEY` 必须用原来那个值。

**页面显示「加密主密钥需要处理」**

`CONFIG_ENC_KEY` 和库里已加密的数据对不上（多半是换了值）。改回最初的值即可，数据都还在。找不回原值就换新值，重新填一遍 QQ 凭据和 AI 接口（聊天记录不受影响）。

**部署报错 `10021 binding DB must have a valid database_id`**

部署命令被改回了 `npx wrangler deploy`。改回 `npm run deploy` 即可。

**登录报「服务器内部错误」**

通常是 D1 库没绑定（部署命令不是 `npm run deploy`）。表会在 Worker 启动时自动建好，无需手动建表。

**网关一直连不上，关闭码 4914**

机器人未上线，只能连沙箱。到后台打开「沙箱环境」。

**多个 AI 是怎么切换的？**

后台「AI 对话」里每条配置都是一套独立的 Base URL + API Key + 模型，列表从上到下就是优先级。机器人先请求第一个，遇到超时、网络错误、429 或 5xx 会先重试一次，仍然失败就换下一个，全部失败才回「出了点小状况」。停用的条目不参与。改完点「保存并重启」生效，聊天记录里的「模型」标签会写明是哪一套答的。

**「会话配额已用尽」**

QQ 官方限制每 24 小时可新建的 session 数（默认 1500），等配额重置即可。

**聊天记录里存的是什么？会保存 QQ 的 openid 吗？**

不会。Durable Object 的持久化存储里只有一个布尔值（`desired_running`，标记是否该保持在线），没有任何聊天内容；会话上下文只活在 DO 的内存里，重启即清空。落到 D1 的只有 `chat_log` 表：问题原文、回答原文，以及 `scope_id` / `user_id` —— 后两个存的是 openid 的 SHA-256 指纹（8 位十六进制），原始 openid 不入库、不写日志。这张表只留最近 2000 条，后台可一键清空。

---

## 🔧 本地 / 命令行部署

```bash
npx wrangler login    # 首次
npm run deploy        # 自动建库 + 部署（建表由 Worker 启动时自动完成）
```

`npm run setup` 只剩「选账号 / 绑自定义域名」的用途，直接 `npm run deploy` 也能跑通。

## 环境变量

### 运行时：只认这两个 Secret

必须从 Cloudflare 控制台添加（Settings → Variables and Secrets，类型选 **Secret**）：

| 名称 | 用途 | 备注 |
|---|---|---|
| `ADMIN_TOKEN` | 后台登录密码 | 忘了直接改成新值即可 |
| `CONFIG_ENC_KEY` | 敏感配置的加密主密钥 | 不要更换，换了旧配置解不开 |

没有 `.env` 文件，密钥也不会出现在仓库或命令行里。重新部署不影响这两个值。

### 部署期：不用配任何东西

D1 库由 `npm run deploy` 自动查找/创建，库 ID 缓存在 `.wrangler/d1.json`（已 gitignore）。其余配置（QQ 凭据、AI 接口、提示词、黑名单等）都从后台改，加密后存 D1。
