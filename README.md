# QQ Bot CF

跑在 Cloudflare Workers 上的 QQ 机器人：接入 QQ 开放平台官方网关，用任意 OpenAI 兼容模型在群聊和单聊里对话，自带可视化管理后台。

> ⚠️ **使用须知**：本项目仅用于学习和技术交流，**请勿用于任何违法犯罪用途**。使用时请遵守 [Cloudflare 服务条款与可接受使用政策](https://www.cloudflare.com/website-terms/) 以及 [QQ 开放平台](https://q.qq.com) 的运营规范与接口约定（不得骚扰用户、传播违法信息、绕过平台风控或从事其它违法违规活动）。因违规使用导致的账号封禁、接口停用或法律责任，由使用者自行承担。

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

### 3. 绑定自定义域名（必须）

**workers.dev 域名已全部禁用**（`preview_urls = false` + `workers_dev = false`）：每次部署的临时预览链接和 `qq-bot-cf.<你的子域>.workers.dev` 主地址都不会再开启。原因：workers.dev 在国内大部分网络环境访问不稳定，而且等于一个额外的公网入口。所以**访问后台必须绑定自己的域名**；部署本身照常成功，先绑域名再打开即可。**机器人不回调公网**（走 WebSocket 出站连接网关），对域名没有任何额外要求，能打开网页就行。

**前提**：域名已经托管在**同一个 Cloudflare 账号**里（NS 已切到 Cloudflare）。

**方法 A：控制台绑定（推荐，不用动代码）**

1. [Cloudflare 控制台](https://dash.cloudflare.com/) → **Workers & Pages** → 点开 `qq-bot-cf`
2. **Settings** → **Domains & Routes**（域和路由）→ **Add** → **Custom domain**
3. 填你的子域名，例如 `bot.example.com` → **Add domain**

Cloudflare 会自动加 DNS 记录并签发证书，几分钟内生效。绑定跟的是 Worker 本身，之后 GitHub 重新构建部署**不需要**重新绑。

**方法 B：写进配置（命令行用户）**

跑 `npm run setup`，第 4 步填域名，它会往 `wrangler.toml` 写：

```toml
routes = [
  { pattern = "bot.example.com", custom_domain = true }
]
```

或者手动把这段加进 `wrangler.toml`（域名换成自己的），下次部署生效。

**注意**：同一个域名只能给一个 Worker 用，绑定时 Cloudflare 会提示该域名已有的 DNS 记录会被替换；别绑到正在跑网站的主域名上，用专门的子域名（如 `bot.`、`qq.`）。

**已经部署了旧版本？** 这次升级后 workers.dev 地址会立即失效——先按上面方法绑好自定义域名再更新，否则后台会暂时打不开（机器人收发消息不受影响）。

### 4. 登录后台

1. 数据表会在 Worker 启动时自动建好（无需手动建表）
2. 打开 `https://你的域名/login`，用 `ADMIN_TOKEN` 登录
3. 后台填 QQ AppID / Secret（未上线机器人开「沙箱环境」）和 AI Base URL / API Key，点「保存并重启」

---

## 🔄 更新

同步上游最新代码：GitHub 上打开你的 fork → **Sync fork** → 合并上游，Cloudflare 会自动重新构建部署。

- 密钥、业务配置、聊天记录都**不会丢**（详情见常见问题）
- **新版本自动接管**：部署后旧实例发现自己和 Worker 版本不一致，会主动断开让位，最多 1 分钟内新实例自动顶上，不用手动重启
- 若没 fork，直接 `git pull` 上游后 `npm run deploy` 即可

---

## ✨ 特性

- **零服务器**：一个 Worker + 多个 Durable Object（QQ 网关 / ChatDO 对话 / WorkDO 工具+工作区 / AiDO 沙箱 / 限流）+ 一张 D1 表，全程免费额度内
- **官方网关**：WebSocket 长连接，断线自动重连，每分钟巡检一次；部署后新版本会自己接管，无需手动重启
- **多 AI 容错**：后台「AI 对话」可加多套 Base URL / Key / 模型（添加/编辑/测试都在弹窗里完成），按顺序尝试，前一个超时或报错自动切下一个；内置 19 家一键预填配置——国外 OpenAI、Google Gemini、xAI Grok、Groq、OpenRouter、Mistral，国内 DeepSeek、通义千问、智谱 GLM、Kimi、豆包、硅基流动、腾讯混元（TokenHub）、讯飞星火、MiniMax、零一万物、阶跃星辰、百川智能、魔搭（免费额度）。列表上的开关一点就能启用/停用
- **生图模型预设**：后台「生图模型」页配置（同样收进弹窗，先测试通过才能保存），内置 qwen-image、wanx、seedream、cogview、dall-e-3、gpt-image-1.5、flux、nano-banana 等主流模型一键填入
- **Markdown 回复**：AI 回复含标题、列表、加粗、链接时按官方 Markdown 消息发送，排版更好（后台可开关）
- **图片回复**：AI 回复里的 Markdown 图片会自动上传转存后发到群里/单聊，上传失败自动降级为文字链接
- **消息撤回**：回复 `/撤回` 可撤掉本会话最近一条机器人消息；AI 全部不可用时可选自动撤回上一条（后台开关）
- **AI 生图**：发 `/画 一只橘猫，水彩风格` 直接调生图模型出图并发送；也可以自然语言说「帮我画一只猫」，AI 会自己判断并出图。生图模型在后台「生图模型」页单独配置，**先测试通过才能保存**
- **内置梗图与表情**：35 张梗图（桌宠表情包压缩版）存在 **D1** 里，部署时自动导入（`assets/memes/*.jpg` → `scripts/memes.mjs`），不占 Worker 包体；发 `/梗图` 随机来一张、`/梗图 名字` 指定，AI 也会在气氛合适时自己挑一张发（走官方富媒体图片消息）。`/表情` 随机一个 emoji。注意：QQ 群聊/单聊官方接口**不支持发原生表情包**（「表情表态」仅频道可用），表情用 Unicode emoji 代替；收到的表情标签（`<faceType=…>`）会自动转成 `[表情：名字]`
- **语音消息（内置 TTS，免 Key）**：`/语音 你好呀` 用 **Cloudflare Workers AI 的 MeloTTS** 合成 MP3 并作为 QQ 语音消息发出（`file_type=3`），不需要额外 API Key、走账号免费额度（约 $0.0002/音频分钟）；AI 也能在合适时用 `voice` 工具回语音。语种在后台「对话行为 → 语音语言」切换；响度可在「语音音量增益」里选 关 / +6dB / +9dB（只改 MP3 的 global_gain，不重编码，mp3gain 同款做法）
- **AiDO 沙箱（/ai）**：/ai 帮我建个文件整理需求 会让 AI 在**隔离的 AiDO** 里干活——它可以自由读写自己的虚拟文件（最多 20 个 / 单文件 8KB），但**不能发消息、不能联网、不能碰其他 DO**；/ai 文件 查看、/ai 清空 重置
- **AI 工作区（/do）**：/do 帮我整理这周的待办 会把任务交给独立的**工作区 DO** 执行，AI 可以维护任务清单和笔记（/do 列表 查看、/do 清空 重置）；后台「AI 工作区」页能看每个会话的任务 / 笔记 / 执行记录，并一键清空
- **定时提醒**：直接说「10 分钟后提醒我喝水」「明天 8 点提醒我开会」「每天 8:00 提醒我背单词」，机器人会到点主动发消息（重复任务自动顺延）。提醒存在 D1 里，跨重启、跨版本升级都不丢；后台「定时任务」页可查看和取消。受 QQ 主动消息配额限制，发送失败会标红并写进聊天记录
- **AI 工具调用**：AI 不只是聊天，还能按需调用内置工具——生成图片、发梗图、设置定时提醒、查本群资料 / 机器人状态 / 禁言状态（后台「对话行为」可开关）。工具走 `[TOOL]{...}` 协议；群资料类工具受官方白名单权限限制，报 11253 属正常
- **持久记忆**：每个会话一个独立的 **AI DO**，上下文存在它自己的 SQLite 里（重启 / 驱逐不丢），历史过长时自动把旧消息压缩成摘要继续带上下文
- **入群欢迎**：新成员进群自动发欢迎语（支持 `{member}` 占位符 @ 新成员）；机器人被拉进新群也会打招呼（后台开关）
- **群管理**：后台「群管理」页集中管理机器人所在的群——群列表自动收集（收到群消息 / 被拉进群时记下，也可手动粘贴 openid），每个群可开关机器人回复（保存秒级生效）；点开群可看官方群资料（群名/简介/分类/人数）和机器人群内状态（角色、入群时间、消息接收设置），实时查询群禁言状态（全员禁言模式 + 被禁言成员），并支持对成员禁言 / 解除禁言（时长 10 分钟 ~ 30 天；成员列表是官方内邀接口暂拉不到，可直接粘贴成员 openid 手动禁言）。群资料 / 机器人状态 / 成员列表属白名单或内邀能力（报 `code=11253`），禁言、入群审批等可在 QQ 开放平台自助申请；禁言要求机器人在群里是管理员
- **按钮菜单**：发 `/菜单` 弹出带按钮的面板——指令按钮自动把内容填进输入框（@我 + 指令），跳转按钮直达项目主页；按钮发送失败自动降级为文字菜单。`/帮助` 可随时查看指令列表
- **换 AI 即时生效**：后台改 AI 配置 / 人设提示词 / 生图模型，保存后立即热更新（不用重启机器人）；已有会话的人设也会自动跟随新配置
- **单聊输入状态**：单聊里 AI 思考期间会显示「正在输入…」（官方 msg_type=6）
- **密钥加密**：QQ Secret 与 AI Key 以 AES-256-GCM 加密后入库，后台不回显明文
- **日志脱敏**：写日志前统一抹掉 `sk-` 开头的 Key、Bearer 令牌、32 位十六进制串和 JSON 里的 secret 字段，报错内容也不会原样带出密钥
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

**提示「加密主密钥需要处理」**

`CONFIG_ENC_KEY` 和库里已加密的数据对不上（多半是换了值）。这时打开任何页面都会被引导到 `/recover`，**需要先输入 `ADMIN_TOKEN` 验证身份**才会显示恢复步骤：验证后可以把 `CONFIG_ENC_KEY` 改回最初的值，也可以换新值后点「清空旧配置」重新开始——清空只删 QQ Secret、AI Key 和 AI 列表，聊天记录、登录会话和对话行为设置都保留。

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

不会。会持久化的数据分三处，都不含原始 openid：

- **D1 `chat_log`**：问题原文、回答原文，`scope_id` / `user_id` 存的是 openid 的 SHA-256 指纹（8 位十六进制），原始 openid 不入库、不写日志。系统事件（配置热更新、AI 自动切换、入群欢迎等）也记在这张表里。图片 / 梗图 / 语音会记成 `[图片] …`、`[梗图] 名字`、`[语音] …` 占位；只留最近 2000 条，后台「聊天记录」是 QQ 风格的会话列表 + 对话气泡，系统消息置顶，支持按会话删除。
- **D1 `memes`**：内置梗图（压缩后的 JPEG base64）与名称 / 描述，部署时从仓库 `assets/memes` 自动导入。
- **AI DO 的 SQLite**：每个会话一个 `AIDOWorker` 实例，保存上下文（最近若干轮 + 摘要）并负责调用模型——慢请求不会阻塞 QQ 网关，多个会话可并行。`QQBotDO` 只存一个布尔值 `desired_running` 标记是否该保持在线。重启、换版本都不会丢会话。

---

## 🔧 本地 / 命令行部署

```bash
npx wrangler login    # 首次
npm run deploy        # 自动建库 + 部署（建表由 Worker 启动时自动完成，部署后自动导入梗图）
npm run dev           # 本地开发（自动生成带 D1 绑定的 .wrangler/deploy.toml，默认 127.0.0.1:8787）
npm run seed:memes    # 把内置梗图导入本地 D1（本地开发时用）
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

---

## 🎨 图标与许可

项目图标、后台侧边栏图标与网站图标（favicon）使用 [Lucide](https://lucide.dev) 的 `bot` 图标，采用 **ISC License**——允许商用、修改与再分发，只需保留版权与许可声明：

- 版权：Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
- 许可全文：<https://github.com/lucide-icons/lucide/blob/main/LICENSE>
- favicon 的渐变底色与白色描边是在原图标基础上做的样式处理，仍遵循同一许可。

---

## ⚠️ 合规与免责声明

本项目仅在**遵守 Cloudflare 平台与 QQ 开放平台规定**的前提下提供，供学习、研究和合法的个人使用：

- **Cloudflare**：[服务条款](https://www.cloudflare.com/website-terms/) 与[可接受使用政策](https://www.cloudflare.com/aup/)——不得用于攻击、扫描、钓鱼、垃圾信息、挖矿、绕过配额或其它违规用途
- **QQ 开放平台**：须使用[官方开放平台](https://q.qq.com)注册并通过审核的机器人，遵守其运营规范、接口权限与频率限制；不得用于骚扰用户、传播违法违规内容、伪造身份或规避平台风控
- **第三方服务**：AI 模型、生图、图片存储等均需遵守对应服务商条款

**请勿将本项目用于任何违法犯罪活动。** 项目作者不对使用者的行为及由此产生的后果负责；因违规使用导致的服务封禁、账号处罚或法律责任，由使用者自行承担。
