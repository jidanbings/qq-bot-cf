import { BOT_PATHS } from '../assets/icons.js';

const CSS_A = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --accent:#4f46e5;--accent-light:#eef2ff;
  --bg:#f8fafc;--surface:#ffffff;--surface-2:#f8fafc;--surface-3:#f1f5f9;
  --border:#f0f2f5;--border-strong:#e2e8f0;
  --text:#0f172a;--text-2:#475569;--muted:#94a3b8;
  --primary:#4f46e5;--primary-dark:#4338ca;--primary-soft:#eef2ff;--primary-ring:rgba(79,70,229,.08);
  --green:#16a34a;--green-soft:#f0fdf4;--red:#dc2626;--red-soft:#fef2f2;
  --amber:#b45309;--amber-soft:#fffbeb;--violet:#7c3aed;--violet-soft:#f5f3ff;
  --side-bg:#f0f7ff;
  --nav-hover:#dbeafe;--nav-active:#dbeafe;
  --sk:#e6ecf6;
  --radius:16px;--radius-sm:12px;
  --shadow-sm:0 1px 3px rgba(0,0,0,.02);
  --shadow:0 1px 2px rgba(15,23,42,.04),0 10px 28px -12px rgba(15,23,42,.14);
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace;
}
[data-theme="dark"]{
  --accent:#818cf8;--accent-light:#1e2540;
  --bg:#0b1120;--surface:#111827;--surface-2:#1a2234;--surface-3:#232d42;
  --border:#1e293b;--border-strong:#334155;
  --text:#e6ebf4;--text-2:#a9b6cc;--muted:#6b7894;
  --primary:#818cf8;--primary-dark:#a5b4fc;--primary-soft:#1e2540;--primary-ring:rgba(129,140,248,.16);
  --green:#34d399;--green-soft:#0f2a20;--red:#f87171;--red-soft:#2c1719;
  --amber:#fbbf24;--amber-soft:#2a2314;--violet:#a78bfa;--violet-soft:#231b38;
  --side-bg:#0f1a2e;
  --nav-hover:#1b2a44;--nav-active:#1e2f4d;
  --sk:#1a2233;
  --shadow-sm:0 1px 2px rgba(0,0,0,.3);
  --shadow:0 1px 2px rgba(0,0,0,.3),0 12px 32px -14px rgba(0,0,0,.7);
}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;display:flex;overflow:hidden}
a{color:inherit}
button{font-family:inherit}
:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
::selection{background:var(--accent-light);color:var(--accent)}

/* ============================ 左侧导航（照抄 user.html .sidebar） ============================ */
.side{width:240px;flex:0 0 240px;height:100vh;height:100dvh;position:fixed;left:0;top:0;bottom:0;z-index:40;
  display:flex;flex-direction:column;background:var(--side-bg);border-right:1px solid var(--border-strong);
  overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
  padding-bottom:env(safe-area-inset-bottom)}
