
import { ADMIN_JS } from './themes/admin-core.js';
import { HOME_CSS } from './themes/home-css.js';
import { LOGIN_CSS } from './themes/login-css.js';
import { shellA } from './themes/theme-a.js';
import { BOT_PATHS } from './assets/icons.js';

const ROBOT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  BOT_PATHS +
  '</svg>';

const FAVICON_LINKS =
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' +
  '<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">' +
  '<link rel="shortcut icon" href="/favicon.ico">' +
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">';

const ARROW_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

const BOLT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>';

const CUBE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
  '<polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>';

const SHIELD_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11.5 14.5 15.5 9.5"/></svg>';

const LIFE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/>' +
  '<line x1="5.7" y1="5.7" x2="9.4" y2="9.4"/><line x1="14.6" y1="14.6" x2="18.3" y2="18.3"/>' +
  '<line x1="18.3" y1="5.7" x2="14.6" y2="9.4"/><line x1="9.4" y1="14.6" x2="5.7" y2="18.3"/></svg>';

const DB_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<ellipse cx="12" cy="5.5" rx="8" ry="3.2"/><path d="M4 5.5v13c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-13"/>' +
  '<path d="M4 12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2"/></svg>';

const GAUGE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3.5 18a9 9 0 1 1 17 0"/><line x1="12" y1="14" x2="16.5" y2="9.5"/><circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none"/></svg>';

const ARROW_DOWN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/></svg>';

const BELL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

const TOOL_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3z"/></svg>';

const IMAGE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

const MIC_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';

const GITHUB_ICON =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
  '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>' +
  '</svg>';

