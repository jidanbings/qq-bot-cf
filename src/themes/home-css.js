
export const HOME_CSS = `
@property --grid-line{syntax:'<color>';inherits:true;initial-value:rgba(15,23,42,.07)}

.home{
  --bg:#eef1f8;
  --panel:rgba(15,23,42,.028);
  --panel-2:rgba(15,23,42,.055);
  --line:rgba(15,23,42,.10);
  --line-2:rgba(15,23,42,.17);
  --fg:#0d1424;
  --fg-2:#4d5972;
  --fg-3:#6b7690;
  --brand:#4f46e5;
  --brand-2:#0e7490;
  --brand-3:#7c3aed;
  --up:#047857;
  --down:#dc2626;
  --on-accent:#fff;
  --ink:#0d1424;
  --inv:#fff;
  --nav-bg:rgba(246,248,253,.78);
  --nav-bg-stuck:rgba(255,255,255,.88);
  --grad-1:#6366f1;
  --grad-2:#8b5cf6;
  --grad-3:#22d3ee;
  --grad-text-a:#4f46e5;
  --grad-text-b:#a21caf;
  --grad-text-c:#0e7490;
  --tint-a:99,102,241;
  --tint-b:34,211,238;
  --tint-c:168,85,247;
  --grid-line:rgba(15,23,42,.07);
  --window-bg:linear-gradient(180deg,#fff,#f6f8fe);
  --window-line:rgba(15,23,42,.10);
  --chrome:rgba(15,23,42,.025);
  --field:rgba(15,23,42,.04);
  --field-deep:rgba(15,23,42,.07);
  --float-bg:rgba(255,255,255,.94);
  --sh-sm:0 1px 2px rgba(15,23,42,.05),0 10px 26px -18px rgba(15,23,42,.5);
  --sh-float:0 18px 40px -22px rgba(15,23,42,.45);
  --sh-window:0 1px 2px rgba(15,23,42,.05),0 26px 64px -34px rgba(15,23,42,.55);
  --reveal-shift:16px;
  --glow-g1:rgba(99,102,241,.20);
  --glow-g2:rgba(34,211,238,.16);
  --glow-g3:rgba(168,85,247,.14);
  --glow-g4:rgba(99,102,241,.18);
  --wave:rgba(99,102,241,.18);
  --wave-line:rgba(15,23,42,.09);
  --wave-line-2:rgba(15,23,42,.06);
  --glass:rgba(255,255,255,.16);
  --glass-chip:rgba(255,255,255,.20);
  --glass-sel:rgba(255,255,255,.55);
  --glass-hover:rgba(255,255,255,.34);
  --glass-edge:rgba(255,255,255,.55);
  --glass-hi:rgba(255,255,255,.85);
  --glass-lo:rgba(15,23,42,.10);
  --glass-glow:0 8px 32px -12px rgba(15,23,42,.45),0 0 0 1px rgba(255,255,255,.28);
  --glass-thumb:rgba(15,23,42,.18);
  --glass-textsh:rgba(255,255,255,.55);
  --shadow:var(--sh-window);
  --maxw:1160px;
  --r:18px;
  --r-sm:12px;
  background:var(--bg);
  color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  line-height:1.6;
  overflow-x:hidden;
}
.home.dark{
  --bg:#05070f;
  --panel:rgba(255,255,255,.035);
  --panel-2:rgba(255,255,255,.06);
  --line:rgba(255,255,255,.09);
  --line-2:rgba(255,255,255,.16);
  --fg:#f2f5ff;
  --fg-2:#b3bdd6;
  --fg-3:#8590a8;
  --brand:#6366f1;
  --brand-2:#22d3ee;
  --brand-3:#a855f7;
  --up:#34d399;
  --down:#fb7185;
  --on-accent:#fff;
  --ink:#f2f5ff;
  --inv:#080d1a;
  --nav-bg:rgba(5,7,15,.72);
  --nav-bg-stuck:rgba(5,7,15,.9);
  --grad-1:#6366f1;
  --grad-2:#a855f7;
  --grad-3:#22d3ee;
  --grad-text-a:#818cf8;
  --grad-text-b:#c084fc;
  --grad-text-c:#22d3ee;
  --tint-a:99,102,241;
  --tint-b:34,211,238;
  --tint-c:168,85,247;
  --grid-line:rgba(255,255,255,.05);
  --window-bg:linear-gradient(180deg,#0d1224,#080b15);
  --window-line:rgba(255,255,255,.16);
  --chrome:rgba(255,255,255,.028);
  --field:rgba(255,255,255,.03);
  --field-deep:rgba(0,0,0,.35);
  --float-bg:rgba(13,18,36,.92);
  --sh-sm:0 1px 2px rgba(15,23,42,.05),0 8px 24px rgba(15,23,42,.05);
  --sh-float:0 18px 40px -20px rgba(0,0,0,.9);
  --sh-window:0 24px 60px -28px rgba(0,0,0,.85);
  --reveal-shift:16px;
  --glow-g1:rgba(79,70,229,.42);
  --glow-g2:rgba(34,211,238,.24);
  --glow-g3:rgba(168,85,247,.18);
  --glow-g4:rgba(99,102,241,.26);
  --wave:rgba(99,102,241,.30);
  --wave-line:rgba(255,255,255,.09);
  --wave-line-2:rgba(255,255,255,.06);
  --glass:rgba(255,255,255,.055);
  --glass-chip:rgba(255,255,255,.055);
  --glass-sel:rgba(255,255,255,.16);
  --glass-hover:rgba(255,255,255,.11);
  --glass-edge:rgba(255,255,255,.22);
  --glass-hi:rgba(255,255,255,.34);
  --glass-lo:rgba(0,0,0,.30);
  --glass-glow:0 10px 40px -14px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.10);
  --glass-thumb:rgba(0,0,0,.45);
  --glass-textsh:rgba(0,0,0,.55);
  --shadow:var(--sh-window);
}
.home *,.home *::before,.home *::after{box-sizing:border-box}
.home h1,.home h2,.home h3,.home h4,.home p,.home ul,.home li,.home figure{margin:0;padding:0}
.home ul{list-style:none}
.home a{color:inherit;text-decoration:none}
.home svg{display:block}
.home b,.home strong{font-weight:650;color:var(--fg)}
.home ::selection{background:rgba(99,102,241,.42)}

.home .wrap{width:100%;max-width:var(--maxw);margin:0 auto;padding:0 24px}
.home .sec{padding:96px 0;position:relative}
.home .sec-head{max-width:720px;margin:0 auto 54px;text-align:center}
.home .sec-head.center{display:flex;flex-direction:column;align-items:center}
.home .sec-head.left{margin:0 0 46px;text-align:left;max-width:620px}
.home .sec-head.last{margin-bottom:34px}

.home .eyebrow{
  display:inline-flex;align-items:center;gap:8px;
  font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
  color:var(--brand-2);margin-bottom:16px;
}
.home .eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--brand-2);box-shadow:0 0 12px var(--brand-2)}
.home h2.title{font-size:34px;font-weight:700;letter-spacing:-.025em;line-height:1.24}
.home .lede{font-size:15px;color:var(--fg-2);line-height:1.85;margin-top:16px}

.home .btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:12px 22px;border-radius:999px;border:1px solid transparent;
  font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;
  white-space:nowrap;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,border-color .18s ease,color .18s ease;
}
.home .btn svg{width:16px;height:16px;flex:0 0 auto}
.home .btn:active{transform:translateY(1px)}
.home .btn-primary{
  background:linear-gradient(135deg,var(--grad-1),var(--grad-2) 55%,var(--grad-3));
  color:var(--on-accent);box-shadow:0 10px 30px -10px rgba(var(--tint-a),.85);
}
.home .btn-primary:hover{transform:translateY(-2px);box-shadow:0 16px 40px -12px rgba(var(--tint-c),.95)}
.home .btn-ghost{background:var(--panel);border-color:var(--line-2);color:var(--fg)}
.home .btn-ghost:hover{background:var(--panel-2);border-color:var(--line-2);transform:translateY(-2px)}
.home .btn-sm{padding:9px 18px;font-size:13px}

.home .nav{
  position:sticky;top:0;z-index:40;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  background:var(--nav-bg);border-bottom:1px solid transparent;
  transition:border-color .25s ease,background .25s ease;
}
.home .nav.stuck{border-bottom-color:var(--line);background:var(--nav-bg-stuck)}
.home .nav-in{display:flex;align-items:center;gap:28px;height:66px}
.home .brand{display:flex;align-items:center;gap:11px;font-weight:700;font-size:16px;letter-spacing:-.01em}
.home .brand small{display:block;font-size:11px;font-weight:400;color:var(--fg-3);letter-spacing:0}
.home .logo{
  width:34px;height:34px;border-radius:11px;flex:0 0 auto;
  display:flex;align-items:center;justify-content:center;color:#fff;
  background:linear-gradient(135deg,var(--grad-1),var(--grad-2));
  box-shadow:0 6px 18px -6px rgba(var(--tint-a),.9);
}
.home .logo svg{width:19px;height:19px}
.home .nav-links{display:flex;align-items:center;gap:4px;margin-left:auto}
.home .nav-links a{
  padding:8px 14px;border-radius:999px;font-size:14px;color:var(--fg-2);
  transition:color .18s ease,background .18s ease;white-space:nowrap;
}
.home .nav-links a:hover{color:var(--fg);background:var(--panel)}
.home .nav .btn{margin-left:4px;flex:0 0 auto}
.home .nav-short{display:none}

.home .hero{position:relative;padding:86px 0 96px;overflow:hidden}
.home .glow{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0}
.home .glow.g1{width:620px;height:620px;top:-320px;left:-160px;background:var(--glow-g1)}
.home .glow.g2{width:560px;height:560px;top:-260px;right:-180px;background:var(--glow-g2)}
.home .glow.g3{width:700px;height:460px;top:280px;left:34%;background:var(--glow-g3)}
.home .grid-bg{
  position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:var(--grid);
  background-size:56px 56px;
  background-image:
    linear-gradient(var(--grid-line) 1px,transparent 1px),
    linear-gradient(90deg,var(--grid-line) 1px,transparent 1px);
  -webkit-mask-image:radial-gradient(ellipse 90% 62% at 50% 26%,#000 12%,transparent 72%);
  mask-image:radial-gradient(ellipse 90% 62% at 50% 26%,#000 12%,transparent 72%);
  opacity:.6;
}
.home .hero-in{position:relative;z-index:1;display:grid;grid-template-columns:1.04fr .96fr;gap:56px;align-items:center}

.home .pill{
  display:inline-flex;align-items:center;gap:9px;padding:6px 7px 6px 13px;
  border-radius:999px;border:1px solid var(--line-2);background:var(--panel);
  font-size:12.5px;color:var(--fg-2);margin-bottom:24px;
}
.home .pill b{
  margin-left:4px;padding:3px 11px;border-radius:999px;font-size:11.5px;font-weight:600;
  background:linear-gradient(135deg,rgba(var(--tint-a),.28),rgba(var(--tint-b),.22));
  color:var(--brand);border:1px solid var(--line);
}
.home .live{width:7px;height:7px;border-radius:50%;background:var(--up);box-shadow:0 0 0 3px rgba(52,211,153,.18);flex:0 0 auto}

.home .hero h1{font-size:52px;font-weight:700;letter-spacing:-.035em;line-height:1.14}
.home .grad{
  background:linear-gradient(100deg,var(--grad-text-a) 0%,var(--grad-text-b) 42%,var(--grad-text-c) 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.home .hero .lede{font-size:16.5px;max-width:520px}
.home .lede code,.home .tile p code{
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.9em;padding:1px 6px;border-radius:5px;
  background:var(--panel-2);border:1px solid var(--line);color:var(--fg);
  white-space:nowrap;
}
.home .cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
.home .facts{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}
.home .fact{
  display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:10px;
  border:1px solid var(--line);background:rgba(255,255,255,.025);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:var(--fg-2);
}
.home .fact i{width:5px;height:5px;border-radius:50%;background:var(--brand-2);flex:0 0 auto}

.home .preview{position:relative}
.home .window{
  border:1px solid var(--window-line);border-radius:var(--r);overflow:hidden;
  background:var(--window-bg);
  box-shadow:var(--sh-window);
}
.home .win-bar{
  display:flex;align-items:center;gap:9px;padding:12px 15px;
  border-bottom:1px solid var(--window-line);background:var(--chrome);
}
.home .win-dots{display:flex;gap:6px}
.home .win-dots span{width:10px;height:10px;border-radius:50%}
.home .win-dots .d1{background:#ff5f57}
.home .win-dots .d2{background:#febc2e}
.home .win-dots .d3{background:#28c840}
.home .win-url{
  margin:0 auto;padding:4px 14px;border-radius:999px;border:1px solid var(--window-line);
  background:var(--field-deep);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:11.5px;color:var(--fg-3);white-space:nowrap;
}
.home .win-live{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--up)}
.home .win-body{padding:18px}
.home .win-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.home .chip{
  display:inline-flex;align-items:center;gap:7px;padding:8px 12px;border-radius:10px;
  border:1px solid var(--line);background:var(--field);font-size:12px;color:var(--fg-2);flex:1 1 auto;
}
.home .chip b{margin-left:auto;color:var(--fg);font-weight:600;font-variant-numeric:tabular-nums}

.home .chats{display:flex;flex-direction:column;gap:13px}
.home .msg{display:flex;gap:10px;align-items:flex-start}
.home .msg>span:not(.av){min-width:0;flex:1 1 auto;display:flex;flex-direction:column}
.home .msg.out>span:not(.av){align-items:flex-end}
.home .av{
  width:30px;height:30px;border-radius:9px;flex:0 0 auto;
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;
}
.home .av.me{background:var(--field-deep);color:var(--fg-2);border:1px solid var(--line)}
.home .av.bot{background:linear-gradient(135deg,var(--grad-1),var(--grad-2));color:#fff}
.home .av.bot svg{width:16px;height:16px}
.home .bubble{
  padding:9px 13px;border-radius:13px;font-size:13px;line-height:1.65;
  border:1px solid var(--line);background:var(--field);color:var(--fg);
  max-width:100%;overflow-wrap:anywhere;
}
.home .msg.out{flex-direction:row-reverse}
.home .msg.out .bubble{
  background:linear-gradient(135deg,rgba(var(--tint-a),.30),rgba(var(--tint-c),.24));
  border-color:rgba(var(--tint-c),.42);border-bottom-right-radius:5px;
}
.home .msg.in .bubble{border-bottom-left-radius:5px}
.home .who{font-size:11px;color:var(--fg-3);margin-bottom:5px;padding:0 3px}
.home .msg.out .who{text-align:right}
.home .caret{
  display:inline-block;width:7px;height:14px;margin-left:3px;vertical-align:-2px;
  background:var(--brand-2);
}
.home .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:17px}
.home .metric{
  padding:11px 12px;border-radius:11px;border:1px solid var(--line);
  background:var(--field);text-align:center;
}
.home .metric b{display:block;font-size:18px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.home .metric span{display:block;font-size:10.5px;color:var(--fg-3);margin-top:3px}
.home .metric .ok{color:var(--up)}

.home .float{
  position:absolute;z-index:2;display:flex;align-items:center;gap:10px;
  padding:10px 14px;border-radius:14px;border:1px solid var(--line-2);
  background:var(--float-bg);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  box-shadow:var(--sh-float);font-size:12px;
}
.home .float.f1{top:-44px;left:-16px}
.home .float.f2{bottom:-46px;right:-20px}
.home .float .ico{
  width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;
  background:rgba(var(--tint-a),.16);color:var(--brand);
}
.home .float .ico svg{width:15px;height:15px}
.home .float b{display:block;font-size:12.5px;color:var(--fg)}
.home .float span{display:block;font-size:10.5px;color:var(--fg-3)}

.home .preview .window{
  -webkit-mask-image:linear-gradient(#000 94%,rgba(0,0,0,.72));
  mask-image:linear-gradient(#000 94%,rgba(0,0,0,.72));
}

.home .bento{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
.home .tile{
  position:relative;grid-column:span 2;overflow:hidden;
  padding:24px;border-radius:var(--r);border:1px solid var(--line);
  background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.018));
  transition:border-color .22s ease,transform .22s ease,background .22s ease;
}
.home .tile:hover{border-color:var(--line-2);transform:translateY(-3px);background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.03))}
.home .tile.wide{grid-column:span 4}
.home .tile figcaption,.home .tile .t-body{position:relative;z-index:1}
.home .t-ico{
  width:40px;height:40px;border-radius:12px;margin-bottom:16px;
  display:flex;align-items:center;justify-content:center;color:var(--brand);
  background:linear-gradient(135deg,rgba(var(--tint-a),.20),rgba(var(--tint-c),.12));
  border:1px solid var(--line);
}
.home .t-ico svg{width:19px;height:19px}
.home .tile h3{font-size:16px;font-weight:650;letter-spacing:-.01em}
.home .tile p{font-size:13.5px;color:var(--fg-2);line-height:1.75;margin-top:9px}
.home .tile .t-extra{margin-top:18px;position:relative;z-index:1}
.home .tags{display:flex;flex-wrap:wrap;gap:7px}
.home .tag{
  padding:4px 11px;border-radius:999px;border:1px solid var(--line);
  background:var(--field);font-size:11.5px;color:var(--fg-2);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
.home .steps{display:flex;flex-direction:column;gap:10px;margin-top:2px}
.home .step{display:flex;gap:11px;align-items:flex-start;font-size:13px;color:var(--fg-2)}
.home .step i{
  width:20px;height:20px;border-radius:7px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;
  background:rgba(var(--tint-b),.14);color:var(--brand-2);font-size:11px;font-weight:700;font-style:normal;
}
.home .step b{color:var(--fg);font-weight:600}

.home .wave{
  position:absolute;right:-90px;bottom:-120px;width:320px;height:320px;border-radius:50%;
  background:radial-gradient(circle at 30% 30%,var(--wave),transparent 62%);
  filter:blur(6px);pointer-events:none;
}
.home .wave::before,.home .wave::after{
  content:'';position:absolute;inset:34px;border-radius:50%;
  border:1px solid var(--wave-line);
}
.home .wave::after{inset:72px;border-color:var(--wave-line-2)}
.home .wave{opacity:.85}

.home .band{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.03),transparent)}
.home .band-in{display:grid;grid-template-columns:repeat(4,1fr)}
.home .band .cell{padding:30px 8px;text-align:center;border-left:1px solid var(--line)}
.home .band .cell:first-child{border-left:none}
.home .band b{display:block;font-size:27px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.home .band span{display:block;font-size:12.5px;color:var(--fg-3);margin-top:5px}

.home .flow{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start}
.home .flow-list{display:flex;flex-direction:column;gap:6px}
.home .fitem{
  display:flex;gap:16px;padding:18px;border-radius:var(--r-sm);
  border:1px solid transparent;transition:border-color .2s ease,background .2s ease;
}
.home .fitem:hover{border-color:var(--line);background:rgba(255,255,255,.03)}
.home .fnum{
  width:32px;height:32px;border-radius:10px;flex:0 0 auto;
  display:flex;align-items:center;justify-content:center;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;font-weight:600;
  color:var(--brand);background:rgba(var(--tint-a),.14);border:1px solid rgba(var(--tint-a),.28);
}
.home .fitem h4{font-size:14.5px;font-weight:600}
.home .fitem p{font-size:13px;color:var(--fg-2);line-height:1.75;margin-top:6px}

.home .fitem.fork{padding-bottom:20px}
.home .paths{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:11px}
.home .path{
  padding:13px 14px;border-radius:var(--r-sm);
  border:1px solid var(--line-2);background:var(--panel);
}
.home .p-tag{
  display:inline-flex;align-items:center;gap:7px;
  font-size:12px;font-weight:650;color:var(--fg);letter-spacing:.01em;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
.home .pdot{
  width:7px;height:7px;border-radius:50%;flex:0 0 auto;
  background:var(--brand);box-shadow:0 0 0 3px rgba(var(--tint-a),.16);
}
.home .path:nth-child(2) .pdot{background:var(--brand-2);box-shadow:0 0 0 3px rgba(var(--tint-b),.16)}
.home .path p{font-size:12.5px;line-height:1.7;margin-top:7px}
.home .p-note{
  font-size:12.5px;color:var(--fg-3);line-height:1.7;
  margin-top:11px;padding-top:11px;border-top:1px dashed var(--line-2);
}

.home .diagram{
  position:sticky;top:92px;padding:26px;border-radius:var(--r);
  border:1px solid var(--line);background:linear-gradient(180deg,var(--panel-2),var(--panel));
}
.home .node{
  padding:13px 16px;border-radius:var(--r-sm);border:1px solid var(--line-2);
  background:var(--panel);
}
.home .node .n-k{font-size:11px;color:var(--fg-3);letter-spacing:.08em;text-transform:uppercase}
.home .node .n-v{font-size:14px;font-weight:600;margin-top:4px}
.home .node .n-d{font-size:11.5px;color:var(--fg-3);margin-top:5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.home .node.edge{border-color:rgba(var(--tint-b),.4);background:rgba(var(--tint-b),.07)}
.home .node.core{
  border-color:rgba(var(--tint-c),.5);
  background:linear-gradient(135deg,rgba(var(--tint-a),.22),rgba(var(--tint-c),.14));
}
.home .arrow{display:flex;justify-content:center;padding:7px 0;color:var(--fg-3)}
.home .arrow svg{width:17px;height:17px}
.home .split{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.home .split .node{padding:11px 12px;text-align:center}
.home .split .node .n-v{font-size:12.5px}
.home .split .node .n-d{font-size:10.5px;word-break:break-word}

.home .final{position:relative;padding:104px 0;text-align:center;overflow:hidden}
.home .final .glow.g4{width:760px;height:420px;left:50%;top:36%;margin-left:-380px;background:var(--glow-g4)}
.home .final .wrap{position:relative;z-index:1}
.home .final h2{font-size:37px;font-weight:700;letter-spacing:-.03em;line-height:1.2}
.home .final .cta{justify-content:center;margin-top:0}
.home .final .lede{max-width:560px;text-align:center}

.home .foot{border-top:1px solid var(--line);background:var(--panel);padding:26px 0}
.home .copyright{
  text-align:center;
  font-size:12.5px;color:var(--fg-3);
  letter-spacing:.02em;
}
.home .copyright .c-sep{margin:0 .5em;opacity:.55}
.home .foot-links{text-align:center;margin-top:10px}
.home .foot-link{
  display:inline-flex;align-items:center;gap:7px;
  font-size:12.5px;color:var(--fg-3);text-decoration:none;
  padding:4px 10px;border-radius:999px;border:1px solid transparent;
  transition:color .15s,border-color .15s,background .15s;
}
.home .foot-link svg{width:15px;height:15px;opacity:.85;flex:0 0 auto}
.home .foot-link:hover{color:var(--brand-2);border-color:var(--line-2);background:var(--panel-2)}

.home a:focus-visible,.home .btn:focus-visible,.home .seg button:focus-visible{
  outline:2px solid var(--brand-2);outline-offset:3px;border-radius:8px;
}

.home .fx-dock{
  position:fixed;right:18px;bottom:18px;z-index:60;
  display:flex;align-items:center;gap:9px;
  padding:7px 9px 7px 15px;border-radius:999px;
  background:var(--glass);
  border:1px solid var(--glass-edge);
  box-shadow:
    var(--glass-glow),
    inset 1px 1px 0 var(--glass-hi),
    inset -1px -1px 1px var(--glass-lo);
  filter:drop-shadow(0 1px 2px var(--glass-textsh));
}
.home .dock-label{
  font-size:11.5px;color:var(--fg-3);font-weight:600;
  letter-spacing:.06em;
}
.home .seg{
  display:inline-flex;align-items:center;gap:3px;
  padding:3px;border-radius:999px;
  background:var(--glass-chip);
  border:1px solid var(--glass-edge);
  box-shadow:inset 0 1px 0 var(--glass-hi);
}
.home .seg button{
  display:inline-flex;align-items:center;justify-content:center;
  border:none;background:transparent;color:var(--fg-2);cursor:pointer;font-family:inherit;
  padding:5px 12px;border-radius:999px;font-size:11.5px;font-weight:600;line-height:1.4;
  transition:background .18s ease,color .18s ease,box-shadow .18s ease;
}
.home .seg button:hover{color:var(--fg);background:var(--glass-hover)}
.home .seg button[aria-checked="true"]{
  background:var(--glass-sel);
  color:var(--fg);
  box-shadow:inset 0 1px 0 var(--glass-hi),0 1px 2px var(--glass-thumb);
}
.home .dock-sep{width:1px;height:18px;background:var(--glass-edge);flex:0 0 auto}
.home .dock-note{
  font-size:11px;color:var(--fg-3);font-weight:500;
  padding-right:6px;white-space:nowrap;
}
@media (max-width:640px){
  .home .fx-dock{right:10px;bottom:10px;gap:6px;padding:6px 7px}
  .home .dock-label,.home .dock-note{display:none}
  .home .seg button{padding:5px 9px}
}

.home .reveal{opacity:1}
@media (prefers-reduced-motion:no-preference){
  .home.motion .reveal{opacity:0;transform:translateY(var(--reveal-shift));animation:home-in .62s cubic-bezier(.22,.68,.32,1) forwards}
  .home.motion .reveal.d1{animation-delay:.06s}
  .home.motion .reveal.d2{animation-delay:.13s}
  .home.motion .reveal.d3{animation-delay:.2s}
  .home.motion .reveal.d4{animation-delay:.27s}
  @keyframes home-in{to{opacity:1;transform:none}}

  .home.motion .glow.g1{animation:home-drift 12s ease-in-out infinite alternate}
  .home.motion .glow.g2{animation:home-drift 15s ease-in-out infinite alternate-reverse}
  .home.motion .glow.g3{animation:home-drift 18s ease-in-out infinite alternate}
  @keyframes home-drift{
    from{transform:translate3d(0,0,0) scale(1)}
    to{transform:translate3d(90px,64px,0) scale(1.14)}
  }

  .home.motion .float.f1{animation:home-bob 7s ease-in-out infinite}
  .home.motion .float.f2{animation:home-bob 8.5s ease-in-out infinite reverse}
  @keyframes home-bob{from{transform:translateY(-6px)}to{transform:translateY(6px)}}

  .home.motion .wave{animation:home-ripple 4.5s ease-out infinite}
  @keyframes home-ripple{
    0%{transform:scale(.62);opacity:0}
    35%{opacity:1}
    100%{transform:scale(1.25);opacity:0}
  }
  .home.motion .wave::before{animation:home-ripple 4.5s ease-out infinite .35s}
  .home.motion .wave::after{animation:home-ripple 4.5s ease-out infinite .7s}

  .home.motion .caret{animation:home-blink 1.05s steps(1,end) infinite}
  @keyframes home-blink{0%,50%{opacity:1}50.01%,100%{opacity:0}}

  .home.motion .seg button[aria-checked="true"]{
    transition:background .18s ease,color .18s ease,box-shadow .18s ease;
  }
}

.home,.home .window,.home .nav,.home .tile,.home .float,.home .node,.home .fx-dock{
  transition:background-color .28s ease,color .28s ease,border-color .28s ease;
}
   :not(.dark) 保证「手动选黑夜」在系统是浅色时依然压得住；
@media (prefers-color-scheme:dark){
  .home:not(.t-light):not(.dark){
    --bg:#05070f;
    --panel:rgba(255,255,255,.035);
    --panel-2:rgba(255,255,255,.06);
    --line:rgba(255,255,255,.09);
    --line-2:rgba(255,255,255,.16);
    --fg:#f2f5ff;
    --fg-2:#b3bdd6;
    --fg-3:#8590a8;
    --brand:#6366f1;
    --brand-2:#22d3ee;
    --brand-3:#a855f7;
    --up:#34d399;
    --down:#fb7185;
    --ink:#f2f5ff;
    --inv:#080d1a;
    --nav-bg:rgba(5,7,15,.72);
    --nav-bg-stuck:rgba(5,7,15,.9);
    --grad-2:#a855f7;
    --grad-text-a:#818cf8;
    --grad-text-b:#c084fc;
    --grad-text-c:#22d3ee;
    --grid-line:rgba(255,255,255,.05);
    --window-bg:linear-gradient(180deg,#0d1224,#080b15);
    --window-line:rgba(255,255,255,.16);
    --chrome:rgba(255,255,255,.028);
    --field:rgba(255,255,255,.03);
    --field-deep:rgba(0,0,0,.35);
    --float-bg:rgba(13,18,36,.92);
    --sh-float:0 18px 40px -20px rgba(0,0,0,.9);
    --sh-window:0 24px 60px -28px rgba(0,0,0,.85);
    --glow-g1:rgba(79,70,229,.42);
    --glow-g2:rgba(34,211,238,.24);
    --glow-g3:rgba(168,85,247,.18);
    --glow-g4:rgba(99,102,241,.26);
    --wave:rgba(99,102,241,.30);
    --wave-line:rgba(255,255,255,.09);
    --wave-line-2:rgba(255,255,255,.06);
    --glass:rgba(255,255,255,.055);
    --glass-chip:rgba(255,255,255,.055);
    --glass-sel:rgba(255,255,255,.16);
    --glass-hover:rgba(255,255,255,.11);
    --glass-edge:rgba(255,255,255,.22);
    --glass-hi:rgba(255,255,255,.34);
    --glass-lo:rgba(0,0,0,.30);
    --glass-glow:0 10px 40px -14px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.10);
    --glass-thumb:rgba(0,0,0,.45);
    --glass-textsh:rgba(0,0,0,.55);
  }
}

@media (max-width:1080px){
  .home .hero-in{grid-template-columns:1fr;gap:52px}
  .home .hero .lede{max-width:none}
  .home .preview{max-width:600px}
  .home .float{display:none}
  .home .flow{grid-template-columns:1fr;gap:36px}
  .home .diagram{position:static;top:auto}
}
@media (max-width:860px){
  .home .nav-in{gap:14px;height:60px}
  .home .nav-links{gap:0;margin-left:auto}
  .home .nav-links a{padding:7px 9px;font-size:13px}
  .home .nav .btn{margin-left:0;padding:7px 11px;font-size:12.5px}
  .home .nav-full{display:none}
  .home .nav-short{display:inline}
  .home .sec{padding:70px 0}
  .home .sec-head{margin-bottom:40px}
  .home h2.title{font-size:29px}
  .home .bento{grid-template-columns:repeat(4,1fr)}
  .home .tile,.home .tile.wide{grid-column:span 4}
  .home .band-in{grid-template-columns:repeat(2,1fr)}
  .home .band .cell:nth-child(3){border-left:none}
  .home .band .cell:nth-child(n+3){border-top:1px solid var(--line)}
}
@media (max-width:640px){
  .home .wrap{padding:0 18px}
  .home .nav-in{gap:10px;height:58px}
  .home .brand{gap:8px;font-size:14px}
  .home .brand small{display:none}
  .home .logo{width:29px;height:29px;border-radius:9px}
  .home .logo svg{width:16px;height:16px}
  .home .nav-links{gap:0}
  .home .nav-links a{padding:6px 8px;font-size:12.5px}
  .home .nav .btn{padding:6px 9px;font-size:12px}
  .home .nav .btn svg{width:13px;height:13px}
  .home .hero{padding:56px 0 68px}
  .home .hero h1{font-size:35px}
  .home .sec-head{margin-bottom:34px}
  .home h2.title{font-size:24px}
  .home .final{padding:74px 0}
  .home .final h2{font-size:26px}
  .home .cta .btn{width:100%}
  .home .split{grid-template-columns:1fr}
  .home .paths{grid-template-columns:1fr}
  .home .win-url{display:none}

  .home .win-body{padding:14px}
  .home .win-chips{gap:6px;margin-bottom:12px}
  .home .chip{font-size:11px;padding:6px 9px;gap:5px}
  .home .chats{gap:11px}
  .home .bubble{font-size:12px;padding:8px 11px;line-height:1.6}
  .home .who{font-size:10px;margin-bottom:4px}
  .home .av{width:26px;height:26px;border-radius:8px;font-size:11px}
  .home .av.bot svg{width:14px;height:14px}
  .home .metrics{grid-template-columns:repeat(3,1fr);gap:6px;margin-top:13px}
  .home .metric{padding:8px 4px;border-radius:9px}
  .home .metric b{font-size:14px}
  .home .metric span{font-size:9px;margin-top:2px}

  .home .band .cell{padding:22px 6px}
}
`;