.side-brand{display:flex;align-items:center;gap:.7rem;padding:1.5rem 1.25rem 1.25rem;border-bottom:1px solid var(--border-strong)}
.side-logo{width:32px;height:32px;flex-shrink:0;border-radius:10px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.side-logo svg{width:18px;height:18px;color:#fff}
.side-brand b{font-size:1.05rem;font-weight:700;color:var(--text);letter-spacing:-.01em;line-height:1.2}
.side-brand small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
.side-nav{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
  padding:.75rem .6rem;display:flex;flex-direction:column;gap:.15rem}
.nav-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:.6rem .75rem .2rem}
.tabs a{display:flex;align-items:center;gap:.6rem;padding:.6rem .75rem;border-radius:10px;
  color:var(--text-2);text-decoration:none;font-size:.85rem;font-weight:500;transition:all .15s}
.tabs a:hover{background:var(--nav-hover);color:var(--text)}
.tabs a.active{background:var(--nav-active);color:var(--text);font-weight:600}
.tabs a svg{width:16px;height:16px;flex-shrink:0;opacity:.85}
.tabs a .nav-tag{margin-left:auto;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:999px;
  background:var(--surface);color:var(--muted);font-variant-numeric:tabular-nums;border:1px solid var(--border-strong)}
.tabs a.active .nav-tag{background:var(--surface);color:var(--accent)}
.side-foot{margin-top:auto;flex:0 0 auto;padding:1rem .6rem 1.25rem;border-top:1px solid var(--border-strong);display:flex;flex-direction:column;gap:.35rem}
.side-user{display:flex;align-items:center;gap:9px;padding:0 .75rem;font-size:.78rem}
.side-user .ava{width:30px;height:30px;flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:12.5px;font-weight:600;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.side-user .who{min-width:0;flex:1;font-weight:600}
.side-user .who b{display:block;font-size:12px;color:var(--text)}
.side-user .who span{display:block;font-size:11px;color:var(--muted);font-weight:400;margin-top:1px}
.side-links{display:flex;flex-direction:column;gap:.35rem}
.side-links a,.side-links button{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-radius:8px;
  color:var(--muted);text-decoration:none;font-size:.78rem;background:none;border:none;cursor:pointer;width:100%;
  text-align:left;transition:all .15s}
.side-links a:hover,.side-links button:hover{background:var(--nav-hover);color:var(--text)}
.side-links button#logout{color:var(--muted)}
.side-links button#logout:hover{background:var(--red-soft);color:var(--red)}
.side-links svg{width:14px;height:14px}

.ws-row{display:flex;align-items:center;gap:.6rem;padding:.55rem .7rem;border:1px solid var(--border);border-radius:10px;margin-bottom:.5rem;background:var(--surface)}
.ws-row .ws-main{flex:1;min-width:0}
.ws-row b{font-size:.8rem}
.ws-row small{display:block;color:var(--muted);font-size:.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-tags{display:flex;gap:.35rem;flex-wrap:wrap;font-size:.68rem;color:var(--muted);margin-top:.25rem}
.ws-tag{background:var(--surface-2);border-radius:6px;padding:1px 6px;white-space:nowrap}
.ws-detail h4{font-size:.78rem;margin:.8rem 0 .3rem}
.ws-detail ul{list-style:none;display:flex;flex-direction:column;gap:.25rem}
.ws-detail li{font-size:.75rem;color:var(--text-2);line-height:1.6}
/* ============================ 主区（照抄 user.html .main-area） ============================ */
.scroll{margin-left:240px;height:100vh;height:100dvh;flex:1;display:flex;flex-direction:column;min-width:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
.topbar{flex:0 0 auto;height:60px;display:flex;align-items:center;gap:14px;padding:0 28px;
  background:var(--surface);border-bottom:1px solid var(--border-strong);position:relative;z-index:20}
.crumb{display:flex;align-items:baseline;gap:8px;min-width:0}
.crumb .k{font-size:12px;color:var(--muted)}
.crumb .v{font-size:15.5px;font-weight:650;letter-spacing:-.01em;white-space:nowrap}
.topbar .grow{flex:1}
.pill-state{display:inline-flex;align-items:center;gap:7px;padding:6px 14px 6px 10px;border-radius:999px;
  font-size:12.5px;font-weight:600;background:var(--surface-2);border:1px solid var(--border-strong);color:var(--text-2);white-space:nowrap}
.pill-state i{width:7px;height:7px;border-radius:50%;background:var(--muted);flex:0 0 auto}
.pill-state.ok{background:var(--green-soft);border-color:transparent;color:var(--green)}
.pill-state.ok i{background:var(--green);box-shadow:0 0 0 3px rgba(22,163,74,.16);animation:breathe 2.6s ease-in-out infinite}
.pill-state.bad{background:var(--red-soft);border-color:transparent;color:var(--red)}
.pill-state.bad i{background:var(--red)}
.pill-state.warn{background:var(--amber-soft);border-color:transparent;color:var(--amber)}
.pill-state.warn i{background:var(--amber)}
@keyframes breathe{0%,100%{box-shadow:0 0 0 3px rgba(22,163,74,.16)}50%{box-shadow:0 0 0 6px rgba(22,163,74,0)}}
.main{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;min-width:0;min-height:0}
.wrap{max-width:1100px;margin:0 auto;padding:2rem 2.5rem 3rem;min-width:0}

/* ============================ 通用元件 ============================ */
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:1.5rem;flex-wrap:wrap}
.page-head h2{font-size:1.6rem;font-weight:700;letter-spacing:-.02em;line-height:1.25}
.page-head p{margin-top:.3rem;font-size:.88rem}
.muted{color:var(--muted);font-size:12.5px;line-height:1.6}
.mono{font-family:var(--mono);font-size:12.5px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-sm);padding:1.75rem;margin-bottom:1.5rem}
.card>.card-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.card>.card-head h3{font-size:14.5px;font-weight:650;letter-spacing:-.01em}
.card>.card-head .hint{margin-left:auto;font-size:12px;color:var(--muted);font-weight:400}
.card.plain{box-shadow:none;background:var(--surface-2);border-style:dashed}
.error-text{color:var(--red);font-size:12.5px;line-height:1.7;word-break:break-word}

/* ---------- 按钮（无任何动画/过渡/缩放，点了就是最原始的反应） ---------- */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;padding:.6rem 1.5rem;border-radius:40px;
  border:1.5px solid var(--border-strong);background:var(--surface);color:var(--text-2);font-size:.85rem;font-weight:500;
  line-height:1.2;cursor:pointer;white-space:nowrap}
.btn svg{width:15px;height:15px;flex-shrink:0}
.btn:hover{background:var(--surface-2);border-color:var(--border-strong)}
.btn:active{background:var(--surface-3)}
.btn:disabled{opacity:.25;cursor:not-allowed}
.btn.primary{background:var(--accent);border:none;color:#fff}
.btn.primary:hover{background:var(--primary-dark)}
.btn.primary:active{background:var(--primary-dark)}
.btn.primary:disabled{background:var(--accent);opacity:.25}
.btn.success{background:var(--green);border:none;color:#fff}
.btn.success:hover{background:var(--green);filter:brightness(.95)}
.btn.danger{color:var(--red);border-color:#fecaca;background:var(--red-soft)}
.btn.danger:hover{background:var(--red-soft);border-color:var(--red)}
.btn.ghost{border-color:transparent;color:var(--text-2)}
.btn.ghost:hover{background:var(--surface-3);border-color:var(--border-strong);color:var(--text)}
.btn.sm{padding:.25rem .8rem;border-radius:30px;font-size:.72rem;gap:.3rem}
.btn.sm svg{width:14px;height:14px}
.btn.icon{padding:.5rem}
.btn.block{width:100%}
.btn.loading{pointer-events:none;opacity:.7}
.btn-row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
.btn-row.mt{margin-top:14px}
.btn-hint{font-size:12px;color:var(--muted);margin-top:12px;line-height:1.7}
.chip-row{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.25rem}
.chip{border:1px solid var(--border-strong);background:var(--surface);color:var(--text-2);border-radius:999px;
  padding:.42rem .95rem;font-size:.8rem;cursor:pointer;transition:border-color .15s,color .15s,background .15s}
.chip:hover{border-color:var(--accent);color:var(--accent)}
.chip:active{background:var(--accent-light)}

/* ---------- 指标卡片 ---------- */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1rem;margin-bottom:1.5rem}
.stat{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:14px;
  box-shadow:var(--shadow-sm);padding:1rem 1.1rem;overflow:hidden;transition:border-color .2s,box-shadow .2s}
.stat:hover{border-color:var(--border-strong);box-shadow:var(--shadow)}
.stat-ico{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  background:var(--accent-light);color:var(--accent);margin-bottom:12px}
.stat-ico svg{width:16px;height:16px}
.stat-label{display:block;font-size:12px;color:var(--muted);margin-bottom:5px}
.stat-value{display:flex;align-items:center;gap:7px;font-size:19px;font-weight:700;letter-spacing:-.02em;line-height:1.35}
.stat-value.ok{color:var(--green)}
.stat-value.bad{color:var(--red)}
.stat-value.warn{color:var(--amber)}
.stat-sub{display:block;font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.55}
.stat-value .dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.stat-value .dot.ok{background:var(--green);box-shadow:0 0 0 3px var(--green-soft)}
.stat-value .dot.bad{background:var(--red);box-shadow:0 0 0 3px var(--red-soft)}
.stat-value span{font-size:13px;font-weight:600;color:var(--muted)}
.outage #stat-bot{border-color:var(--red)}

/* ---------- 横幅 ---------- */
.banner{display:flex;gap:11px;align-items:flex-start;border-radius:12px;padding:12px 15px;font-size:12.5px;
  margin-bottom:10px;border:1px solid;line-height:1.65}
.banner .b-ico{flex:0 0 auto;width:18px;height:18px;margin-top:1px}
.banner .b-ico svg{width:18px;height:18px}
.banner .b-text{display:block;min-width:0;color:var(--text-2)}
.banner strong{display:block;font-weight:650;margin-bottom:2px}
.banner.bad{background:var(--red-soft);border-color:transparent}
.banner.bad strong,.banner.bad .b-ico{color:var(--red)}
.banner.warn{background:var(--amber-soft);border-color:transparent}
.banner.warn strong,.banner.warn .b-ico{color:var(--amber)}
.banner.info{background:var(--accent-light);border-color:transparent}
.banner.info strong,.banner.info .b-ico{color:var(--accent)}

/* ---------- 定义列表 ---------- */
.dl{display:grid;grid-template-columns:118px minmax(0,1fr);gap:9px 16px;font-size:12.5px;align-items:baseline}
.dl dt{color:var(--muted)}
.dl dd{color:var(--text);word-break:break-word;line-height:1.6;min-width:0}
.dl dd.ok{color:var(--green);font-weight:550}
.dl dd.bad{color:var(--red);font-weight:550}
.dl dd.warn{color:var(--amber);font-weight:550}
.dl dd.mono{font-family:var(--mono)}
.tip{margin-top:14px;padding-top:12px;border-top:1px dashed var(--border-strong);font-size:12px;color:var(--muted);line-height:1.7}
.tip b{color:var(--text-2);font-weight:600}

/* ---------- 控制台 ---------- */
.console{border:1px solid var(--border-strong);border-radius:12px;background:var(--surface-2);overflow:hidden}
[data-theme="dark"] .console{background:#0a0e14}
.console-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border-strong);
  font-size:11.5px;color:var(--muted)}
.console-bar .grow{flex:1}
.console-bar .live{width:6px;height:6px;border-radius:50%;background:var(--green);animation:breathe 2.6s ease-in-out infinite}
.console-body{max-height:290px;overflow-y:auto;padding:9px 12px;font-family:var(--mono);font-size:11.5px;line-height:1.85}
.console-body::-webkit-scrollbar{width:8px}
.console-body::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:4px}
.logline{display:flex;gap:9px;align-items:baseline;white-space:pre-wrap;word-break:break-word;color:var(--text-2)}
.logline .ts{color:var(--muted);flex:0 0 auto;font-variant-numeric:tabular-nums}
.logline .ts i{font-style:normal}
.logline .lv{flex:0 0 auto;font-size:10px;font-weight:700;letter-spacing:.04em;padding:0 5px;border-radius:4px;
  background:var(--surface-3);color:var(--muted);text-transform:uppercase}
.logline.warn{color:var(--amber)}
.logline.warn .lv{background:var(--amber-soft);color:var(--amber)}
.logline.error{color:var(--red)}
.logline.error .lv{background:var(--red-soft);color:var(--red)}

/* ---------- 配置表单（照抄 user.html .form-grid） ---------- */
.form-section{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-sm);
  margin-bottom:1.5rem;overflow:hidden}