function homeVars() {
  return (
    '--grid:linear-gradient(var(--grid-line) 1px,transparent 1px),' +
    'linear-gradient(90deg,var(--grid-line) 1px,transparent 1px)'
  );
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function adminAddress(reqUrl) {
  try {
    return escapeAttribute(new URL(reqUrl).host) + '/admin';
  } catch {
    return '/admin';
  }
}

const FEATURES = [
  {
    icon: CHAT_ICON,
    title: '群聊与单聊都能接',
    desc: '群里 @ 机器人、或者私聊它都行。每个会话独立保留上下文，按会话串行处理，同一句话不会被并发答两遍。',
    tags: ['GROUP_AT_MESSAGE', 'C2C_MESSAGE', 'msg_id 去重'],
  },
  {
    icon: CUBE_ICON,
    title: '多个 AI 轮着用',
    desc: '后台「AI 对话」里可以加多套 Base URL / Key / 模型，按顺序排优先级，前一个超时或报错就自动切下一个。调用跑在独立的 ChatDO 里，慢请求（带图最长 180 秒）不会卡住事件分发。',
    tags: ['多套配置', '自动切换', '/chat/completions'],
  },
  {
    icon: BELL_ICON,
    title: '定时提醒，到点主动找你',
    desc: '直接说「10 分钟后提醒我喝水」「每天 8:00 提醒我背单词」，不用指令。提醒存在 D1，跨重启不丢；到点由 Durable Object 的 alarm 精确唤醒（精确到秒，不靠轮询），重复任务发完自动顺延，后台「定时任务」页可查看和取消。',
    tags: ['自然语言', 'alarm 精确唤醒', '重复顺延', '后台可管理'],
  },
  {
    icon: TOOL_ICON,
    title: 'AI 会自己调工具',
    desc: 'AI 不再只会聊天：需要画图、发梗图、发语音、设提醒、查群资料 / 禁言状态时，它会自己选用哪个工具，一次只调一个，结果直接发回会话。',
    tags: ['[TOOL] 协议', '画图', '梗图', '语音', '查群'],
  },
  {
    icon: IMAGE_ICON,
    title: '内置 35 张梗图 + 表情',
    desc: '梗图直接存在 D1 里（不占包体），/梗图 随机来一张、/梗图 名字 指定；AI 也会在气氛合适时自己挑一张发，图后还补一句话。/表情 随机 emoji——官方群里发不了原生表情包，就用 emoji 顶上。',
    tags: ['35 张', 'D1 存储', 'AI 自动挑图', '/表情'],
  },
  {
    icon: MIC_ICON,
    title: '语音消息，免 Key',
    desc: '用 Cloudflare Workers AI 的 MeloTTS 合成语音，不需要额外买 TTS 服务：/语音 你好呀 直接发语音条，AI 也会在合适时用语音回你。音量还能增益 +6 / +9dB。',
    tags: ['MeloTTS', 'Workers AI', '免 Key', '音量增益'],
  },
  {
    icon: LIFE_ICON,
    title: '两种接法，按需选',
    desc: 'Webhook 走 HTTP 回调，处理完就休眠、空闲不计费；WebSocket 走网关长连接，配好 AppID / Secret 即可用。后台会跟随 QQ 平台的设置自动切换，不用手动改。',
    steps: [
      ['1', 'Webhook', 'QQ 直接 POST 到 /qq/webhook，Ed25519 验签，处理完即休眠'],
      ['2', 'WebSocket', '出站连网关，断线走 RESUME 续会话、漏掉的事件由网关补发'],
      ['3', '自动跟随', '收到推送即判定为 Webhook；改回长连接后一键同步'],
    ],
    wide: true,
  },
  {
    icon: DB_ICON,
    title: '分层记忆，忘不掉也不烧钱',
    desc: '三层结构：最近 N 条原文逐字保真、滚动摘要覆盖中期脉络、长期事实记住你是谁。每 20 条才压缩一次；原文全丢时仍能靠长期事实答出你的名字、城市、技术栈和做过的事。',
    tags: ['短期原文', '滚动摘要 ≤1500 字', '长期事实 ≤40 条', '每 20 条压缩'],
  },
  {
    icon: SHIELD_ICON,
    title: '密钥加密存储',
    desc: '机器人 Secret 与 AI Key 以 AES-256-GCM 加密后落库，主密钥只存在 Worker Secret 里，后台永不回显明文。',
    tags: ['AES-256-GCM', 'enc:v1', '不回显'],
  },
  {
    icon: IMAGE_ICON,
    title: '看得懂你发的图',
    desc: '把图片发给机器人，它会先把图下载下来交给视觉模型理解，再回答你的问题；回复里的图、生图、梗图都走官方富媒体上传发送，不需要外部图床。',
    tags: ['image_url', '多模态', '富媒体上传'],
  },
  {
    icon: CUBE_ICON,
    title: '发来的文件，它真的会读',
    desc: '把 .md / .py / .js / .json / .csv / .docx / .xlsx 直接发给它，内容会被读进上下文再回答——不是假装看过。二进制（.so / .zip / .pdf）会明确说读不了，不会瞎编。',
    tags: ['文本类直接解码', 'docx/xlsx 抽文字', '二进制明确拒答'],
  },
  {
    icon: DB_ICON,
    title: '每人一个私有工作区',
    desc: '说「写一篇 3000 字文章存成 article.md 发我」，它会在隔离的 AiDO 里干活：单文件 1.9MB、总量 1GB。你发来的文件会按原始文件名自动存进去，单聊与群聊各自隔离，别人看不到。',
    tags: ['AiDO 沙箱', '保留原始文件名', '按人隔离', '自动打包 zip'],
  },
  {
    icon: BOLT_ICON,
    title: '官方小功能都接齐了',
    desc: 'Markdown 排版回复、图片上传转存后发送、/撤回 指令、入群欢迎语、/菜单 按钮面板——都是官方文档里的正经接口，后台一键开关。',
    tags: ['Markdown', '/撤回', '入群欢迎', '/菜单'],
  },
  {
    icon: GAUGE_ICON,
    title: '该拒的会拒',
    desc: '群黑名单、敏感词、登录限流、接口限流各管一段，刷屏和探测进不到 AI 那一层。',
    tags: ['黑名单', '敏感词', '5 次 / 15 分钟'],
  },
  {
    icon: CHAT_ICON,
    title: '群管理，一页管完',
    desc: '自动收集机器人所在的群，每个群一键开关回复（秒级生效）。点开能看群资料、机器人群内状态、实时禁言名单，还能手动禁言 / 解除。',
    tags: ['群列表', '回复开关', '禁言状态', '手动禁言'],
  },
  {
    icon: CHAT_ICON,
    title: '像 QQ 一样的聊天记录',
    desc: '后台「聊天记录」改成会话列表 + 对话气泡：左边选会话、右边看完整对话，手机上点进去全屏；系统消息单独置顶，图片 / 梗图 / 语音都会记一条，支持按会话删除。',
    tags: ['会话列表', '气泡对话', '手机适配', '按会话删除'],
  },
];

const STEP_DELAY_CLASS = ['', ' d1', ' d2'];

function featureTile(f, index) {
  let extra = '';
  if (f.steps) {
    extra =
      '<ul class="t-extra steps">' +
      f.steps
        .map(
          (s, i) =>
            '<li class="step"><i>' +
            s[0] +
            '</i><span><b>' +
            s[1] +
            '</b> · ' +
            s[2] +
            '</span></li>'
        )
        .join('') +
      '</ul>';
  } else if (f.tags) {
    extra =
      '<div class="t-extra"><ul class="tags">' +
      f.tags.map((t) => '<li class="tag">' + t + '</li>').join('') +
      '</ul></div>';
  }
  return (
    '<figure class="tile reveal' +
    STEP_DELAY_CLASS[index % STEP_DELAY_CLASS.length] +
    (f.wide ? ' wide' : '') +
    '"><div class="wave"></div>' +
    '<div class="t-ico">' +
    f.icon +
    '</div><figcaption><h3>' +
    f.title +
    '</h3><p>' +
    f.desc +
    '</p></figcaption>' +
    extra +
    '</figure>'
  );
}

export function homePage(nonce, reqUrl) {
  const adminHost = adminAddress(reqUrl);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON_LINKS}<title>QQ Bot · 跑在 Cloudflare Workers 上的 QQ AI 机器人</title><meta name="description" content="零服务器、零运行时依赖的 QQ 机器人：跑在 Cloudflare Workers 与 Durable Objects 上，接入 QQ 开放平台，在群聊和单聊里用任意 OpenAI 兼容模型自然对话，会画图、发梗图、发语音、定提醒、读文件，自带加密配置与可视化管理后台。"><meta name="robots" content="index,follow"><style nonce="${nonce}">
:root{${homeVars()}}
${HOME_CSS}
</style></head><body class="home motion t-light">
<header class="nav" id="nav">
  <div class="wrap nav-in">
    <a class="brand" href="/"><span class="logo">${ROBOT_ICON}</span><span>QQ Bot<small>Workers Edition</small></span></a>
    <nav class="nav-links">
      <a href="#features">功能</a>
      <a href="#flow">工作原理</a>
      <a href="#deploy">部署</a>
    </nav>
    <a class="btn btn-ghost btn-sm nav-login" href="/login"><span class="nav-full">管理后台</span><span class="nav-short">后台</span>${ARROW_ICON}</a>
  </div>
</header>

<main>
  <!-- ------------------------------- Hero ------------------------------- -->
  <section class="hero">
    <div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
    <div class="grid-bg"></div>
    <div class="wrap hero-in">
      <div>
        <span class="pill reveal"><span class="live"></span>Webhook / WebSocket 双模式<b>Serverless</b></span>
        <h1 class="reveal d1">把你的 QQ 号<br>变成<span class="grad">会思考的助手</span></h1>
        <p class="lede reveal d2">接入 QQ 开放平台，在群聊与私聊中由 AI 自然作答：会画图、会发梗图、会发语音、会自己定提醒，能读你发来的文件，还会<b>分层记得住</b>你们聊过的一切。支持 Webhook 与 WebSocket 两种事件接收方式，空闲时不产生费用。<b>零服务器</b>——没有 VPS、没有 Docker、没有常驻进程；<b>零运行时依赖</b>——<code>dependencies</code> 是空的，不用装 Node、Python、Redis 或任何数据库。整个机器人就是一个 Worker、五个 Durable Object、一张 D1 表。</p>
        <div class="cta reveal d3">
          <a class="btn btn-primary" href="/login">进入管理后台${ARROW_ICON}</a>
          <a class="btn btn-ghost" href="#features">看看它能做什么</a>
        </div>
        <div class="facts reveal d4">
          <span class="fact"><i></i>零服务器</span>
          <span class="fact"><i></i>零运行时依赖</span>
          <span class="fact"><i></i>D1 持久化</span>
        </div>
      </div>

      <div class="preview reveal d2">
        <figure class="float f1">
          <span class="ico">${LIFE_ICON}</span>
          <span><b>Webhook 已启用</b><span>空闲不计持续时间</span></span>
        </figure>
        <div class="window">
          <div class="win-bar">
            <span class="win-dots"><span class="d1"></span><span class="d2"></span><span class="d3"></span></span>
            <span class="win-url">${adminHost}</span>
            <span class="win-live"><span class="live"></span>在线</span>
          </div>
          <div class="win-body">
            <div class="win-chips">
              <span class="chip">模型<b>已选择</b></span>
              <span class="chip">密钥<b>已加密</b></span>
              <span class="chip">记忆<b>三层</b></span>
              <span class="chip">梗图<b>35 张</b></span>
              <span class="chip">语音<b>内置 TTS</b></span>
            </div>
            <div class="chats">
              <div class="msg out">
                <span class="av me">我</span>
                <span><span class="who">群聊 · 有人 @ 了我</span><span class="bubble">帮我把这段话改得更礼貌一点：这方案不行，重做。</span></span>
              </div>
              <div class="msg in">
                <span class="av bot">${ROBOT_ICON}</span>
                <span><span class="who">QQ Bot</span><span class="bubble">当然可以，试试这样说：<br>「这个方案目前和预期还有差距，方便的话我们一起看看怎么调整？」<span class="caret"></span></span></span>
              </div>
            </div>
            <div class="metrics">
              <span class="metric"><b class="ok">正常</b><span>事件接收</span></span>
              <span class="metric"><b>35 张</b><span>内置梗图</span></span>
              <span class="metric"><b>2000</b><span>聊天记录上限</span></span>
            </div>
          </div>
        </div>
        <figure class="float f2">
          <span class="ico">${SHIELD_ICON}</span>
          <span><b>AES-256-GCM</b><span>敏感配置已加密</span></span>
        </figure>
      </div>
    </div>
  </section>

  <!-- ------------------------------ 数据条 ------------------------------ -->
  <section class="band">
    <div class="wrap band-in">
      <div class="cell reveal"><b>0</b><span>需要维护的服务器</span></div>
      <div class="cell reveal d1"><b>全兼容</b><span>OpenAI Chat Completions</span></div>
      <div class="cell reveal d2"><b>3 层</b><span>记忆结构（原文/摘要/事实）</span></div>
      <div class="cell reveal d3"><b>35 张</b><span>内置梗图 / 表情</span></div>
    </div>
  </section>

  <!-- ------------------------------ 功能 ------------------------------ -->
  <section class="sec" id="features">
    <div class="wrap">
      <div class="sec-head">
        <span class="eyebrow">能力</span>
        <h2 class="title">从收到消息到发出回复，<br>链路里该有的它都有</h2>
        <p class="lede">会话隔离、去重、限流、重试、配额保护——这些不显眼但容易翻车的地方，都在实现里处理过了。</p>
      </div>
      <div class="bento">
        ${FEATURES.map(featureTile).join('')}
      </div>
    </div>
  </section>

  <!-- ---------------------------- 工作原理 ---------------------------- -->
  <section class="sec" id="flow">
    <div class="wrap flow">
      <div>
        <div class="sec-head left">
          <span class="eyebrow">工作原理</span>
          <h2 class="title">一条消息的完整旅程</h2>
          <p class="lede">从平台推送到群里出现回复，中间发生的事比想象的要多。</p>
        </div>
        <div class="flow-list">
          <div class="fitem fork"><span class="fnum">01</span><div>
            <h4>事件接入：两条路，选一条</h4>
            <div class="paths">
              <div class="path">
                <span class="p-tag"><i class="pdot"></i>Webhook</span>
                <p>QQ 直接 POST 到 <b>/qq/webhook</b>：先验 Ed25519 签名与时间戳，op=13 回显校验串，op=0 在 3 秒内回 ACK 再转给 DO 处理。处理完即休眠，空闲不计持续时间。</p>
              </div>
              <div class="path">
                <span class="p-tag"><i class="pdot"></i>WebSocket</span>
                <p>Worker 主动连 <b>wss 网关</b>：HELLO 拿心跳间隔，IDENTIFY 建会话；断线用 <b>RESUME</b> 带上 session_id 与 seq 续上，漏掉的事件由网关补发，不重复消耗配额。</p>
              </div>
            </div>
            <p class="p-note">后台「事件接入」里可以显式切换。收到 Webhook 推送即自动判定为 Webhook 模式；改回长连接后点一下按钮同步即可。</p>
          </div></div>
          <div class="fitem"><span class="fnum">02</span><div><h4>事件过滤</h4><p>按 <b>msg_id + msg_seq</b> 去重（平台会重复推送）、剥掉 @ 标记、命中群黑名单或敏感词直接丢弃。两种接入方式共用这一层，判定逻辑完全一致。</p></div></div>
          <div class="fitem"><span class="fnum">03</span><div><h4>排队与会话隔离</h4><p>同一会话串行、不同会话并行。记忆分三层存在 ChatDO 的 SQLite 里：最近 N 条原文、滚动摘要、长期事实；每 20 条才压缩一次，重启与换版本都不丢。</p></div></div>
          <div class="fitem"><span class="fnum">04</span><div><h4>调用 AI</h4><p>把三层记忆交给独立的 <b>ChatDO</b>，由它请求兼容接口：90 秒超时（带图 180 秒），网络抖动、5xx 与 429 先重试一次，仍失败就换下一个 AI；图片只发给标记了「支持识图」的模型。用户发来的文件内容也在这里一并交给模型。</p></div></div>
          <div class="fitem"><span class="fnum">05</span><div><h4>工具调用与富媒体</h4><p>AI 要「做事」时输出 <b>[TOOL]</b>（画图 / 梗图 / 语音 / 提醒 / 查群），一次只调一个：生图与梗图先上传成 QQ 媒体，语音用 Workers AI 的 MeloTTS 合成再上传，图发完还会补一句话；提醒类工具直接落 D1。</p></div></div>
          <div class="fitem"><span class="fnum">06</span><div><h4>回复与附件</h4><p>带 msg_id 回复原消息，超长自动截断；文件走富媒体上传作为附件发出，超过 3 个自动打包 zip。凭证过期会重新获取并补发一次。Webhook 模式下回复走 HTTP 接口，WebSocket 模式下走网关同一条连接。</p></div></div>
          <div class="fitem"><span class="fnum">07</span><div><h4>落库</h4><p>文本回复、图片、梗图、语音都会写一条记录（发图前先出图、再补一句话）；失败会给一条兜底文案，不会让群里的人等到沉默。</p></div></div>
        </div>
      </div>

      <aside class="diagram reveal d1">
        <div class="node edge"><div class="n-k">入口</div><div class="n-v">QQ 开放平台</div><div class="n-d">Webhook 回调 · wss 网关</div></div>
        <div class="arrow">${ARROW_DOWN}</div>
        <div class="node core"><div class="n-k">边缘</div><div class="n-v">Worker 路由</div><div class="n-d">验签 · 登录 · 会话 · 限流</div></div>
        <div class="arrow">${ARROW_DOWN}</div>
        <div class="node"><div class="n-k">分发</div><div class="n-v">QQBotDO</div><div class="n-d">事件分发 · 消息队列 · 工具调度</div></div>
        <div class="arrow">${ARROW_DOWN}</div>
        <div class="split">
          <div class="node"><div class="n-v">ChatDO</div><div class="n-d">分层记忆 · 模型调用</div></div>
          <div class="node"><div class="n-v">AiDO</div><div class="n-d">私有沙箱 · 文件</div></div>
          <div class="node"><div class="n-v">WorkDO</div><div class="n-d">工具 · 任务清单</div></div>
        </div>
        <div class="arrow">${ARROW_DOWN}</div>
        <div class="split">
          <div class="node"><div class="n-v">D1</div><div class="n-d">配置 · 提醒 · 梗图</div></div>
          <div class="node"><div class="n-v">Workers AI</div><div class="n-d">MeloTTS 语音</div></div>
          <div class="node"><div class="n-v">RateLimiter</div><div class="n-d">固定窗口计数</div></div>
        </div>
      </aside>
    </div>
  </section>

  <!-- ------------------------------ 部署 ------------------------------ -->
  <section class="sec" id="deploy">
    <div class="wrap">
      <div class="sec-head">
        <span class="eyebrow">部署</span>
        <h2 class="title">四步，跑起来</h2>
        <p class="lede">先把自定义域名绑好（workers.dev 入口已禁用，后台只能走域名访问），再加两个 Secret，然后一条命令发布——D1 库与内置梗图都会在部署时自动就绪。部署命令务必用 <b>npm run deploy</b>，否则会丢 D1 绑定。</p>
      </div>
      <div class="bento">
        <figure class="tile wide reveal">
          <div class="win-bar"><span class="win-dots"><span class="d1"></span><span class="d2"></span><span class="d3"></span></span><span class="win-url">deploy</span></div>
          <div class="t-extra">
            <ul class="steps">
              <li class="step"><i>1</i><span><b>绑定自定义域名</b> · 控制台 Domains & Routes</span></li>
              <li class="step"><i>2</i><span><b>添加两个 Secret</b> · ADMIN_TOKEN 与 CONFIG_ENC_KEY</span></li>
              <li class="step"><i>3</i><span><b>npm run deploy</b> · 自动建库 → 生成配置 → 发布 → 导入梗图</span></li>
              <li class="step"><i>4</i><span><b>登录后台填配置</b> · QQ 凭据 + AI 接口 → 点启动</span></li>
            </ul>
          </div>
        </figure>
        <figure class="tile reveal d1">
          <div class="t-ico">${DB_ICON}</div>
          <figcaption>
            <h3>只需要两样东西</h3>
            <p>环境变量只有 <b>ADMIN_TOKEN</b>（后台密码）和 <b>CONFIG_ENC_KEY</b>（加密主密钥）。其余配置都存在 D1 里，后台随时改。</p>
          </figcaption>
        </figure>
        <figure class="tile wide reveal d2">
          <div class="t-ico">${BOLT_ICON}</div>
          <figcaption>
            <h3>本地也能调</h3>
            <p><b>npm run dev</b> 起本地环境（自动带上 D1 绑定），<b>npm run seed:memes</b> 导入本地梗图，<b>npm run tail</b> 看线上日志。沙箱开关一开，未上线的机器人也能先跑通全流程。</p>
          </figcaption>
        </figure>
        <figure class="tile reveal d3">
          <div class="t-ico">${SHIELD_ICON}</div>
          <figcaption>
            <h3>workers.dev 默认全关</h3>
            <p>预览地址与 workers.dev 入口都在配置里关掉了，后台只能走自定义域名。WebSocket 模式是出站连接，不需要任何公网入口；Webhook 模式则需要 QQ 能访问到你的域名。</p>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>

  <!-- ----------------------------- 收尾 CTA ----------------------------- -->
  <section class="final">
    <div class="glow g4"></div>
    <div class="wrap">
      <div class="sec-head center last">
        <span class="eyebrow">开始</span>
        <h2>现在就去后台把它跑起来</h2>
        <p class="lede">填入 QQ 开放平台的 AppID 与 Secret，选好模型，点一下启动。</p>
      </div>
      <div class="cta">
        <a class="btn btn-primary" href="/login">进入管理后台${ARROW_ICON}</a>
        <a class="btn btn-ghost" href="#flow">先看看架构</a>
      </div>
    </div>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <p class="copyright"><span>©</span> 2026 <span class="c-sep">|</span> QQ Bot</p>
    <p class="foot-links"><a class="foot-link" href="https://github.com/jidanbings/qq-bot-cf" target="_blank" rel="noopener noreferrer">${GITHUB_ICON}<span>开源项目</span></a></p>
  </div>
</footer>

<div class="fx-dock" id="dock" hidden>
  <span class="dock-label">主题</span>
  <div class="seg" id="theme" role="radiogroup" aria-label="切换配色主题">
    <button type="button" data-theme="system" role="radio" aria-checked="false">跟随系统</button>
    <button type="button" data-theme="light" role="radio" aria-checked="true">白天</button>
    <button type="button" data-theme="dark" role="radio" aria-checked="false">黑夜</button>
  </div>
</div>

<script nonce="${nonce}">
(function(){
  var root=document.body;
  var nav=document.getElementById('nav');
  var sysDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');
  var theme='light';
  try{ var saved=localStorage.getItem('botHomeTheme'); if(saved==='light'||saved==='dark'||saved==='system')theme=saved; }catch(e){}

  function isDark(){
    if(theme==='dark')return true;
    if(theme==='system')return !!(sysDark&&sysDark.matches);
    return false;
  }
  function applyTheme(){
    var d=isDark();
    // .dark 手动指定黑夜；.t-light 手动指定白天。只有两个类都没有时才交给
    // CSS 里的 prefers-color-scheme 决定，避免"手动选白天"在深色系统上被反压回去。
    root.className='home motion'+(d?' dark':(theme==='light'?' t-light':''));
  }
  function markTheme(){
    var btns=document.querySelectorAll('#theme button');
    for(var i=0;i<btns.length;i++){
      btns[i].setAttribute('aria-checked',btns[i].getAttribute('data-theme')===theme?'true':'false');
    }
  }

  var themeBox=document.getElementById('theme');
  if(themeBox){
    themeBox.addEventListener('click',function(ev){
      var btn=ev.target&&ev.target.closest?ev.target.closest('button[data-theme]'):null;
      if(!btn)return;
      theme=btn.getAttribute('data-theme');
      try{ localStorage.setItem('botHomeTheme',theme); }catch(e){}
      applyTheme(); markTheme();
    });
  }
  if(sysDark&&sysDark.addEventListener)sysDark.addEventListener('change',applyTheme);
  else if(sysDark&&sysDark.addListener)sysDark.addListener(applyTheme);

  var dock=document.getElementById('dock');
  if(dock)dock.hidden=false;
  applyTheme(); markTheme();

  function onScroll(){ if(nav) nav.className='nav'+(window.scrollY>8?' stuck':''); }
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();

  // 锚点平滑滚动。动效默认开启，但系统设了「减少动态效果」时不滚动画。
  var smooth=!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var links=document.querySelectorAll('a[href^="#"]');
  for(var i=0;i<links.length;i++){
    links[i].addEventListener('click',function(ev){
      var id=this.getAttribute('href').slice(1);
      var el=id?document.getElementById(id):null;
      if(!el)return;
      ev.preventDefault();
      el.scrollIntoView({behavior:smooth?'smooth':'auto',block:'start'});
      if(history.replaceState)history.replaceState(null,'','#'+id);
    });
  }
})();
</script></body></html>`;
}

const SECRET_REQUIREMENTS = [
  {
    key: 'ADMIN_TOKEN',
    why: '管理后台的登录密码。没有它，登录接口会拒绝所有尝试。',
    how: '自己起一个足够长的随机串（16 位以上），不要用有意义的单词。',
  },
  {
    key: 'CONFIG_ENC_KEY',
    why: '加密主密钥。QQ Secret 和 AI API Key 都以 AES-256-GCM 加密后存进 D1，这把钥匙不落库、只在环境变量里。',
    how: '必须是随机值，且一旦启用就不能更换——换了以后库里已加密的配置全部解不开。请自行备份。',
  },
];

const DB_BINDING_FLAG = 'D1 数据库绑定（DB）';

/**
 * 「D1 没绑定」专用页。
 * 这种情况下 env.DB 整个不存在，任何 env.DB.prepare 都会抛 TypeError，
 * 所以不能复用 setupPage（那里假设数据库是好的、只差密钥）。
 */
export function dbMissingPage(nonce) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON_LINKS}<title>QQ Bot · 缺少数据库绑定</title><meta name="robots" content="noindex"><style nonce="${nonce}">
${LOGIN_CSS}
</style></head><body>
<div class="setup">
  <div class="head">
    <span class="badge"><i></i>缺少数据库绑定</span>
    <h1>D1 数据库没有绑定</h1>
    <p class="sub">Worker 已经部署成功，但环境里没有 <code>env.DB</code>。<br>后台、聊天记录、配置全都依赖它，所以现在什么都打不开。</p>
  </div>
  <div class="reqs">
    <div class="req missing">
      <span class="state">!</span>
      <div class="body">
        <code>env.DB</code>
        <p class="why">绑定缺失。所有 <code>env.DB.prepare(...)</code> 都会直接抛错，表现为「服务器内部错误」。</p>
        <p class="how"><b>最常见原因：</b>部署命令用的是 <code>npx wrangler deploy</code>（或者 Cloudflare 构建里手填的命令），它不会带 D1 绑定。</p>
      </div>
    </div>
  </div>
  <div class="step-note">
    <h2>怎么修</h2>
    <ol>
      <li>把部署命令改成 <code>npm run deploy</code>。它会自动查找/创建 <code>qq-bot-db</code>，并把绑定写进生成的配置再部署。</li>
      <li>如果用 Cloudflare 构建（GitHub 自动部署），去 <b>Settings → Build → Deploy command</b> 改成 <code>npm run deploy</code>，然后重新构建一次。</li>
      <li>重新部署后刷新本页，应该就能正常进入登录页。</li>
    </ol>
    <p class="warn-line">这只是绑定缺失，<b>已有数据不会丢</b>——重新部署会复用同一个数据库。绑好之后，之前加密的配置也照旧能解开（<code>CONFIG_ENC_KEY</code> 没变就不用管）。</p>
  </div>
</div>
</body></html>`;
}