.fs-head{display:flex;align-items:center;gap:12px;padding:1.25rem 1.5rem;border-bottom:1px solid var(--border-strong)}
.fs-ico{width:32px;height:32px;flex:0 0 auto;border-radius:10px;display:flex;align-items:center;justify-content:center;
  background:var(--accent-light);color:var(--accent)}
.fs-ico svg{width:17px;height:17px}
.fs-head h3{font-size:14.5px;font-weight:650;letter-spacing:-.01em}
.fs-head p{font-size:12px;color:var(--muted);margin-top:2px}
.fs-head .fs-state{margin-left:auto;font-size:11.5px;font-weight:600;color:var(--muted);display:inline-flex;align-items:center;gap:6px}
.fs-head .fs-state i{width:6px;height:6px;border-radius:50%;background:var(--muted)}
.fs-head .fs-state.ok{color:var(--green)}
.fs-head .fs-state.ok i{background:var(--green)}
.fs-body{padding:1.5rem 1.5rem .5rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0 1.5rem}
.grid .wide{grid-column:1/-1}
.field{margin-bottom:1.1rem;min-width:0}
.field>label{display:flex;align-items:center;gap:6px;font-size:.8rem;font-weight:600;color:var(--text-2);margin-bottom:.35rem}
.field>label .req-flag{font-size:10px;font-weight:600;color:var(--accent);background:var(--accent-light);padding:1px 6px;border-radius:6px}
.field input,.field textarea,.field select{width:100%;padding:.65rem .85rem;border:1.5px solid var(--border-strong);border-radius:12px;
  background:var(--surface);color:var(--text);font-size:.9rem;font-family:inherit;outline:none;transition:all .2s}