export function setupPage(nonce, missing) {
  const isMissing = (key) => missing.includes(key);
  const secretItems = SECRET_REQUIREMENTS.map((req) => {
    const missingNow = isMissing(req.key);
    return (
      '<div class="req ' + (missingNow ? 'missing' : 'ok') + '">' +
      '<span class="state">' + (missingNow ? '!' : '✓') + '</span>' +
      '<div class="body">' +
      '<code>' + req.key + '</code>' +
      '<p class="why">' + req.why + '</p>' +
      '<p class="how"><b>' + (missingNow ? '待配置：' : '已配置：') + '</b>' + req.how + '</p>' +
      '</div></div>'
    );
  }).join('');

  const pending = missing.length;

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON_LINKS}<title>QQ Bot · 尚未完成配置</title><meta name="robots" content="noindex"><style nonce="${nonce}">
${LOGIN_CSS}
</style></head><body>
<div class="setup">
  <div class="head">
    <span class="badge"><i></i>尚未完成配置</span>
    <h1>还差 ${pending} 项配置</h1>
    <p class="sub">这个 Worker 已经部署成功，数据库也已就绪，<br>只差下面这几个密钥。补齐后刷新本页即可。</p>
  </div>
  <div class="reqs">${secretItems}</div>
  <div class="step-note">
    <h2>怎么补（都在 Cloudflare 控制台操作）</h2>
    <ol>
      <li>打开 <code>dash.cloudflare.com</code> → 左侧 <code>Workers &amp; Pages</code> → 点进本 Worker。</li>
      <li>顶部 <code>Settings</code> → 左侧 <code>Variables and Secrets</code>：点 <code>Add</code>，类型<b>必须选 <code>Secret</code>（加密变量）</b>，千万不要选 <code>Plaintext / Text</code>（普通变量）——普通变量会在下次部署时被覆盖清空。分别加 <code>ADMIN_TOKEN</code> 和 <code>CONFIG_ENC_KEY</code>，各填一个 16 位以上随机串。</li>
      <li>加完点 <code>Deploy</code> 让改动生效，数据表会在 Worker 启动时自动建好，无需手动操作。</li>
      <li>回 <code>/login</code> 用 ADMIN_TOKEN 登录即可。</li>
    </ol>
    <p class="warn-line">密钥只存在于 Cloudflare 上，不经过仓库、不经过本机文件、也不经过命令行。CONFIG_ENC_KEY 一旦确定就不要更换，否则已加密的配置会全部失效。Durable Object 与限流器不需要手动绑定，会自动创建。以后正常改代码、重新部署都不会动到这两个 Secret。</p>
  </div>
</div>
</body></html>`;
}

export function recoverGatePage(nonce, { error } = {}) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON_LINKS}<title>QQ Bot · 配置恢复</title><meta name="robots" content="noindex"><style nonce="${nonce}">
${LOGIN_CSS}
</style></head><body>
<div class="login">
  <div class="logo">${ROBOT_ICON}</div>
  <h1>配置恢复</h1>
  <p class="sub">先验证管理员密钥，再查看恢复步骤</p>
  <form method="post" action="/recover">
    <div class="field">
      <input name="token" type="password" placeholder="请输入 ADMIN_TOKEN" autocomplete="current-password" autofocus>
    </div>
    <button class="btn primary" type="submit">验 证</button>
    <p class="msg">${error ? escapeAttribute(error) : ''}</p>
  </form>
  <p class="foot">恢复页只对管理员开放，避免把内部状态暴露给任何访客</p>
</div>
</body></html>`;
}

export function keyRecoveryPage(nonce, { hasKey }) {
  const title = hasKey ? '加密主密钥对不上' : '加密主密钥丢失';
  const lead = hasKey
    ? '现在填的 CONFIG_ENC_KEY 解不开数据库里的数据，所以后台的配置读不出来。'
    : '数据库里有加密过的配置，但没有可用的 CONFIG_ENC_KEY。';
  const first = hasKey
    ? '<li><b>换回原来那把</b>：回 Cloudflare 控制台 <code>Variables and Secrets</code>，把 CONFIG_ENC_KEY 改回最初部署时用的那个值。改完刷新本页即可。</li>'
    : '<li><b>补回 CONFIG_ENC_KEY</b>：到 Cloudflare 控制台 <code>Variables and Secrets</code> 添加一个 Secret，值必须是最初加密这批数据用的那一个，否则解不开。</li>';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON_LINKS}<title>QQ Bot · ${title}</title><meta name="robots" content="noindex"><style nonce="${nonce}">