.field input:hover,.field textarea:hover,.field select:hover{border-color:var(--border-strong)}
.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--accent);box-shadow:0 0 0 4px var(--primary-ring)}
.field input::placeholder,.field textarea::placeholder{color:var(--muted);opacity:.75}
.field textarea{min-height:130px;resize:vertical;line-height:1.6;font-family:inherit}
.field select{appearance:none;-webkit-appearance:none;padding-right:34px;
  background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);
  background-position:calc(100% - 17px) 15px,calc(100% - 12px) 15px;background-size:5px 5px;background-repeat:no-repeat}
.field .hint{font-size:.7rem;color:var(--muted);margin-top:.25rem;line-height:1.6}
.model-row{display:flex;gap:.5rem}
.model-row select{flex:1;min-width:0}
.field .pw-wrap{position:relative}
.field .pw-wrap input{padding-right:64px}
.pw-toggle{position:absolute;right:5px;top:50%;transform:translateY(-50%);border:none;background:transparent;
  color:var(--muted);font-size:11.5px;padding:5px 8px;border-radius:7px;cursor:pointer}
.pw-toggle:hover{background:var(--surface-2);color:var(--text)}
.field input[type=password]::placeholder{font-size:12.5px}
/* 表单末尾的操作按钮行（照 user.html：按钮直接放在表单内，无 sticky 悬浮栏） */
.form-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.65rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border-strong)}
.grow{flex:1;min-width:0}
.prov{border:1.5px solid var(--border-strong);border-radius:16px;padding:1rem 1.1rem .2rem;margin-bottom:.9rem;background:var(--surface)}
.prov.is-off{opacity:.62}
.prov-head{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.9rem}
.prov-no{width:26px;height:26px;border-radius:9px;background:var(--accent-light);color:var(--accent);
  display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:none}
.prov-name{width:180px;padding:.45rem .7rem;border:1.5px solid var(--border-strong);border-radius:10px;
  background:var(--surface);color:var(--text);font-family:inherit;font-size:.85rem;font-weight:600;outline:none}
.prov-name:focus{border-color:var(--accent);box-shadow:0 0 0 4px var(--primary-ring)}
.prov-check{display:inline-flex;align-items:center;gap:.35rem;font-size:12.5px;color:var(--text-2);cursor:pointer}
.prov-check input{width:15px;height:15px;accent-color:var(--accent);cursor:pointer}
.prov-tools{margin-left:auto;display:flex;gap:.4rem;flex-wrap:wrap}
.prov-note{font-size:.72rem;color:var(--muted);padding:0 0 .9rem}
.igen-preview{display:block;max-width:100%;max-height:320px;margin-top:10px;border-radius:12px;border:1px solid var(--border-strong)}
.ok-text{color:var(--green);font-weight:600}
.prov-empty{text-align:center;padding:2rem 1rem;color:var(--muted);font-size:.9rem}
/* 紧凑 AI 行（编辑在弹窗里） */
.prov-list{margin:0 0 .2rem}
.prov-row{display:flex;align-items:center;gap:.7rem;padding:.7rem .4rem;border-bottom:1px solid var(--border);cursor:pointer}
.prov-row:last-child{border-bottom:none}
.prov-row:hover{background:var(--surface-2)}
.prov-row.is-off{opacity:.55}
.prov-info{min-width:0;flex:1}
.prov-info b{display:block;font-size:13.5px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prov-info small{display:block;font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prov-meta{display:flex;gap:.4rem;flex:0 0 auto;align-items:center}
.prov-flag{font-size:10.5px;font-weight:700;border-radius:6px;padding:2px 8px;white-space:nowrap}
.prov-flag.on{background:var(--green-soft);color:var(--green)}
.prov-flag.off{background:var(--surface-2);color:var(--muted)}
.prov-vision{font-size:10.5px;border-radius:6px;padding:2px 7px;background:var(--surface-2);color:var(--muted);white-space:nowrap}
.prov-vision.ok{color:#0e7490}
.prov-vision.off{color:var(--muted);opacity:.75}
.prov-keyok,.prov-keynew,.prov-keyno{font-size:10.5px;border-radius:6px;padding:2px 8px;background:var(--surface-2);color:var(--muted);white-space:nowrap}
.prov-keynew{background:var(--amber-soft);color:var(--amber)}
.prov-keyno{background:var(--red-soft);color:var(--red)}
/* 行内启停开关 */
.prov-switch{position:relative;width:40px;height:22px;flex:0 0 auto;display:inline-block;cursor:pointer;vertical-align:middle}
.prov-switch input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer;z-index:2}
.prov-switch i{position:absolute;inset:0;border-radius:999px;background:var(--border-strong);transition:background .15s}
.prov-switch i::after{content:"";position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:3px;left:3px;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.prov-switch input:checked+i{background:var(--accent)}
.prov-switch input:checked+i::after{left:21px}
.grp-add{display:flex;gap:8px;flex-wrap:wrap;margin:.4rem 0 .7rem}
.grp-add input{flex:1 1 200px;min-width:0;font-size:12.5px;padding:.45rem .6rem;border:1px solid var(--border-strong);
  border-radius:8px;background:var(--surface-2);color:var(--text)}
.grp-add input:focus{outline:none;border-color:var(--accent)}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:0 0 auto;
  border-radius:9px;border:1.5px solid var(--border-strong);background:var(--surface);color:var(--text-2);
  cursor:pointer;font-size:14px;line-height:1;padding:0}
.icon-btn:hover{border-color:var(--accent);color:var(--accent)}
/* 弹窗 */
.modal-mask{position:fixed;inset:0;background:rgba(15,18,34,.45);z-index:80;
  display:flex;align-items:center;justify-content:center;padding:16px}
.modal-mask[hidden]{display:none}
.modal{background:var(--surface);border:1px solid var(--border-strong);border-radius:18px;width:min(560px,100%);
  max-height:min(88vh,88dvh);display:flex;flex-direction:column;box-shadow:0 24px 60px -20px rgba(15,18,34,.45);
  animation:modalIn .18s ease}
.modal-sheet{width:min(640px,100%)}
#grp-m-openid{word-break:break-all}
@keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
.modal-head{display:flex;align-items:center;gap:.6rem;padding:1rem 1.2rem;border-bottom:1px solid var(--border)}
.modal-head h3{font-size:15px;font-weight:700;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.modal-x{margin-left:auto;width:30px;height:30px;flex:0 0 auto;border-radius:9px;border:none;background:var(--surface-2);
  color:var(--text-2);font-size:16px;cursor:pointer;line-height:1;padding:0}
.modal-x:hover{color:var(--red)}
.modal-body{padding:1rem 1.2rem .25rem;overflow-y:auto}
.modal-foot{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;padding:.9rem 1.2rem;border-top:1px solid var(--border)}
.test-result{font-size:12.5px;border-radius:10px;padding:.55rem .8rem;margin:.4rem 0 .6rem;word-break:break-all}
.test-result.testing{background:var(--surface-2);color:var(--text-2)}
.test-result.ok{background:var(--green-soft);color:var(--green)}
.test-result.bad{background:var(--red-soft);color:var(--red)}
.chip-label{font-size:12px;color:var(--muted);margin-top:.25rem}

/* ---------- 分段控件 ---------- */
.toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:16px}
.seg{display:inline-flex;gap:0;background:var(--surface-2);border:1.5px solid var(--border-strong);border-radius:10px;overflow:hidden}
.seg button{border:none;background:transparent;padding:.35rem .95rem;font-size:.78rem;cursor:pointer;
  color:var(--text-2);transition:all .15s;font-weight:500}
.seg button:not(:last-child){border-right:1px solid var(--border-strong)}
.seg button.active{background:var(--accent);color:#fff}
.seg button:not(.active):hover{background:var(--surface-3)}
.count{margin-left:auto;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}

/* ---------- 聊天记录卡片 ---------- */
.entries{display:flex;flex-direction:column;gap:.65rem}
.entry{background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-sm);
  padding:.75rem 1rem;transition:border-color .2s,box-shadow .2s}
.entry:hover{border-color:var(--border-strong);box-shadow:var(--shadow)}
.entry-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:11px;font-size:11.5px;color:var(--muted)}
.kind-system{background:var(--surface-2);border-style:dashed;box-shadow:none;padding:.6rem 1rem}
.kind-system:hover{box-shadow:none}
.kind-system .entry-head{margin-bottom:0;margin-top:8px}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
.tag.group{background:var(--accent-light);color:var(--accent)}
.tag.c2c{background:var(--green-soft);color:var(--green)}
.tag.sys{background:var(--amber-soft);color:var(--amber)}
.tag.model{background:var(--surface-3);color:var(--text-2);font-family:var(--mono);font-size:10.5px;max-width:220px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block}
.entry-head .scope{font-family:var(--mono);font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}
.entry-head .time{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap}
.entry-body{display:flex;flex-direction:column;gap:8px}
.bubble-row{display:flex;gap:9px;align-items:flex-start}
.bubble-row.ai{flex-direction:row-reverse}
.bubble-row .who{flex:0 0 auto;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;color:#fff;margin-top:1px}
.bubble-row.user .who{background:var(--accent)}
.bubble-row.ai .who{background:var(--violet)}
.bubble-text{font-size:13px;line-height:1.75;color:var(--text);white-space:pre-wrap;word-break:break-word;min-width:0;
  background:var(--surface-2);border-radius:4px 14px 14px 14px;padding:.45rem .8rem;max-width:78%}
.bubble-row.ai .bubble-text{background:var(--accent-light);color:var(--text);border-radius:14px 4px 14px 14px}
/* 系统事件行 */
.sys-line{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--text-2);line-height:1.65}
.sys-ico{flex:0 0 auto;font-size:13px;line-height:1.5}
/* 日期分隔 */
.day-sep{display:flex;align-items:center;gap:.8rem;color:var(--muted);font-size:11.5px;margin:.4rem 0}
.day-sep::before,.day-sep::after{content:"";flex:1;height:1px;background:var(--border)}
.day-sep span{white-space:nowrap;font-weight:600}

/* ---------- 聊天记录（QQ 风格：桌面双栏 / 手机单栏） ---------- */
.chat-wrap{display:grid;grid-template-columns:300px minmax(0,1fr);gap:12px;height:calc(100vh - 150px);min-height:420px}
.chat-list{display:flex;flex-direction:column;min-height:0;background:var(--surface);border:1px solid var(--border);
  border-radius:14px;overflow:hidden}
.chat-list-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);flex:0 0 auto}
.chat-list-head .hint{margin-right:auto;font-size:11.5px;color:var(--muted)}
.conv-list{flex:1 1 auto;min-height:0;overflow-y:auto}
.conv{display:flex;gap:10px;align-items:center;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .12s}
.conv:hover{background:var(--surface-2)}
.conv.active{background:var(--surface-2);box-shadow:inset 3px 0 0 var(--accent)}
.conv-av{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--surface-2);
  font-size:16px;flex:0 0 auto;color:var(--text-2)}