${LOGIN_CSS}
</style></head><body>
<div class="setup">
  <div class="head">
    <span class="badge bad"><i></i>${title}</span>
    <h1>加密主密钥需要处理</h1>
    <p class="sub">${lead}<br>机器人暂时不会读取配置，聊天记录和会话都还在。</p>
  </div>
  <div class="step-note">
    <h2>怎么办</h2>
    <ol>
      ${first}
      <li><b>彻底重置</b>：如果原密钥确实找不回来了，就把 CONFIG_ENC_KEY 换成一个新值，再回到本页点下面的「清空旧配置」，然后重新登录后台把 QQ 凭据和 AI 接口填一遍。聊天记录不受影响。</li>
    </ol>
    <form method="post" action="/recover/reset">
      <button class="btn" type="submit">清空旧配置，用当前密钥重新开始</button>
    </form>
    <p class="warn-line">清空会删掉 QQ Secret、AI Key 和 AI 列表这三类加密值，聊天记录、登录会话和对话行为设置都保留。确认已经换好 CONFIG_ENC_KEY 再点，否则清完还是打不开。</p>
  </div>
</div>
</body></html>`;
}

export function loginPage(nonce) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON_LINKS}<title>QQ Bot 管理后台</title><style nonce="${nonce}">
${LOGIN_CSS}
</style></head><body>
<div class="login">
  <div class="logo">${ROBOT_ICON}</div>
  <h1>QQ Bot</h1>
  <p class="sub">管理后台登录</p>
  <form id="f" autocomplete="on">
    <div class="field">
      <input id="p" type="password" placeholder="请输入管理密码" autocomplete="current-password" autofocus>
    </div>
    <button class="btn primary" type="submit" id="btn">登 录</button>
    <p class="msg" id="e"></p>
  </form>
  <p class="foot">Cloudflare Workers · 仅供管理员访问</p>
</div>
<script nonce="${nonce}">
var form=document.getElementById('f');
var input=document.getElementById('p');
var btn=document.getElementById('btn');
var msg=document.getElementById('e');
var locked=false;
function show(text,ok){msg.textContent=text;msg.className=ok?'msg ok':'msg';}
form.onsubmit=function(ev){
  ev.preventDefault();
  if(locked)return;
  var password=input.value;
  if(!password){show('请输入密码');input.focus();return;}
  btn.disabled=true;btn.textContent='验证中...';
  fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password})})
    .then(function(r){
      var retry=r.headers.get('Retry-After');
      return r.json().then(function(d){return {status:r.status,body:d,retry:retry};}).catch(function(){return {status:r.status,body:null,retry:retry};});
    })
    .then(function(res){
      if(res.status===200&&res.body&&res.body.ok){show('登录成功，正在进入...',true);btn.textContent='进入中...';location.replace('/admin');return;}
      var text=(res.body&&res.body.error&&res.body.error.message)||'登录失败';
      if(res.status===429){
        locked=true;
        var mins=res.retry?Math.ceil(Number(res.retry)/60):15;
        show('尝试次数过多，请 '+mins+' 分钟后再试');
        btn.textContent='已锁定';
        return;
      }
      show(text+(text==='密码错误'?'，请重试':''));
      btn.disabled=false;btn.textContent='登 录';
      input.value='';input.focus();
    })
    .catch(function(){show('网络错误，请重试');btn.disabled=false;btn.textContent='登 录';});
};
</script></body></html>`;
}

export function adminPage(nonce) {
  const shell = shellA(nonce);
  return shell.replace(
    '</body></html>',
    '<script nonce="' + nonce + '">' + ADMIN_JS + '</script></body></html>'
  );
}