.conv-av svg{width:18px;height:18px}
.conv-av.sys{background:var(--accent-light);color:var(--accent)}
.conv-main{min-width:0;flex:1 1 auto}
.conv-name{font-weight:600;font-size:12.5px;display:flex;gap:6px;align-items:baseline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.conv-name .hint{font-weight:400;font-size:10.5px;color:var(--muted);flex:0 0 auto}
.conv-prev{color:var(--muted);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.conv-time{font-size:10.5px;color:var(--muted);flex:0 0 auto}
.conv-del{flex:0 0 auto;width:26px;height:26px;padding:0;border-radius:8px;border:1px solid var(--border-strong);
  background:var(--surface);color:var(--text-2);cursor:pointer;opacity:0;transition:opacity .12s;display:grid;place-items:center}
.conv-del:hover{color:var(--red);border-color:var(--red)}
.conv-del svg{width:13px;height:13px}
.conv:hover .conv-del{opacity:1}
.chat-thread{display:flex;flex-direction:column;min-height:0;background:var(--surface);border:1px solid var(--border);
  border-radius:14px;overflow:hidden}
.thread-head{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;
  border-bottom:1px solid var(--border);flex:0 0 auto;min-height:48px}
.thread-head b{font-size:13px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%}
.thread-head .hint{position:absolute;right:44px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);
  max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.thread-back{position:absolute;left:8px;top:50%;transform:translateY(-50%);display:none}
.thread-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.thread-empty{margin:auto;text-align:center;color:var(--muted);font-size:12.5px;line-height:1.8;padding:24px}
.thread-more{align-self:center;flex:0 0 auto}
.msg-group{position:relative;display:flex;flex-direction:column;gap:8px}
.msg-stamp{font-size:10.5px;color:var(--muted);text-align:center;font-variant-numeric:tabular-nums}
.msg-row{display:flex;gap:8px;align-items:flex-end}
.msg-row.me{flex-direction:row-reverse}
.msg-av{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--surface-2);
  font-size:13px;flex:0 0 auto;color:var(--text-2)}
.msg-av svg{width:15px;height:15px}
.msg-av.sys{background:var(--accent-light);color:var(--accent)}
.msg-bubble{max-width:min(620px,76%);padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.65;
  white-space:pre-wrap;word-break:break-word;background:var(--surface-2);color:var(--text);
  border:1px solid var(--border)}
.msg-row.me .msg-bubble{background:var(--accent);color:#fff;border-color:transparent;border-bottom-right-radius:4px}
.msg-row .msg-bubble{border-bottom-left-radius:4px}
.msg-bubble.sys{color:var(--text-2);font-style:normal;max-width:min(560px,70%)}
.msg-time{align-self:center;font-size:10.5px;color:var(--muted);margin:2px 0}

/* 筛选按钮上的计数 */
.seg .seg-n{font-size:.68rem;opacity:.75;font-variant-numeric:tabular-nums}
/* 本地预览示例数据横幅 */
.demo-note{background:var(--amber-soft);color:var(--amber);border:1px dashed var(--amber);border-radius:10px;
  padding:.55rem .9rem;font-size:12px;margin-bottom:.8rem}

/* ---------- 分页（照抄 user.html .pagination） ---------- */
.pager{display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:1.25rem}
.pager button{display:inline-flex;align-items:center;justify-content:center;padding:.35rem .95rem;background:var(--surface);
  border-radius:40px;border:1.5px solid var(--border-strong);cursor:pointer;font-size:.76rem;color:var(--text-2);
  transition:all .15s;font-weight:500}
.pager button:hover{background:var(--surface-2);border-color:var(--border-strong)}
.pager button:disabled{opacity:.25;cursor:not-allowed}
.pager .pg-info{font-variant-numeric:tabular-nums;font-size:.76rem;color:var(--muted)}

/* ---------- 空状态 / 加载 ---------- */
.empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:3rem 1rem;color:var(--muted)}
.empty-ico{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:var(--surface-2);border:1px solid var(--border-strong);margin-bottom:14px;color:var(--muted);font-size:2.5rem;opacity:.3}
.empty-ico svg{width:22px;height:22px;opacity:1}
.empty b{font-size:14px;font-weight:650;color:var(--text);margin-bottom:6px}
.empty p{font-size:12.5px;line-height:1.7;max-width:380px;color:var(--muted)}
.empty .btn-row{margin-top:16px}
/* 注意：加载占位不能叫 .loading——那会和 .btn.loading 冲突，
   导致按钮的 padding 被覆盖而「拉长」。现在统一用骨架屏 .sk-* */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}

/* ---------- 骨架屏 ---------- */
.sk-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.sk-head-txt{display:flex;flex-direction:column;gap:8px;flex:1;min-width:0}
.sk-bar{display:block;height:11px;border-radius:6px;background:var(--sk);animation:pulse 1.4s ease-in-out infinite}
.sk-block{display:block;border-radius:12px;background:var(--sk);animation:pulse 1.4s ease-in-out infinite}
.sk-input{display:block;height:44px;border-radius:12px;background:var(--sk);animation:pulse 1.4s ease-in-out infinite}
.sk-ico{width:38px;height:38px;border-radius:11px;flex:0 0 auto}
.sk-no{width:26px;height:26px;border-radius:9px;flex:0 0 auto}
.sk-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0 1.5rem}
.sk-field{display:flex;flex-direction:column;gap:8px;margin-bottom:1.1rem;min-width:0}
.sk-field.wide{grid-column:1/-1}
.sk-w10{width:10%}.sk-w15{width:15%}.sk-w20{width:20%}.sk-w25{width:25%}.sk-w30{width:30%}
.sk-w35{width:35%}.sk-w40{width:40%}.sk-w50{width:50%}.sk-w60{width:60%}.sk-w70{width:70%}
.sk-w80{width:80%}.sk-w90{width:90%}

/* ---------- Toast（右下角） ---------- */
.toast-wrap{position:fixed;right:20px;bottom:20px;display:flex;flex-direction:column;gap:9px;z-index:60;pointer-events:none}
.toast{pointer-events:auto;display:flex;align-items:center;gap:10px;padding:12px 16px 12px 14px;border-radius:12px;
  font-size:13px;font-weight:500;line-height:1.5;max-width:360px;
  background:var(--surface);border:1px solid var(--border-strong);border-left:4px solid var(--accent);
  color:var(--text);box-shadow:0 8px 28px rgba(0,0,0,.14);
  animation:toastIn .22s cubic-bezier(.2,.8,.3,1)}
.toast svg{width:17px;height:17px;flex:0 0 auto;color:var(--accent)}
.toast.ok{background:var(--green-soft);border-color:transparent;border-left:4px solid var(--green);color:var(--green)}
.toast.ok svg{color:var(--green)}
.toast.bad{background:var(--red-soft);border-color:transparent;border-left:4px solid var(--red);color:var(--red)}
.toast.bad svg{color:var(--red)}
@keyframes toastIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}

/* ---------- 移动端 ---------- */
.m-top,.m-mask{display:none}
@media (max-width:820px){
  .side{width:240px;transform:translateX(-100%);transition:transform .25s ease;
    box-shadow:4px 0 24px rgba(0,0,0,.15);border-right:none}
  .side.open{transform:translateX(0)}
  .scroll{margin-left:0;height:100vh;height:100dvh}
  .m-top{display:flex;align-items:center;gap:10px;height:56px;padding:0 14px;flex:0 0 auto;
    background:var(--surface);border-bottom:1px solid var(--border-strong);position:relative;z-index:20}
  .burger{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex:0 0 auto;
    border:none;background:rgba(255,255,255,.92);border-radius:10px;cursor:pointer;color:var(--text-2);
    box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .burger svg{width:18px;height:18px}
  .m-title{font-size:14.5px;font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .m-state{margin-left:auto}
  .m-top>.pill-state{margin-left:auto}
  .m-mask{display:block;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:39;opacity:0;
    pointer-events:none;transition:opacity .25s}
  .m-mask.show{opacity:1;pointer-events:auto}
  .topbar{display:none}
  .wrap{padding:1.5rem 1.25rem 2rem;padding-top:3.8rem}
  .page-head h2{font-size:19px}
}
@media (max-height:520px){
  .side{padding-top:10px}
  .side-brand{padding-bottom:8px}
  .side-user{display:none}
  .nav-label{padding:8px 12px 4px}
}
@media (max-width:600px){
  .wrap{padding:.5rem .5rem 2rem;padding-top:3.2rem}
  .page-head{margin-bottom:1rem;flex-direction:column;align-items:flex-start;gap:10px}
  .page-head h2{font-size:1rem}
  .page-head p{font-size:.75rem}
  .page-head .btn-row{width:100%}
  .page-head .btn-row .btn{flex:1}
  .stats{grid-template-columns:minmax(0,1fr);gap:10px}
  .stat{padding:13px 15px}
  .stat-value{font-size:16px}
  .stat-ico{width:24px;height:24px;margin-bottom:8px}
  .card,.form-section{padding:.75rem;border-radius:10px}
  .fs-head{padding:1rem}
  .fs-body{padding:.75rem .75rem .25rem}
  .grid{grid-template-columns:minmax(0,1fr)}
  .field{margin-bottom:.5rem}
  .field>label{font-size:.68rem;margin-bottom:.15rem}
  .field input,.field textarea,.field select{font-size:.78rem;padding:.4rem .55rem;border-radius:8px}
  .field textarea{min-height:120px}
  .dl{grid-template-columns:minmax(84px,auto) minmax(0,1fr)}
  .form-actions .btn{flex:1 1 auto;min-width:0}
  .modal-foot .btn{flex:1 1 auto}
  .prov-row{flex-wrap:wrap}
  .prov-meta{margin-left:auto}
  .prov-tools{flex:1 1 100%;width:auto;margin-left:0;justify-content:flex-end}
  .entry-head .time{margin-left:0;width:100%}
  .toolbar .count{margin-left:0;width:100%}
  .logline{flex-wrap:wrap;gap:2px 8px}
  .logline .ts{font-size:10.5px}
  .logline .ts i{display:none}
  .logline>span:last-child{flex:1 1 100%;order:3}
  /* 聊天记录：手机端单栏，点进会话全屏（像手机 QQ） */
  .chat-wrap{grid-template-columns:minmax(0,1fr);height:calc(100dvh - 170px);min-height:0;gap:0}
  .chat-thread{display:none}
  .chat-wrap.thread-open .chat-list{display:none}
  .chat-wrap.thread-open .chat-thread{display:flex}
  .thread-back{display:inline-flex}
  .thread-head .hint{display:none}
  .thread-head b{max-width:calc(100% - 170px)}
  .msg-bubble{max-width:84%}
  .conv-del{opacity:.55}
  /* 群管理弹窗：内容多，移动端直接全屏（头部固定/正文滚动/底部贴底） */
  .modal-mask.mask-sheet{padding:0;align-items:stretch}
  .modal-sheet{width:100%;max-height:none;height:100dvh;border-radius:0;border:none;animation:modalInM .18s ease}
  .modal-sheet .modal-head{padding:.8rem 1rem}
  .modal-sheet .modal-body{flex:1 1 auto;min-height:0;padding:.75rem .9rem .25rem}
  .modal-sheet .modal-foot{padding:.7rem .9rem;padding-bottom:max(.7rem,env(safe-area-inset-bottom))}
  .modal .form-actions{gap:.5rem}
  .modal .form-actions .field{flex:1 1 100%}
  .modal .form-actions .btn{flex:1 1 auto;min-width:0}
  .modal .prov-row{padding:.65rem .2rem}
}
@keyframes modalInM{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}

@media (prefers-reduced-motion:reduce){
  *{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important}
}
`;

const SVG = (paths) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  paths +
  '</svg>';

export const ICONS_A = {
  workspace: SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 13h8"/><path d="M8 16h5"/>'),
  status: SVG('<path d="M3 12h4l3 8 4-16 3 8h4"/>'),
  config: SVG(
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
  ),
  logs: SVG(
    '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/>'
  ),
  ai: SVG(
    '<path d="M12 3l2.1 5.4L20 10l-5.9 1.6L12 17l-2.1-5.4L4 10l5.9-1.6z"/><path d="M18 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>'
  ),
  imagegen: SVG(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'
  ),
  groups: SVG(
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  ),
  reminders: SVG(
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
  ),
  home: SVG('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>'),
  logout: SVG('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
};

export function shellA(nonce) {
  return `<!DOCTYPE html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32"><link rel="shortcut icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="robots" content="noindex"><title>QQ Bot 管理后台</title><style nonce="${nonce}">
${CSS_A}
</style></head><body>
<aside class="side" id="side">
  <div class="side-brand">
    <span class="side-logo">${SVG(BOT_PATHS)}</span>
    <div><b>QQ Bot</b><small>Workers Edition</small></div>
  </div>

  <nav class="side-nav">
    <div class="nav-label">概览</div>
    <div class="tabs">
      <a href="#status" data-tab="status">${ICONS_A.status}<span>运行状态</span><span class="nav-tag" id="nav-state">—</span></a>
    </div>
    <div class="nav-label">设置</div>
    <div class="tabs">
      <a href="#config" data-tab="config">${ICONS_A.config}<span>机器人配置</span></a>
      <a href="#ai" data-tab="ai">${ICONS_A.ai}<span>AI 对话</span></a>
      <a href="#imagegen" data-tab="imagegen">${ICONS_A.imagegen}<span>生图模型</span></a>
    </div>
    <div class="nav-label">群管理</div>
    <div class="tabs">
      <a href="#groups" data-tab="groups">${ICONS_A.groups}<span>群管理</span></a>
      <a href="#reminders" data-tab="reminders">${ICONS_A.reminders}<span>定时任务</span></a>
      <a href="#workspace" data-tab="workspace">${ICONS_A.workspace}<span>AI 工作区</span></a>
    </div>
    <div class="nav-label">数据</div>
    <div class="tabs">
      <a href="#logs" data-tab="logs">${ICONS_A.logs}<span>聊天记录</span><span class="nav-tag" id="nav-count">—</span></a>
    </div>
  </nav>

  <div class="side-foot">
    <div class="side-user">
      <span class="ava">管</span>
      <span class="who"><b>管理员</b><span id="side-theme">浅色外观</span></span>
    </div>
    <div class="side-links">
      <a href="/" target="_blank" rel="noopener">${ICONS_A.home}<span>首页</span></a>
      <button type="button" id="theme-toggle" title="切换深色 / 浅色" aria-label="切换深色 / 浅色"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><span>外观</span></button>
      <button type="button" id="logout" title="退出登录">${ICONS_A.logout}<span>退出</span></button>
    </div>
  </div>
</aside>

<div class="scroll">
  <div class="m-top">
    <button class="burger" id="burger" type="button" aria-label="打开菜单">${SVG('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>')}</button>
    <span class="m-title" id="m-title">运行状态</span>
    <span class="m-state" id="m-state"></span>
  </div>
  <div class="m-mask" id="mask"></div>

  <header class="topbar">
    <div class="crumb"><span class="k">管理后台</span><span class="v" id="crumb-title">运行状态</span></div>
    <span class="grow"></span>
    <span class="pill-state" id="pill">正在读取状态…</span>
    <div class="btn-row" id="top-actions"></div>
  </header>

  <main class="main" id="main"><div class="wrap" id="wrap"></div></main>
</div>
<div class="toast-wrap" id="toast"></div>
</body></html>`;
}

export const themeA = { css: CSS_A, name: 'A · 清爽浅色侧边栏' };
