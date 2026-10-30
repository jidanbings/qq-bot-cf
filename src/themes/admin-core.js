
export const ADMIN_JS = `
/* ============================== 基础工具 ============================== */
function esc(v){
  return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function $(id){return document.getElementById(id);}

var IX={
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7.5" x2="12" y2="13"/><circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none"/></svg>',
  dot:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.6" r="0.9" fill="currentColor" stroke="none"/></svg>',
  bot:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="3"/><path d="M12 2a3.5 3.5 0 0 1 3.5 3.5V8h-7V5.5A3.5 3.5 0 0 1 12 2z"/><circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
  key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12 20 3"/><path d="M16.5 6.5 19 9"/></svg>',
  gauge:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 18a9 9 0 1 1 17 0"/><line x1="12" y1="14" x2="16.5" y2="9.5"/></svg>',
  chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>',
  groups:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  system:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  filter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 4 21 10 15 10"/><path d="M20.5 14a8.5 8.5 0 1 1-2-8.9L21 8"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>',
  stop:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>'
};

/**
 * 右下角提示。kind 为 'ok' 时整条绿色，'bad' 时整条红色，不传就是中性蓝色。
 * 悬停会暂停倒计时，点一下可以立刻关掉；最多同时留 4 条，多了挤掉最旧的。
 */
function toast(text,kind){
  var box=$('toast');
  if(!box)return;
  var el=document.createElement('div');
  el.className='toast'+(kind?' '+kind:'');
  el.innerHTML=(kind==='ok'?IX.check:(kind==='bad'?IX.alert:IX.info))+'<span>'+esc(text)+'</span>';
  el.title='点击关闭';
  box.appendChild(el);

  var alive=box.querySelectorAll('.toast');
  if(alive.length>4)box.removeChild(alive[0]);

  var life=kind==='bad'?5200:3200;
  var left=life;
  var tick=null;
  var gone=false;
  function close(){
    if(gone)return;
    gone=true;
    if(tick)clearInterval(tick);
    el.style.transition='opacity .2s ease,transform .2s ease';
    el.style.opacity='0';
    el.style.transform='translateY(8px)';
    setTimeout(function(){ if(el.parentNode)el.parentNode.removeChild(el); },220);
  }
  // 失败信息通常更长，也停留得更久；鼠标移上去就暂停，方便读完或复制
  el.addEventListener('mouseenter',function(){ if(tick)clearInterval(tick); tick=null; });
  el.addEventListener('mouseleave',function(){ if(!gone)start(); });
  el.addEventListener('click',close);
  function start(){
    if(tick)clearInterval(tick);
    tick=setInterval(function(){
      left-=100;
      if(left<=0)close();
    },100);
  }
  start();
}

function api(method,path,body){
  var opt={method:method,headers:{'Accept':'application/json'},credentials:'same-origin'};
  if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body);}
  return fetch(path,opt).then(function(r){
    return r.text().then(function(text){
      var data=null;
      try{data=JSON.parse(text);}catch(e){}
      if(r.status===401&&path.indexOf('/api/auth/')!==0){location.replace('/login');return null;}
      if(!r.ok||!data||data.ok!==true){
        var msg=(data&&data.error&&data.error.message)||('请求失败 HTTP '+r.status);
        throw new Error(msg);
      }
      return data.data;
    });
  });
}

/* ------------------------------ 时间格式 ------------------------------ */
function pad2(n){return (n<10?'0':'')+n;}
function fmtClock(ts){
  if(!ts)return '—';
  var d=new Date(ts);
  if(isNaN(d.getTime()))return '—';
  return pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+' '+pad2(d.getHours())+':'+pad2(d.getMinutes());
}
function fmtDur(ms){
  if(ms==null||!isFinite(ms)||ms<=0)return '—';
  var t=Math.round(ms/1000);
  var d=Math.floor(t/86400),h=Math.floor(t%86400/3600),m=Math.floor(t%3600/60),s=t%60;
  if(d)return d+' 天 '+h+' 小时';
  if(h)return h+' 小时 '+m+' 分';
  if(m)return m+' 分 '+(s?s+' 秒':'');
  return s+' 秒';
}
function ago(ms){
  if(!ms)return '—';
  var diff=Date.now()-ms;
  if(diff<0)return '刚刚';
  return fmtDur(diff)+'前';
}
/** 记录里的时间戳是 UTC（D1 里存的是 ISO），后台按本地时间显示 */
function fmtEntryTime(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime()))return String(iso||'').replace('T',' ').slice(0,19);
  return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+' '+pad2(d.getHours())+':'+pad2(d.getMinutes());
}

/* ============================== 外壳联动 ============================== */
var META={
  status:{title:'运行状态',crumb:'概览 / 运行状态'},
  config:{title:'机器人配置',crumb:'设置 / 机器人配置'},
  ai:{title:'AI 对话',crumb:'设置 / AI 对话'},
  imagegen:{title:'生图模型',crumb:'设置 / 生图模型'},
  groups:{title:'群管理',crumb:'管理 / 群管理'},
  logs:{title:'聊天记录',crumb:'数据 / 聊天记录'},
  workspace:{title:'工作区',crumb:'管理 / 工作区'}
};
var currentTab='status';

function setActive(tab){
  var links=document.querySelectorAll('.tabs a');
  for(var i=0;i<links.length;i++){
    links[i].classList.toggle('active',links[i].getAttribute('data-tab')===tab);
  }
  var meta=META[tab]||META.status;
  var crumb=$('crumb-title');
  if(crumb)crumb.textContent=meta.crumb;
  var mt=$('m-title');
  if(mt)mt.textContent=meta.title;
  document.title='QQ Bot 管理后台 · '+meta.title;
}

function setPill(text,kind){
  var pill=$('pill');
  var m=$('m-state');
  var cls='pill-state'+(kind?' '+kind:'');
  var html='<i></i>'+esc(text);
  if(pill){pill.className=cls;pill.innerHTML=html;}
  // 保留 m-state 类名，否则移动端顶栏的 margin-left:auto 会失效（状态会贴在标题后面）
  if(m){m.className=cls+' m-state';m.innerHTML=html;}
}

function setTopActions(html){
  var box=$('top-actions');
  if(box)box.innerHTML=html||'';
}

/* ------------------------------ 外观 ------------------------------ */
function currentTheme(){
  var t='light';
  try{ t=localStorage.getItem('botAdminTheme')==='dark'?'dark':'light'; }catch(e){}
  return t;
}
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  var label=$('side-theme');
  if(label)label.textContent=(t==='dark'?'深色外观':'浅色外观');
  var btn=$('theme-toggle');
  if(btn)btn.setAttribute('aria-pressed',t==='dark'?'true':'false');
}
function toggleTheme(){
  var next=currentTheme()==='dark'?'light':'dark';
  try{ localStorage.setItem('botAdminTheme',next); }catch(e){}
  applyTheme(next);
}

/* ============================== 运行状态 ============================== */
var WS_STATE={0:'连接中',1:'已连接',2:'关闭中',3:'已关闭'};
var statusTimer=null;
var autoRefresh=true;
try{ autoRefresh=localStorage.getItem('botAutoRefresh')!=='0'; }catch(e){}

var S={};             // 最近一次状态数据
var rendered=false;   // 状态页是否已经渲染过骨架
var TRANSPORT_MODE='';// 配置页里显式保存的事件接收方式（webhook / ws，空=自动）
var CUR_APPID='';     // 配置页里当前的 QQ AppID，用来拼开放平台跳转链接
var CUR_WEBHOOK_VERIFIED=false; // 平台是否校验过回调地址（决定自动模式实际走哪条）
var CUR_LAST_EVENT_AT=0;       // 最近一次从 /event 收到真实推送的时间（平台已走 Webhook 的硬证据）
var CUR_PLATFORM_MODE='';      // 平台当前推送方式（'ws' / 'webhook'），由 DO 判定后回传

function stateOf(s){
  if(!s)return {text:'读取中',kind:''};
  if(s.fatalStop)return {text:'已停机',kind:'bad'};
  if(s.quotaWaitUntil&&s.quotaWaitUntil>Date.now())return {text:'配额等待中',kind:'warn'};
  if(s.running)return {text:'运行中',kind:'ok'};
  return {text:'已停止',kind:'bad'};
}

function banners(s){
  var now=Date.now(),out=[];
  var isWs=s.transport!=='webhook';
  if(s.fatalStop)out.push(['bad','已停机',s.fatalStop+'　先去 QQ 开放平台处理，再点「启动」重新尝试。']);
  if(s.quotaWaitUntil&&s.quotaWaitUntil>now){
    out.push(['warn','会话配额已用尽',
      '预计 '+fmtClock(s.quotaWaitUntil)+' 恢复（还有 '+fmtDur(s.quotaWaitUntil-now)+'）。已经停止无效重连，到点会自动起来，不需要手动操作。']);
  }
  if(!s.qqReady)out.push(['bad','QQ 凭据不完整','缺少 AppID 或 Secret。到「机器人配置」填好并保存，机器人才能连上网关。']);
  else if(!s.aiReady)out.push(['bad','AI 未配置完整','Base URL / API Key / 模型三者缺一，机器人收到了消息也回不出来。到「机器人配置」补全后保存并重启。']);
  if(isWs&&s.running&&!s.tokenExpiry)out.push(['bad','Access Token 未获取','到「机器人配置」确认 AppID / Secret 与开放平台一致。']);
  else if(isWs&&(s.identifyFailures||0)>=5&&!(s.quotaWaitUntil&&s.quotaWaitUntil>now)){
    out.push(['warn','连续鉴权失败 '+s.identifyFailures+' 次',
      '网关持续拒绝 IDENTIFY（op9）。机器人还没上线时，到「机器人配置」把「沙箱环境」打开再试。']);
  }
  if(!s.running&&!out.length)out.push(['info',isWs?'机器人已停止':'机器人已停用',
    isWs?'点下面「启动」恢复运行。自动保活'+(s.desiredRunning?'仍在等待':'已关闭')+'。'
        :'点下面「启动」恢复接收消息。']);
  // 切到 Webhook 后如果一直收不到事件，说明域名不通 / 回调地址配错，得明确提示
  if(!isWs&&s.desiredRunning&&!s.lastEventAt){
    out.push(['warn','Webhook 还没收到过任何事件',
      '已切到 Webhook 但一次事件都没进来。确认 QQ 开放平台的回调地址是 '+(location.origin||'你的域名')+'/qq/webhook，且该域名能从公网访问。收不到消息时可临时改回「WebSocket 网关长连接」。']);
  }
  var h='';
  for(var i=0;i<out.length;i++){
    var k=out[i][0];
    h+='<div class="banner '+k+'"><span class="b-ico">'+(k==='bad'||k==='warn'?IX.alert:IX.info)+'</span>'
      +'<span class="b-text"><strong>'+esc(out[i][1])+'</strong>'+esc(out[i][2])+'</span></div>';
  }
  return h;
}

function statCard(id,icon,label,value,cls,sub){
  return '<div class="stat" id="'+id+'">'
    +'<span class="stat-ico">'+icon+'</span>'
    +'<span class="stat-label">'+esc(label)+'</span>'
    +'<span class="stat-value '+(cls||'')+'">'+value+'</span>'
    +'<span class="stat-sub">'+(sub||'')+'</span></div>';
}

function logsHtml(logs){
  if(!logs||!logs.length)return '<p class="muted">暂时没有日志。</p>';
  var h='';
  for(var i=0;i<logs.length;i++){
    var it=logs[i];
    var lv=String(it.level||'info').toLowerCase();
    var t=String(it.time||'');
    var sp=t.indexOf(' ');
    var tsHtml=sp>0?('<i>'+esc(t.slice(0,sp))+'</i>'+esc(t.slice(sp+1))):esc(t);
    h+='<div class="logline '+(lv==='error'?'error':(lv==='warn'?'warn':''))+'">'
      +'<span class="ts">'+tsHtml+'</span>'
      +'<span class="lv">'+esc(lv)+'</span>'
      +'<span>'+esc(it.text||'')+'</span></div>';
  }
  return h;
}

function skField(wide){
  return '<div class="sk-field'+(wide?' wide':'')+'">'
    +'<span class="sk-bar sk-w25"></span><span class="sk-input"></span></div>';
}

function skeletonConfig(){
  var counts=[3,3,2];
  var h='';
  for(var s=0;s<counts.length;s++){
    h+='<div class="card"><div class="sk-head"><span class="sk-block sk-ico"></span>'
      +'<div class="sk-head-txt"><span class="sk-bar sk-w25"></span><span class="sk-bar sk-w40"></span></div></div>'
      +'<div class="sk-row">';
    for(var i=0;i<counts[s];i++)h+=skField(i===0);
    h+='</div></div>';
  }
  return h;
}

function skeletonAi(){
  var h='<div class="card"><div class="sk-head"><span class="sk-block sk-ico"></span>'
    +'<div class="sk-head-txt"><span class="sk-bar sk-w20"></span><span class="sk-bar sk-w35"></span></div></div>';
  for(var i=0;i<2;i++){
    h+='<div class="prov"><div class="prov-head"><span class="sk-block sk-no"></span>'
      +'<span class="sk-bar sk-w20"></span></div><div class="sk-row">'
      +skField(true)+skField(false)+skField(false)+'</div></div>';
  }
  h+='</div>';
  return h;
}

function skeletonLogs(){
  var h='<div class="card">';
  for(var i=0;i<5;i++){
    h+='<div class="entry"><div class="entry-head">'
      +'<span class="sk-bar sk-w15"></span><span class="sk-bar sk-w25"></span><span class="sk-bar sk-w10"></span>'
      +'</div><div class="entry-body"><div class="sk-field">'
      +'<span class="sk-bar sk-w90"></span><span class="sk-bar sk-w70"></span>'
      +'</div></div></div>';
  }
  return h+'</div>';
}

function skDetailRows(n){
  var h='';
  for(var i=0;i<n;i++){
    h+='<dt><span class="sk-bar sk-w50"></span></dt>'
      +'<dd><span class="sk-bar '+(i%2?'sk-w40':'sk-w60')+'"></span></dd>';
  }
  return h;
}

function skLogLines(n){
  var h='';
  for(var i=0;i<n;i++){
    h+='<div class="sk-field"><span class="sk-bar '+(i%2?'sk-w80':'sk-w90')+'"></span></div>';
  }
  return h;
}

function statusSkeleton(){
  var h='<div id="banners"></div>';
  h+='<div class="stats">';
  h+=statCard('stat-bot',IX.bot,'机器人','<span class="sk-bar sk-w60"></span>','','');
  h+=statCard('stat-ws',IX.link,'事件接收','<span class="sk-bar sk-w50"></span>','','');
  h+=statCard('stat-token',IX.key,'Access Token','<span class="sk-bar sk-w70"></span>','','');
  h+=statCard('stat-quota',IX.gauge,'会话配额（24h）','<span class="sk-bar sk-w60"></span>','','');
  h+='</div>';

  h+='<div class="card"><div class="card-head"><h3>控制</h3><span class="hint" id="start-hint"></span></div>'
    +'<div class="btn-row">'
    +'<button class="btn success" id="b-start" type="button">'+IX.play+'<span>启动机器人</span></button>'
    +'<button class="btn danger" id="b-stop" type="button">'+IX.stop+'<span>停止</span></button>'
    +'<button class="btn" id="b-restart" type="button">'+IX.refresh+'<span>重启</span></button>'
    +'<button class="btn" id="b-switch" type="button">'+IX.arrow+'<span>立即切换版本</span></button>'
    +'<button class="btn ghost" id="b-rl" type="button">'+IX.shield+'<span>重置本机限流</span></button>'
    +'</div>'
    +'<p class="btn-hint">启动 / 停止立即生效；重启会先断开再重连，用来套用新配置。'
    +'<b>立即切换版本</b>用于部署新版本后强制让旧实例退出、新代码立刻接管（有人一直在用、DO 不会自动卸载时用这个）。'
    +'重置限流只清掉本机（当前 IP）的登录与接口计数，不影响 QQ 那边的配额。</p></div>';

  h+='<div class="card"><div class="card-head"><h3>连接详情</h3><span class="hint" id="detail-hint"></span></div>'
    +'<dl class="dl" id="details">'
    +skDetailRows(6)
    +'</dl>'
    +'<div class="do-list" id="dos"></div>'
    +'<p class="tip"><b>会话配额统计的是登录网关的次数</b>，不是聊天条数：长连接在线、心跳、收发消息都不消耗；只有新建会话（IDENTIFY）才 +1，断线重连走 RESUME 不消耗。'
    +'<b>Webhook 模式不登录网关</b>，因此不消耗会话配额，也不会因为配额耗尽或断线而掉线恢复。</p></div>';

  h+='<div class="card"><div class="card-head"><h3>运行日志</h3><span class="hint">最近 30 条 · 本地时间</span></div>'
    +'<div class="console"><div class="console-bar"><span class="live"></span><span>live</span><span class="grow"></span>'
    +'<button class="btn sm" id="b-copy-log" type="button">复制</button>'
    +'<button class="btn sm" id="b-auto" type="button">自动刷新：开</button>'
    +'<button class="btn sm" id="b-refresh" type="button">'+IX.refresh+'<span>刷新</span></button></div>'
    +'<div class="console-body" id="logbody">'
    +skLogLines(5)
    +'</div></div></div>';

  h+='<div id="last-error"></div>';
  return h;
}

function paintStatus(s){
  if(!rendered)return;
  var now=Date.now();
  var st=stateOf(s);
  setPill(st.text,st.kind);
  var nav=$('nav-state');
  if(nav)nav.textContent=st.text;

  var b=$('banners');
  if(b)b.innerHTML=banners(s);

  var isWs=s.transport!=='webhook';
  var ws=isWs
    ?(s.wsState==null?'未连接':(WS_STATE[s.wsState]||String(s.wsState)))
    :(s.desiredRunning?'接收中':'已关闭');
  var lim=s.sessionLimit;
  var left=lim?(Number(lim.remaining)||0):null;
  var total=lim?(Number(lim.total)||0):null;
  var waiting=!!(s.quotaWaitUntil&&s.quotaWaitUntil>now);

  var el=$('stat-bot');
  if(el){
    el.querySelector('.stat-value').innerHTML=(s.running
      ?'<i class="dot ok"></i>'+(isWs?'运行中':'已启用')
      :'<i class="dot bad"></i>'+(isWs?'已停止':'已停用'));
    el.querySelector('.stat-value').className='stat-value '+(s.running?'ok':'bad');
    // Webhook 模式没有常驻连接，说「自动保活」会误导，改成「接收开关」
    el.querySelector('.stat-sub').textContent=(isWs?'自动保活':'接收开关')+(s.desiredRunning?'已开启':'已关闭')
      +(s.lastStartAt?' · 启动于 '+fmtClock(s.lastStartAt):'');
  }
  el=$('stat-ws');
  if(el){
    el.querySelector('.stat-value').innerHTML=esc(ws);
    el.querySelector('.stat-value').className='stat-value '+((isWs?(s.wsState===1):s.desiredRunning)?'ok':'');
    el.querySelector('.stat-sub').textContent=(isWs
        ?((s.sessionId?'会话已建立':'会话未建立')+' · 内存会话 '+esc(s.sessionCount==null?0:s.sessionCount)+' 个')
        :('Webhook 接收 · 内存会话 '+esc(s.sessionCount==null?0:s.sessionCount)+' 个'));
  }
  el=$('stat-token');
  if(el){
    var tokCls=s.tokenValid?'ok':(s.tokenExpiry?'bad':'');
    var tokTxt=s.tokenValid?'有效':(s.tokenExpiry?'已过期':'未获取');
    el.querySelector('.stat-value').innerHTML=esc(tokTxt);
    el.querySelector('.stat-value').className='stat-value '+tokCls;
    el.querySelector('.stat-sub').textContent=s.tokenExpiry
      ?(s.tokenValid?('过期时间 '+fmtClock(s.tokenExpiry)+'（'+fmtDur(s.tokenExpiry-now)+'）· 到期自动换新')
                   :'已到期 · 下次收发消息或重连时自动换新')
      :'还没取到凭证';
  }
  el=$('stat-quota');
  if(el){
    var qCls=left==null?'':(left<=0?'bad':(left<100?'warn':'ok'));
    el.querySelector('.stat-value').innerHTML=left==null?'未知':(esc(left)+(total?' <span>/ '+esc(total)+'</span>':''));
    el.querySelector('.stat-value').className='stat-value '+qCls;
    el.querySelector('.stat-sub').textContent=waiting
      ?('等待恢复至 '+fmtClock(s.quotaWaitUntil)+'（'+fmtDur(s.quotaWaitUntil-now)+'）')
      :(lim?('重置还有 '+fmtDur(Number(lim.reset_after))):'尚未取得配额信息');
  }

  var hint=$('start-hint');
  if(hint)hint.textContent=isWs
    ?(s.desiredRunning?'自动保活已开启，断了会自己重连':'自动保活已关闭')
    :(s.desiredRunning?'接收开关已开启，有消息就会处理':'接收开关已关闭，收到消息也不会处理');

  var d=$('details');
  if(d){
    var wv=s.workerVersion||'';
    var dv=s.version||'';
    var sameVer=!!(wv&&dv&&wv===dv);
    var verTxt=(s.sandbox?'沙箱环境':'正式环境')+' · Worker '+(wv?'v'+wv:'未上报')+' / DO '+(dv?'v'+dv:'未上报');
    if(!sameVer&&wv&&dv)verTxt+='（点「立即切换版本」可马上生效）';

    // 会话/配额/关闭码这些是长连接特有的；Webhook 模式没有连接，
    // 回调验证与最近事件则是 Webhook 特有的 —— 各显示各的，互不干扰
    var rows=[['运行环境与版本',verTxt,sameVer?'ok':'warn'],
      ['事件接收方式',isWs?'WebSocket 网关长连接（DO 常驻计费）':'Webhook（请求驱动，空闲不计持续时间）',isWs?'warn':'ok']];

    if(isWs){
      rows.push(['会话 ID',s.sessionId||'尚未建立（还没成功登录过）','']);
    }else{
      rows.push(['回调地址验证',(function(){
        if(!s.webhookVerifiedAt)return '尚未验证（去 QQ 开放平台填 '+location.origin+'/qq/webhook）';
        return '已通过 · '+fmtClock(s.webhookVerifiedAt);
      })(),s.webhookVerifiedAt?'ok':'warn']);
      rows.push(['最近收到事件',s.lastEventAt?(fmtClock(s.lastEventAt)+'（'+fmtDur(now-s.lastEventAt)+'前）'):'还没有收到过',s.lastEventAt?'ok':'warn']);
    }

    rows.push(['API 域名',s.apiBase||'—','']);
    rows.push(['活跃模型',s.aiModel||'未选择',s.aiModel?'ok':'bad']);

    if(isWs){
      rows.push(['并发上限',lim&&lim.max_concurrency?('每 5 秒 '+lim.max_concurrency+' 个会话'):'—','']);
      rows.push(['配额等待至',waiting?(fmtClock(s.quotaWaitUntil)+'（还有 '+fmtDur(s.quotaWaitUntil-now)+'）'):'无',waiting?'warn':'']);
      rows.push(['连续鉴权失败',(s.identifyFailures||0)+' 次',(s.identifyFailures||0)>=5?'bad':'']);
    }

    // 最后关闭码与停机原因合并成一行：两者都是「上次为什么停的」，分开看反而割裂
    (function(){
      var closeTxt=s.lastClose?('code='+s.lastClose.code+(s.lastClose.meaning?'　'+s.lastClose.meaning:'')+(s.lastClose.reason?'　'+s.lastClose.reason:'')+(s.lastClose.at?'　('+fmtClock(s.lastClose.at)+')':'')):'';
      var parts=[];
      if(s.fatalStop)parts.push('停机：'+s.fatalStop);
      if(closeTxt)parts.push('关闭：'+closeTxt);
      rows.push(['最后关闭 / 停机',parts.length?parts.join('　·　'):'无',(s.fatalStop||s.lastClose)?'bad':'']);
    })();
    var dh='';
    for(var i=0;i<rows.length;i++){
      dh+='<dt>'+esc(rows[i][0])+'</dt><dd class="'+rows[i][2]+'">'+esc(rows[i][1])+'</dd>';
    }
    d.innerHTML=dh;
    var dbox=$('dos');
    if(dbox){
      var ds=s.dos||[];
      var dh2='<div class="do-title">耐用对象（Durable Objects）</div>';
      for(var k=0;k<ds.length;k++){
        var it=ds[k];
        var inst=it.instances==null?'按需':(it.instances+' 个');
        dh2+='<div class="do-row"><b>'+esc(it.name)+'</b><span class="do-meta">'+esc(it.cls)+' · '+esc(it.unit)+' · '+inst+' · '+esc(it.note||'')+'</span>'
          +'<span class="do-state '+(it.ok?'ok':'warn')+'">'+esc(it.state)+'</span></div>';
      }
      dbox.innerHTML=ds.length?dh2:'';
    }
  }
  var dHint=$('detail-hint');
  if(dHint)dHint.textContent='更新于 '+fmtClock(now);

  var lb=$('logbody');
  if(lb){
    var atBottom=(lb.scrollHeight-lb.scrollTop-lb.clientHeight)<30;
    lb.innerHTML=logsHtml(s.logs);
    if(atBottom)lb.scrollTop=lb.scrollHeight;
  }

  var lasterr=$('last-error');
  if(lasterr){
    lasterr.innerHTML=s.lastError
      ?'<div class="card"><div class="card-head"><h3>最后错误</h3></div><p class="error-text">'+esc(s.lastError)+'</p></div>'
      :'';
  }

  var auto=$('b-auto');
  if(auto)auto.textContent='自动刷新：'+(autoRefresh?'开':'关');
  document.body.classList.toggle('outage',!s.running);
}

function stopStatusTimer(){
  if(statusTimer){clearInterval(statusTimer);statusTimer=null;}
}
function startStatusTimer(){
  stopStatusTimer();
  if(!autoRefresh)return;
  statusTimer=setInterval(function(){
    if(currentTab==='status'&&rendered)refreshStatus(true);
  },15000);
}

function bindStatusEvents(){
  var bind=function(id,fn){
    var el=$(id);
    if(el)el.addEventListener('click',fn);
  };
  bind('b-start',function(){botAction('start','机器人已启动');});
  bind('b-stop',function(){botAction('stop','机器人已停止');});
  bind('b-restart',function(){botAction('restart','机器人已重启');});
  bind('b-switch',switchVersion);
  bind('b-rl',resetLimits);
  bind('b-refresh',function(){refreshStatus(false);});
  bind('b-auto',function(){
    autoRefresh=!autoRefresh;
    try{localStorage.setItem('botAutoRefresh',autoRefresh?'1':'0');}catch(e){}
    var el=$('b-auto');
    if(el)el.textContent='自动刷新：'+(autoRefresh?'开':'关');
    if(autoRefresh)startStatusTimer();else stopStatusTimer();
    toast('自动刷新已'+(autoRefresh?'开启，每 15 秒更新一次':'关闭'),'ok');
  });
  bind('b-copy-log',function(){
    var lines=[];
    for(var i=0;i<(S.logs||[]).length;i++){
      var it=S.logs[i];
      lines.push('['+it.time+'] ['+String(it.level||'').toUpperCase()+'] '+it.text);
    }
    var text=lines.join(String.fromCharCode(10));
    var done=function(){toast('日志已复制到剪贴板','ok');};
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(function(){toast('复制失败，请手动选中','bad');});
    }else{
      toast('当前浏览器不支持一键复制','bad');
    }
  });
}

function refreshStatus(silent){
  if(!silent&&!rendered)return showStatus();
  return api('GET','/api/status').then(function(s){
    if(!s)return;
    if(!rendered)return showStatus();
    S=s;
    paintStatus(s);
  }).catch(function(e){
    if(!silent)toast(e.message,'bad');
  });
}

function showStatus(){
  stopStatusTimer();
  setActive('status');
  setTopActions('');
  var wrap=$('wrap');
  wrap.innerHTML=statusSkeleton();
  rendered=true;
  bindStatusEvents();
  setPill('正在读取状态…','');
  return api('GET','/api/status').then(function(s){
    if(!s)return;
    S=s;
    paintStatus(s);
    startStatusTimer();
  }).catch(function(e){
    rendered=false;
    wrap.innerHTML='<div class="card"><div class="card-head"><h3>状态读取失败</h3></div>'
      +'<p class="error-text">'+esc(e.message)+'</p>'
      +'<div class="btn-row mt"><button class="btn" id="b-retry" type="button">'+IX.refresh+'<span>重试</span></button></div></div>';
    var r=$('b-retry');
    if(r)r.addEventListener('click',showStatus);
    setPill('读取失败','bad');
  });
}

function busy(btn,on){
  if(!btn)return;
  btn.disabled=!!on;
  btn.classList.toggle('loading',!!on);
}

function botAction(action,doneText){
  var btn=$(action==='start'?'b-start':(action==='stop'?'b-stop':'b-restart'));
  busy(btn,true);
  return api('POST','/api/bot/'+action,{}).then(function(){
    toast(doneText,'ok');
    return refreshStatus(false);
  }).catch(function(e){
    toast(e.message,'bad');
  }).then(function(){
    busy(btn,false);
  });
}

function switchVersion(){
  var btn=$('b-switch');
  busy(btn,true);
  return api('POST','/api/bot/switch',{}).then(function(d){
    if(d&&d.switched){
      toast('已切换到 v'+(d.to||'?')+'，旧实例正在退出','ok');
    }else{
      toast('当前已是 v'+((d&&d.version)||'?')+'，无需切换','ok');
    }
    return refreshStatus(false);
  }).catch(function(e){
    toast(e.message,'bad');
  }).then(function(){
    busy(btn,false);
  });
}

function resetLimits(){
  var btn=$('b-rl');
  busy(btn,true);
  return api('POST','/api/ratelimit/reset',{}).then(function(){
    toast('已重置本机限流记录','ok');
  }).catch(function(e){toast(e.message,'bad');}).then(function(){busy(btn,false);});
}

/* ============================== 机器人配置 ============================== */

/** QQ 开放平台「开发设置」页，AppID 从配置里动态拼，不写死 */
function qqDevSettingsUrl(appId){
  var id=String(appId||'').replace(/[^0-9]/g,'');
  return 'https://q.qq.com/qqbot/dashboard/manage/'+id+'?sec=dev-settings';
}

/**
 * 事件接收方式：跟随 QQ 开放平台，主路径自动同步，另给一个「重新检测」兜底。
 *
 * 为什么不能只靠自动：
 *   - 平台切到 Webhook → 能自动发现（收到 /event 推送就是硬证据）
 *   - 平台切回 WebSocket → **自动发现不了**：Webhook 模式下本对象根本不连网关，
 *     收不到任何 WS 事件，没有任何信号可依。所以必须给一个手动触发的入口。
 *
 * 判定用显式的双向 platformMode（而不是「有过 webhook 痕迹就一直当 webhook」）。
 */
function transportCards(){
  var isWebhook=(CUR_PLATFORM_MODE==='webhook')||(CUR_PLATFORM_MODE!=='ws'&&!!(CUR_WEBHOOK_VERIFIED||CUR_LAST_EVENT_AT));
  var appId=CUR_APPID||'';
  var webhookUrl=(location.origin||'')+'/qq/webhook';
  var devUrl=qqDevSettingsUrl(appId);
  var h='<div class="tp-wrap">';

  var modes=[
    {key:'webhook',name:'Webhook',tag:'当前生效 / 不计持续时间',
     pros:['机器人只在你发消息时才醒，空闲不产生 GB-s','不登录网关，不消耗会话配额','没有长连接，也就没有心跳超时、重连风暴这类问题'],
     cons:['需要在 QQ 开放平台填回调地址，且域名要能被 QQ 访问到','回调地址配错或域名不通就收不到消息（后台会告警提示）']},
    {key:'ws',name:'WebSocket 网关长连接',tag:'当前生效 / 24 小时常驻',
     pros:['不需要公网回调地址，配好 AppID / Secret 就能用','平台侧不支持 Webhook 时可以继续用这个','断线、心跳超时、配额到点都会自动恢复：每 60 秒自检一次，无需人工介入','断线重连走 RESUME：会话与 seq 已落盘，重启后仍能续上，漏掉的事件由网关补发'],
     cons:['Durable Object 必须 24 小时常驻，约 10,800 GB-s/天，占免费额度（13,000/天）的 83%','会话失效（网关判 4006/4007）时才需重新鉴权，每次扣一次当日会话配额']}
  ];

  h+='<div class="tp-banner '+(isWebhook?'ok':'info')+'">'
    +'<b>当前生效：'+(isWebhook?'Webhook':'WebSocket 网关长连接')+'</b>'
    +'<span>'+(isWebhook
        ? '本面板跟随 QQ 开放平台。'+(CUR_LAST_EVENT_AT?'最近收到过推送，说明平台确实在用 Webhook。':'回调地址已校验通过。')
        : '本面板跟随 QQ 开放平台。想让空闲不计费，去平台把事件推送改成 Webhook，这里会自动跟随。')
    +'</span></div>';

  for(var i=0;i<modes.length;i++){
    var m=modes[i];
    var on=(isWebhook?'webhook':'ws')===m.key;
    // 没有 data-tp / tabindex：这里不可点选，只是展示
    h+='<div class="tp-card ro'+(on?' on':'')+'">';
    h+='<div class="tp-head"><span class="tp-radio"><i></i></span>'
      +'<b>'+esc(m.name)+'</b>'
      +(on?'<span class="tp-tag ok">生效中</span>':'<span class="tp-tag dim">未启用</span>')
      +'</div>';
    h+='<ul class="tp-list pros">';
    for(var p=0;p<m.pros.length;p++)h+='<li>'+esc(m.pros[p])+'</li>';
    h+='</ul><ul class="tp-list cons">';
    for(var c=0;c<m.cons.length;c++)h+='<li>'+esc(m.cons[c])+'</li>';
    h+='</ul>';
    if(m.key==='webhook'){
      h+='<div class="tp-extra"><span class="tp-k">回调地址</span>'
        +'<code class="tp-url" id="tp-url">'+esc(webhookUrl)+'</code>'
        +'<button class="btn sm" type="button" id="tp-copy">复制</button></div>';
    }
    h+='</div>';
  }
  h+='</div>';

  // 跳转到 QQ 开放平台：AppID 从后台配置读取，未填则提示先填
  h+='<div class="tp-actions">';
  if(appId){
    h+='<a class="btn primary" href="'+esc(devUrl)+'" target="_blank" rel="noopener noreferrer">'
      +IX.link+'<span>去 QQ 开放平台修改</span></a>';
    // 两个方向都做成显式按钮：网关可连与否证明不了平台在用哪种方式，
    // 所以只能由用户自己声明「我在平台上设成了什么」
    if(isWebhook){
      h+='<button class="btn" id="b-to-ws" type="button">'+IX.refresh+'<span>我在平台改成了 WebSocket</span></button>';
    }else{
      h+='<button class="btn" id="b-to-webhook" type="button">'+IX.refresh+'<span>我在平台改成了 Webhook</span></button>';
    }
    h+='<span class="tp-note">在「开发设置 → 事件订阅」切换推送方式。'
      +'改成 Webhook 会自动同步（收到推送即确认）；改回 WebSocket 后本页收不到任何信号，'
      +'所以请点上面的按钮手动同步。</span>';
  }else{
    h+='<span class="tp-note warn">先在上面填好 <b>QQ AppID</b> 并保存，这里才会出现跳转按钮</span>';
  }
  h+='</div>';
  return h;
}

var FIELDS=[
  {id:'qq',icon:IX.bot,title:'QQ 开放平台',desc:'QQ 机器人开放平台里的应用凭据',items:[
    {key:'appId',label:'QQ AppID',type:'text',ph:'机器人 AppID',required:true},
    {key:'secret',label:'QQ Secret',type:'password',ph:'机器人密钥',secret:true,required:true},
    {key:'sandbox',label:'沙箱环境',type:'select',options:[['0','否（正式环境）'],['1','是（沙箱环境）']],
      hint:'机器人未上线或已下架时只能连沙箱，正式环境会拒绝鉴权（关闭码 4914）'}
  ]},
  {id:'transport',icon:IX.link,title:'事件接收方式',desc:'决定机器人怎么收到 QQ 的消息，直接影响计费',custom:transportCards},
  {id:'behavior',icon:IX.chat,title:'对话行为',desc:'回复方式与上下文长度',items:[
    {key:'systemPrompt',label:'系统提示词',type:'textarea',ph:'你是一个友好、靠谱的 QQ 机器人助手……',wide:true},
    {key:'historyLimit',label:'历史消息条数',type:'select',options:[['1','1 条'],['2','2 条'],['3','3 条'],['4','4 条'],['5','5 条'],['6','6 条'],['7','7 条'],['8','8 条'],['9','9 条'],['10','10 条（推荐）'],['11','11 条'],['12','12 条'],['13','13 条'],['14','14 条'],['15','15 条'],['16','16 条'],['17','17 条'],['18','18 条'],['19','19 条'],['20','20 条'],['21','21 条'],['22','22 条'],['23','23 条'],['24','24 条'],['25','25 条'],['26','26 条'],['27','27 条'],['28','28 条'],['29','29 条'],['30','30 条'],['31','31 条'],['32','32 条'],['33','33 条'],['34','34 条'],['35','35 条'],['36','36 条'],['37','37 条'],['38','38 条'],['39','39 条'],['40','40 条'],['41','41 条'],['42','42 条'],['43','43 条'],['44','44 条'],['45','45 条'],['46','46 条'],['47','47 条'],['48','48 条'],['49','49 条'],['50','50 条']],hint:'每次对话携带的上下文条数（1~50）。越大越记得住，但也更费 token；推荐 10'},
    {key:'markdownReply',label:'Markdown 回复',type:'select',options:[['0','关（纯文本）'],['1','开（标题/列表/加粗等生效）']],
      hint:'AI 回复含标题、列表、加粗、链接时按 Markdown 发送，排版更好；纯文本回复不受影响'},
    {key:'autoRecall',label:'AI 故障自动撤回',type:'select',options:[['0','关'],['1','开']],
      hint:'AI 全部不可用时，自动撤回上一条机器人回复，避免留下「没答上来」的消息'},
    {key:'toolCalling',label:'AI 工具调用',type:'select',options:[['1','开（画图 / 定时提醒 / 查群信息）'],['0','关（纯聊天）']],
      hint:'开启后 AI 可以调用内置工具：生成图片、定时提醒、查本群资料 / 机器人状态 / 禁言状态'},
    {key:'voiceLang',label:'语音语言',type:'select',options:[['zh','中文'],['en','English'],['ja','日本語'],['ko','한국어']],
      hint:'内置 TTS（Cloudflare Workers AI MeloTTS）合成语音时用的语种，不需要额外 Key'},
    {key:'voiceGain',label:'语音音量增益',type:'select',options:[['6','+6dB（推荐）'],['9','+9dB'],['0','关（原始音量）']],
      hint:'只调整 MP3 响度参数（mp3gain 同款做法），不重新编码；调太大可能有削波失真'}
  ]},
  {id:'welcome',icon:IX.bot,title:'入群欢迎',desc:'新成员进群 / 机器人被拉进新群时自动发言',items:[
    {key:'welcomeEnabled',label:'开启欢迎',type:'select',options:[['0','关'],['1','开']],
      hint:'开启后需要订阅群成员事件（1<<24），若平台未开通该事件权限会导致无法连接网关，请先在开放平台确认'},
    {key:'welcomeMsg',label:'欢迎语',type:'textarea',ph:'欢迎新成员～ {member}',wide:true,
      hint:'占位符 {member} 会替换为 @新成员，{group} 会替换为群标识。留空则不发言'}
  ]},
  {id:'filter',icon:IX.filter,title:'过滤',desc:'命中即丢弃，机器人不会回复',items:[
    {key:'groupBlacklist',label:'群黑名单',type:'textarea',ph:'group_openid1, group_openid2',wide:true,hint:'多个用逗号分隔，只对群聊生效'},
    {key:'sensitiveWords',label:'敏感词',type:'textarea',ph:'词1, 词2',wide:true,hint:'多个用逗号分隔，消息里出现任意一个就不会回复'}
  ]}
];

function allKeys(){
  var keys=[];
  for(var s=0;s<FIELDS.length;s++){
    // 自定义区块（事件接收方式）没有 items，值单独从隐藏字段读，这里跳过
    if(FIELDS[s].custom)continue;
    var items=FIELDS[s].items||[];
    for(var i=0;i<items.length;i++)keys.push(items[i].key);
  }
  return keys;
}

function fieldHtml(f,cfg,conf){
  var v=cfg[f.key]==null?'':String(cfg[f.key]);
  var ph=f.ph||'';
  if(f.secret&&conf[f.key])ph='已设置，留空表示不修改';
  var h='<div class="field'+(f.wide?' wide':'')+'">';
  h+='<label for="cf_'+f.key+'">'+esc(f.label)
    +(f.required&&!(f.secret&&conf[f.key])?'<span class="req-flag">必填</span>':'')
    +(f.secret&&conf[f.key]?'<span class="req-flag">已设置</span>':'')+'</label>';
  if(f.type==='textarea'){
    h+='<textarea id="cf_'+f.key+'" placeholder="'+esc(ph)+'" rows="3">'+esc(v)+'</textarea>';
  }else if(f.type==='select'){
    h+='<select id="cf_'+f.key+'">';
    for(var o=0;o<f.options.length;o++){
      var ov=f.options[o][0];
      h+='<option value="'+esc(ov)+'"'+(v===ov?' selected':'')+'>'+esc(f.options[o][1])+'</option>';
    }
    h+='</select>';
  }else if(f.type==='password'){
    // 库里已有值时后端不回传明文，输入框留空并提示「已设置」，
    // 这样不会在框里显示一排假的圆点让人以为可以改。
    var hasSaved=!!(f.secret&&conf[f.key]);
    h+='<div class="pw-wrap"><input id="cf_'+f.key+'" type="password" value="'+esc(hasSaved?'':v)+'" placeholder="'+esc(ph)+'" autocomplete="new-password">'
      +'<button class="pw-toggle" type="button" data-pw="cf_'+f.key+'">显示</button></div>';
  }else{
    h+='<input id="cf_'+f.key+'" type="'+esc(f.type)+'" value="'+esc(v)+'" placeholder="'+esc(ph)+'"'
      +(f.type==='number'?' inputmode="decimal"':'')+'>';
  }
  if(f.hint)h+='<p class="hint">'+esc(f.hint)+'</p>';
  h+='</div>';
  return h;
}

function renderConfig(d){
  var cfg=d.config||{};
  var conf=d.configured||{};
  TRANSPORT_MODE=cfg.transport||'';
  CUR_APPID=cfg.appId||'';
  CUR_WEBHOOK_VERIFIED=!!cfg.webhookVerifiedAt;
  CUR_LAST_EVENT_AT=Number(cfg.lastEventAt)||0;
  CUR_PLATFORM_MODE=cfg.platformMode||'';
  var h='';
  for(var s=0;s<FIELDS.length;s++){
    var sec=FIELDS[s];
    h+='<div class="form-section"><div class="fs-head"><span class="fs-ico">'+sec.icon+'</span>'
      +'<div><h3>'+esc(sec.title)+'</h3><p>'+esc(sec.desc)+'</p></div>'
      +'<span class="fs-state" id="fs-'+sec.id+'"></span></div><div class="fs-body">';
    if(sec.custom){
      // 自定义区块自己负责布局（比如事件接收方式的两张对比卡）
      h+=sec.custom();
    }else{
      h+='<div class="grid">';
      for(var i=0;i<sec.items.length;i++)h+=fieldHtml(sec.items[i],cfg,conf);
      h+='</div>';
    }
    h+='</div></div>';
  }
  // 照 user.html：按钮直接放在表单末尾，没有 sticky 悬浮栏、没有常驻状态文字
  h+='<div class="form-actions">'
    +'<button class="btn" id="b-save" type="button">'+IX.check+'<span>保存配置</span></button>'
    +'<button class="btn primary" id="b-save-restart" type="button">'+IX.refresh+'<span>保存并重启</span></button></div>';
  $('wrap').innerHTML=h;

  $('b-save').addEventListener('click',function(){saveConfig(false);});
  $('b-save-restart').addEventListener('click',function(){saveConfig(true);});

  bindTransportCards();

  var toggles=document.querySelectorAll('.pw-toggle');
  for(var t=0;t<toggles.length;t++){
    toggles[t].addEventListener('click',function(){
      var input=$(this.getAttribute('data-pw'));
      if(!input)return;
      var show=input.type==='password';
      input.type=show?'text':'password';
      this.textContent=show?'隐藏':'显示';
    });
  }

  var inputs=document.querySelectorAll('.field input,.field select,.field textarea');
  for(var k=0;k<inputs.length;k++){
    inputs[k].addEventListener('input',markDirty);
    inputs[k].addEventListener('change',markDirty);
  }
  updateSectionStates();
  setTopActions('');
}

function markDirty(){
  updateSectionStates();
}

/** 事件接收方式：只读展示，只绑定「复制回调地址」与「重新检测」 */
function bindTransportCards(){
  var copy=$('tp-copy');
  if(copy){
    copy.addEventListener('click',function(e){
      e.stopPropagation();
      var url=($('tp-url')||{}).textContent||'';
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(function(){toast('回调地址已复制','ok');})
          .catch(function(){toast('复制失败，请手动选中','bad');});
      }else{
        toast('当前浏览器不支持一键复制','bad');
      }
    });
  }
  // 两个方向各一个显式按钮：只由用户声明，不做自动猜测
  var toWs=$('b-to-ws');
  if(toWs){
    toWs.addEventListener('click',function(){
      busy(toWs,true);
      api('POST','/api/detect-platform',{action:'to-ws'}).then(function(){
        toast('已切到 WebSocket 长连接','ok');
        return api('GET','/api/config').then(function(c){ if(c)renderConfig(c); });
      }).catch(function(e){toast(e.message,'bad');})
        .then(function(){busy(toWs,false);});
    });
  }
  var toWh=$('b-to-webhook');
  if(toWh){
    toWh.addEventListener('click',function(){
      busy(toWh,true);
      api('POST','/api/detect-platform',{action:'to-webhook'}).then(function(){
        toast('已切到 Webhook','ok');
        return api('GET','/api/config').then(function(c){ if(c)renderConfig(c); });
      }).catch(function(e){toast(e.message,'bad');})
        .then(function(){busy(toWh,false);});
    });
  }
}

/** 每个分组的右上角显示「已填写 n/m」，一眼看出还差什么 */
function updateSectionStates(){
  for(var s=0;s<FIELDS.length;s++){
    var sec=FIELDS[s];
    if(sec.custom){
      // 自定义区块：只读展示，始终算「已同步」
      var st=$('fs-'+sec.id);
      if(st){
        st.className='fs-state ok';
        st.innerHTML='<i></i>自动同步';
      }
      continue;
    }
    var total=0,filled=0;
    for(var i=0;i<sec.items.length;i++){
      var f=sec.items[i];
      var el=$('cf_'+f.key);
      if(!el)continue;
      total++;
      var v=String(el.value||'').trim();
      // 敏感字段在库里有值时后端回传空串，但 placeholder 会写「已设置」，按已填写算
      var saved=!!(f.secret&&String(el.getAttribute('placeholder')||'').indexOf('已设置')===0);
      if(v||saved)filled++;
    }
    var state=$('fs-'+sec.id);
    if(!state)continue;
    state.className='fs-state'+(total&&filled>=total?' ok':'');
    state.innerHTML='<i></i>已填写 '+filled+'/'+total;
  }
}

function showConfig(){
  stopStatusTimer();
  rendered=false;
  setActive('config');
  setTopActions('');
  setPill('配置页','');
  $('wrap').innerHTML=skeletonConfig();
  api('GET','/api/config').then(function(d){
    if(!d)return;
    renderConfig(d);
    if(S&&S.running)setPill('运行中','ok');
  }).catch(function(e){
    $('wrap').innerHTML='<div class="card"><div class="card-head"><h3>配置读取失败</h3></div>'
      +'<p class="error-text">'+esc(e.message)+'</p></div>';
    setPill('读取失败','bad');
  });
}

function setSaveMsg(text,kind){
  // 不再有常驻 save-msg 栏，保存状态统一用右下角 toast 提示
  toast(text, kind || '');
}

function saveConfig(restart){
  var keys=allKeys();
  var patch={};
  for(var k=0;k<keys.length;k++){
    var el=$('cf_'+keys[k]);
    if(el)patch[keys[k]]=el.value;
  }
  // 事件接收方式是只读展示，跟随 QQ 平台自动判定，不提交
  var b1=$('b-save'),b2=$('b-save-restart');
  busy(b1,true);
  busy(b2,true);
  api('POST','/api/config',patch).then(function(){
    if(restart){
      return api('POST','/api/bot/restart',{}).then(function(){
        toast('配置已保存，机器人已重启','ok');
        // 用 hash 跳转（而不是直接调 showStatus），让 URL 与页面同步，
        // 否则会出现「内容到了状态页、地址栏还是 #config」的错位。
        setTimeout(function(){ location.hash = '#status'; },900);
      });
    }
    toast('配置已保存','ok');
    return api('GET','/api/config').then(function(d){
      if(d)renderConfig(d);
      toast('配置已保存','ok');
    });
  }).catch(function(e){
    toast(e.message,'bad');
    busy(b1,false);
    busy(b2,false);
  });
}

/* ============================== 聊天记录（QQ 风格会话） ============================== */
var chatState={scope:'',kind:'',items:[],hasMore:false};

function dayKey(d){
  return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
}
function daySepHtml(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime()))return '';
  var now=new Date();
  var label;
  if(dayKey(d)===dayKey(now))label='今天';
  else if(dayKey(d)===dayKey(new Date(now.getTime()-86400000)))label='昨天';
  else label=(d.getMonth()+1)+' 月 '+d.getDate()+' 日';
  return '<div class="day-sep"><span>'+label+' · '+pad2(d.getMonth()+1)+'/'+pad2(d.getDate())+'</span></div>';
}

function pad2s(n){return n<10?('0'+n):String(n);}
function shortTime(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime()))return '';
  var now=new Date();
  if(dayKey(d)===dayKey(now))return pad2s(d.getHours())+':'+pad2s(d.getMinutes());
  return (d.getMonth()+1)+'/'+d.getDate();
}
function fullTime(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime()))return '';
  var now=new Date();
  var hm=pad2s(d.getHours())+':'+pad2s(d.getMinutes())+':'+pad2s(d.getSeconds());
  if(dayKey(d)===dayKey(now))return hm;
  return pad2s(d.getMonth()+1)+'-'+pad2s(d.getDate())+' '+hm;
}
/**
 * 列表里用的绝对时间：始终带「月-日 时:分」。
 * fullTime 对今天的时间只给「22:06:49」，混在「10-26 20:48:49」旁边会让人以为格式错乱；
 * 沙箱/工作区这类列表要的是「这个文件到底什么时候改的」，统一给完整日期更清楚。
 */
function absTime(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime()))return '';
  return pad2s(d.getMonth()+1)+'-'+pad2s(d.getDate())+' '+pad2s(d.getHours())+':'+pad2s(d.getMinutes());
}

function chatShell(){
  return '<div class="chat-wrap" id="chat-wrap">'
    +'<div class="chat-list"><div class="chat-list-head"><b>会话</b><span class="hint" id="chat-count"></span>'
    +'<button class="btn sm" id="chat-refresh" type="button">'+IX.refresh+'</button></div>'
    +'<div class="conv-list" id="conv-list"><p class="muted">加载中…</p></div></div>'
    +'<div class="chat-thread" id="chat-thread">'
    +'<div class="thread-head"><button class="btn sm thread-back" id="chat-back" type="button">'+IX.back+'<span>返回</span></button>'
    +'<b id="thread-title">对话</b><span class="hint" id="thread-meta"></span></div>'
    +'<div class="thread-body" id="thread-body"><div class="thread-empty">选择一个会话，查看你和机器人的完整对话</div></div>'
    +'</div></div>';
}

function convRowHtml(c){
  var kindTxt=c.kind==='c2c'?'私聊':'群聊';
  var prev=c.lastUser?('我：'+c.lastUser):(c.lastReply||'');
  return '<div class="conv" data-scope="'+esc(c.scopeId)+'" data-kind="'+esc(c.kind)+'">'
    +'<span class="conv-av">'+(c.kind==='c2c'?IX.chat:IX.groups)+'</span>'
    +'<div class="conv-main"><div class="conv-name">'+esc(kindTxt)+' #'+esc(c.scopeId)
    +'<span class="hint">'+esc(String(c.count))+' 条</span></div>'
    +'<div class="conv-prev">'+esc(prev||'（无内容）')+'</div></div>'
    +'<span class="conv-time">'+esc(shortTime(c.lastAt))+'</span>'
    +'<button class="conv-del" type="button" data-del="'+esc(c.scopeId)+'" title="删除这个会话">'+IX.trash+'</button></div>';
}

function sysConvRowHtml(s){
  var prev=s&&s.lastText?s.lastText:'配置变更、AI 切换、入群欢迎等系统事件';
  return '<div class="conv conv-sys" data-scope="system" data-kind="system">'
    +'<span class="conv-av sys">'+IX.system+'</span>'
    +'<div class="conv-main"><div class="conv-name">系统消息'
    +(s&&s.count?'<span class="hint">'+esc(String(s.count))+' 条</span>':'')+'</div>'
    +'<div class="conv-prev">'+esc(prev)+'</div></div>'
    +'<span class="conv-time">'+esc(s&&s.lastAt?shortTime(s.lastAt):'')+'</span>'
    +'<button class="conv-del" type="button" data-del="system" title="删除全部系统消息">'+IX.trash+'</button></div>';
}

function loadConversations(){
  var list=$('conv-list');
  if(!list)return Promise.resolve();
  list.innerHTML='<p class="muted">加载中…</p>';
  return api('GET','/api/conversations').then(function(d){
    var items=(d&&d.items)||[];
    var sys=(d&&d.system)||{count:0};
    var total=Number(sys.count)||0;
    for(var i=0;i<items.length;i++)total+=Number(items[i].count)||0;
    var h=sysConvRowHtml(sys);
    for(var k=0;k<items.length;k++)h+=convRowHtml(items[k]);
    list.innerHTML=h;
    var c2=$('chat-count');
    if(c2)c2.textContent=items.length?('共 '+items.length+' 个会话'):'';
    var nav2=$('nav-count');
    if(nav2)nav2.textContent=total>999?'999+':String(total);
    if(chatState.scope){
      var rows=list.querySelectorAll('.conv');
      for(var j=0;j<rows.length;j++)rows[j].classList.toggle('active',rows[j].getAttribute('data-scope')===chatState.scope);
    }
  }).catch(function(e){
    list.innerHTML='<div class="thread-empty">'+esc(e.message)+'</div>';
  });
}

function exchangeHtml(it){
  var h='<div class="msg-group" data-id="'+esc(String(it.id))+'">'
    +'<div class="msg-stamp">'+esc(fullTime(it.time))+'</div>';
  if(it.userContent)h+='<div class="msg-row me"><span class="msg-av">'+IX.user+'</span><div class="msg-bubble">'+esc(it.userContent)+'</div></div>';
  if(it.aiReply){
    h+='<div class="msg-row"><span class="msg-av bot">'+IX.bot+'</span><div class="msg-bubble">'+esc(it.aiReply)+'</div></div>';
    // 这条回复用的模型
    if(it.model)h+='<div class="msg-model">'+esc(it.model)+'</div>';
  }
  return h+'</div>';
}

function systemItemHtml(it){
  return '<div class="msg-group" data-id="'+esc(String(it.id))+'">'
    +'<div class="msg-stamp">'+esc(fullTime(it.time))+'</div>'
    +'<div class="msg-row"><span class="msg-av sys">'+IX.system+'</span><div class="msg-bubble sys">'+esc(it.content)+'</div></div>'
    +'</div>';
}

function renderThread(scrollBottom){
  var body=$('thread-body');
  if(!body)return;
  var items=chatState.items;
  var h='';
  if(chatState.hasMore){
    h+='<button class="btn sm thread-more" id="thread-more" type="button">'+IX.refresh+'<span>加载更早</span></button>';
  }
  var prevDay='';
  for(var i=0;i<items.length;i++){
    var it=items[i];
    var day=(it.time||'').slice(0,10);
    if(day&&day!==prevDay){h+=daySepHtml(it.time);prevDay=day;}
    if(chatState.kind==='system')h+=systemItemHtml(it);
    else h+=exchangeHtml(it);
  }
  body.innerHTML=h;
  if(scrollBottom)body.scrollTop=body.scrollHeight;
}

function bindThreadMore(){
  var more=$('thread-more');
  if(!more)return;
  more.addEventListener('click',function(){
    var oldest=chatState.items[0];
    if(!oldest)return;
    loadThread(chatState.scope,oldest.id);
  });
}

function loadThread(scope,before){
  var body=$('thread-body');
  var first=!before;
  if(first&&body)body.innerHTML='<div class="thread-empty">加载中…</div>';
  var q=scope==='system'
    ? ('/api/system-messages'+(before?('?before='+before):''))
    : ('/api/conversations/messages?scope='+encodeURIComponent(scope)+(before?('&before='+before):''));
  return api('GET',q).then(function(d){
    var items=(d&&d.items)||[];
    chatState.hasMore=!!(d&&d.hasMore);
    if(before){chatState.items=items.concat(chatState.items);}
    else{chatState.items=items;}
    var meta=$('thread-meta');
    if(meta)meta.textContent=chatState.items.length?('已加载 '+chatState.items.length+' 条'):'';
    if(!chatState.items.length){
      var bb=$('thread-body');
      if(bb)bb.innerHTML='<div class="thread-empty">这个会话还没有记录</div>';
      return;
    }
    var oldH=body?body.scrollHeight:0;
    var oldTop=body?body.scrollTop:0;
    renderThread(first);
    if(before&&body)body.scrollTop=body.scrollHeight-oldH+oldTop;
    bindThreadMore();
  }).catch(function(e){
    var bb=$('thread-body');
    if(bb)bb.innerHTML='<div class="thread-empty">'+esc(e.message)+'</div>';
  });
}

function openConversation(scope,kind){
  chatState.scope=scope;
  chatState.kind=kind||'';
  chatState.items=[];
  chatState.hasMore=false;
  var wrap=$('chat-wrap');
  if(wrap)wrap.classList.add('thread-open');
  var list=$('conv-list');
  if(list){
    var rows=list.querySelectorAll('.conv');
    for(var i=0;i<rows.length;i++)rows[i].classList.toggle('active',rows[i].getAttribute('data-scope')===scope);
  }
  var title=$('thread-title');
  if(title)title.textContent=scope==='system'?'系统消息':('会话 #'+scope);
  var meta=$('thread-meta');
  if(meta)meta.textContent='';
  return loadThread(scope,0);
}

function closeChatThread(){
  var wrap=$('chat-wrap');
  if(wrap)wrap.classList.remove('thread-open');
  chatState.scope='';
  chatState.kind='';
  var list=$('conv-list');
  if(list){
    var rows=list.querySelectorAll('.conv');
    for(var i=0;i<rows.length;i++)rows[i].classList.remove('active');
  }
}

function onConvClick(e){
  var delBtn=e.target&&e.target.closest?e.target.closest('.conv-del'):null;
  if(delBtn){
    e.stopPropagation();
    deleteConversation(delBtn.getAttribute('data-del'));
    return;
  }
  var row=e.target&&e.target.closest?e.target.closest('.conv'):null;
  if(!row)return;
  openConversation(row.getAttribute('data-scope'),row.getAttribute('data-kind'));
}

/** 删除整个会话（该会话的全部记录），不是删单条 */
function deleteConversation(scope){
  if(!scope)return;
  var isSys=scope==='system';
  var label=isSys?'全部系统消息':('会话 #'+scope);
  if(!confirm('确定删除'+label+'？该会话的全部聊天记录都会被删除，不可撤销。'))return;
  api('POST','/api/conversations/delete',{scope:scope}).then(function(d){
    toast('已删除 '+((d&&d.deleted)||0)+' 条记录','ok');
    if(chatState.scope===scope){
      chatState.items=[];
      closeChatThread();
      var body=$('thread-body');
      if(body)body.innerHTML='<div class="thread-empty">选择一个会话，查看你和机器人的完整对话</div>';
    }
    loadConversations();
  }).catch(function(err){toast(err.message,'bad');});
}

function showLogs(){
  stopStatusTimer();
  rendered=false;
  setActive('logs');
  setTopActions('');
  setPill('聊天记录','');
  $('wrap').innerHTML=chatShell();
  $('chat-back').addEventListener('click',closeChatThread);
  $('chat-refresh').addEventListener('click',function(){loadConversations();});
  $('conv-list').addEventListener('click',onConvClick);
  loadConversations();
}

/* ============================== AI 对话 ============================== */
var aiState=[];
var aiSeq=0;

function modelOptions(p){
  var ms=p.models||[];
  var cur=p.model||'';
  if(!ms.length){
    return cur?'<option value="'+esc(cur)+'" selected>'+esc(cur)+'</option>'
      :'<option value="">先点「拉取模型」</option>';
  }
  var has=false;
  for(var i=0;i<ms.length;i++)if(ms[i]===cur)has=true;
  var h=(!cur||!has)?'<option value="">请选择模型</option>':'';
  for(var j=0;j<ms.length;j++){
    h+='<option value="'+esc(ms[j])+'"'+(ms[j]===cur?' selected':'')+'>'+esc(ms[j])+'</option>';
  }
  return h;
}

/* ---- 添加/编辑 AI 的弹窗 ---- */
var aiModal={idx:-1,isNew:false,p:null,models:[]};
var aiEscBound=false;

function aiModalHtml(){
  var h='<div class="modal-mask" id="ai-modal-mask" hidden>'
    +'<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ai-m-title">'
    +'<div class="modal-head"><h3 id="ai-m-title">添加 AI</h3>'
    +'<button class="modal-x" type="button" id="ai-modal-x" aria-label="关闭">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label>名称</label><input id="ai-m-name" maxlength="40" placeholder="例如 主账号"></div>'
    +'<div class="field"><label>Base URL</label><input id="ai-m-url" placeholder="https://api.example.com/v1"></div>'
    +'<div class="field"><label>API Key</label><div class="pw-wrap"><input id="ai-m-key" type="password" placeholder="sk-..." autocomplete="new-password">'
    +'<button class="pw-toggle" type="button" id="ai-m-key-toggle">显示</button></div></div>'
    +'<div class="field"><label>模型</label><div class="model-row"><select id="ai-m-model"></select>'
    +'<button class="btn" type="button" id="ai-m-pull">'+IX.refresh+'<span>拉取模型</span></button></div></div>'
    +'<div class="grid">'
    +'<div class="field"><label>Temperature</label><input id="ai-m-temp" type="number" inputmode="decimal" step="0.1" placeholder="0.8"></div>'
    +'<div class="field"><label>启用</label><label class="prov-check"><input type="checkbox" id="ai-m-on" checked>参与回复</label></div>'
    +'<div class="field"><label>识图能力</label><select id="ai-m-vision"><option value="auto">自动判断（按模型名）</option><option value="1">支持识图</option><option value="0">不支持（纯文本）</option></select></div>'
    +'</div>'
    +'<div class="test-result" id="ai-test-result" hidden></div>'
    +'</div>'
    +'<div class="modal-foot">'
    +'<button class="btn" type="button" id="ai-m-test">▶ 测试</button>'
    +'<span class="grow"></span>'
    +'<button class="btn" type="button" id="ai-m-cancel">取消</button>'
    +'<button class="btn primary" type="button" id="ai-m-save">'+IX.check+'<span>保存</span></button>'
    +'</div></div></div>';
  return h;
}

function provRowHtml(p,i){
  var host=(p.baseUrl||'');
  var k=host.indexOf('://');
  if(k>=0)host=host.substring(k+3);
  k=host.indexOf('/');
  if(k>=0)host=host.substring(0,k);
  var keyFlag=p.hasKey?'<span class="prov-keyok">Key 已设置</span>'
    :(p.apiKey?'<span class="prov-keynew">Key 待保存</span>':'<span class="prov-keyno">Key 未设置</span>');
  var h='<div class="prov-row'+(p.enabled?'':' is-off')+'" data-id="'+esc(p.id)+'" title="点击编辑">';
  h+='<span class="prov-no">'+(i+1)+'</span>';
  h+='<div class="prov-info"><b>'+esc(p.name||'未命名')+'</b><small>'+esc(p.model||'未选模型')+(host?' · '+esc(host):'')+'</small></div>';
  var vv=p.vision||'auto';
  var vBadge=vv==='1'?'<span class="prov-vision ok">识图</span>':vv==='0'?'<span class="prov-vision off">仅文本</span>':'<span class="prov-vision">识图·自动</span>';
  h+='<div class="prov-meta">'+vBadge+keyFlag
    +'<label class="prov-switch" title="点一下启用/停用"><input type="checkbox" class="prov-sw"'+(p.enabled?' checked':'')+'><i></i></label>'
    +'</div>';
  h+='<div class="prov-tools">'
    +'<button class="icon-btn" type="button" data-act="up" title="上移">↑</button>'
    +'<button class="icon-btn" type="button" data-act="down" title="下移">↓</button>'
    +'<button class="btn sm" type="button" data-act="edit">编辑</button>'
    +'<button class="btn sm danger" type="button" data-act="del">删除</button>'
    +'</div></div>';
  return h;
}

function openAiModal(idx,preset){
  if(idx<0&&aiState.length>=10){toast('最多 10 个 AI','bad');return;}
  var p;
  if(idx>=0){p=aiState[idx];}
  else{
    p={id:'new-'+(++aiSeq)+'-'+Date.now(),
      name:(preset&&preset.name)||('AI '+(aiState.length+1)),
      baseUrl:(preset&&preset.url)||'',apiKey:'',
      model:(preset&&preset.model)||'',temperature:'0.8',enabled:1,vision:'auto',hasKey:false,models:[]};
  }
  aiModal={idx:idx,isNew:idx<0,p:p,models:(idx>=0?(p.models||[]):[])};
  $('ai-m-title').textContent=idx>=0?('编辑 · '+(p.name||'AI')):'添加 AI';
  $('ai-m-name').value=p.name||'';
  $('ai-m-url').value=p.baseUrl||'';
  $('ai-m-key').value=p.apiKey||'';
  $('ai-m-key').placeholder=p.hasKey?'已设置，留空表示不修改':'sk-...';
  $('ai-m-model').innerHTML=modelOptions({model:p.model,models:aiModal.models});
  $('ai-m-temp').value=p.temperature||'0.8';
  $('ai-m-on').checked=!!p.enabled;
  $('ai-m-vision').value=p.vision||'auto';
  setAiTestResult('','');
  $('ai-modal-mask').hidden=false;
}

function closeAiModal(){
  var mask=$('ai-modal-mask');
  if(mask)mask.hidden=true;
  aiModal.isNew=false;
}

function setAiTestResult(kind,msg){
  var el=$('ai-test-result');
  if(!el)return;
  el.hidden=!kind;
  el.className='test-result'+(kind?' '+kind:'');
  el.textContent=msg||'';
}

function testAiModal(btn){
  var url=$('ai-m-url').value.trim();
  var key=$('ai-m-key').value.trim();
  var model=$('ai-m-model').value;
  var temp=$('ai-m-temp').value.trim();
  if(!url){toast('请先填写 Base URL','bad');return;}
  if(!model){toast('请先选择或填写模型','bad');return;}
  if(!key&&!aiModal.p.hasKey){toast('请先填写 API Key','bad');return;}
  busy(btn,true);
  setAiTestResult('testing','正在测试…');
  api('POST','/api/ai/test',{baseUrl:url,apiKey:key,providerId:aiModal.p.hasKey?aiModal.p.id:'',
    model:model,temperature:temp})
    .then(function(d){
      if(d&&d.ok){
        var sec=d.ms?' · '+(((d.ms/1000).toFixed(1)))+'s':'';
        setAiTestResult('ok','✓ 测试通过'+sec+' · 回复：'+(d.reply||'…'));
      }else{
        setAiTestResult('bad','✗ '+((d&&d.error)||'测试失败'));
      }
    })
    .catch(function(e){setAiTestResult('bad','✗ '+e.message);})
    .then(function(){busy(btn,false);});
}

function pullAiModalModels(btn){
  var url=$('ai-m-url').value.trim();
  var key=$('ai-m-key').value.trim();
  if(!url){toast('请先填写 Base URL','bad');return;}
  if(!key&&!aiModal.p.hasKey){toast('请先填写 API Key','bad');return;}
  busy(btn,true);
  api('POST','/api/models',{baseUrl:url,apiKey:key,providerId:aiModal.p.hasKey?aiModal.p.id:''})
    .then(function(d){
      if(!d)return;
      aiModal.models=d.models||[];
      var cur=$('ai-m-model').value;
      if(aiModal.models.length&&aiModal.models.indexOf(cur)<0)cur=aiModal.models[0];
      $('ai-m-model').innerHTML=modelOptions({model:cur,models:aiModal.models});
      toast('已拉取 '+aiModal.models.length+' 个模型','ok');
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);});
}

function saveAiModal(){
  var p=aiModal.p;
  if(!p)return;
  var isNew=aiModal.isNew;
  p.name=$('ai-m-name').value.trim();
  p.baseUrl=$('ai-m-url').value.trim();
  p.apiKey=$('ai-m-key').value.trim();
  p.model=$('ai-m-model').value;
  p.temperature=$('ai-m-temp').value.trim()||'0.8';
  p.enabled=$('ai-m-on').checked?1:0;
  p.vision=$('ai-m-vision').value||'auto';
  p.models=aiModal.models;
  if(!p.name){toast('请填写名称','bad');return;}
  if(!p.baseUrl){toast('请填写 Base URL','bad');return;}
  if(!p.model){toast('请选择或填写模型','bad');return;}
  if(!p.hasKey&&!p.apiKey){toast('请填写 API Key','bad');return;}
  if(isNew)aiState.push(p);
  closeAiModal();
  renderAiProviders();
  toast((isNew?'已添加「':'已修改「')+p.name+'」，点下方「保存」后生效','ok');
}

function bindAiModal(){
  $('ai-modal-x').addEventListener('click',closeAiModal);
  $('ai-m-cancel').addEventListener('click',closeAiModal);
  $('ai-modal-mask').addEventListener('click',function(e){if(e.target===this)closeAiModal();});
  $('ai-m-key-toggle').addEventListener('click',function(){
    var input=$('ai-m-key');
    var show=input.type==='password';
    input.type=show?'text':'password';
    this.textContent=show?'隐藏':'显示';
  });
  $('ai-m-pull').addEventListener('click',function(){pullAiModalModels(this);});
  $('ai-m-test').addEventListener('click',function(){testAiModal(this);});
  $('ai-m-save').addEventListener('click',saveAiModal);
  if(!aiEscBound){
    aiEscBound=true;
    document.addEventListener('keydown',function(e){
      var mask=$('ai-modal-mask');
      if(e.key==='Escape'&&mask&&!mask.hidden)closeAiModal();
    });
  }
}

function renderAiProviders(){
  var box=$('prov-list');
  if(!box)return;
  if(!aiState.length){
    box.innerHTML='<div class="prov-empty">还没有任何 AI，点「添加 AI」在弹窗里配置</div>';
    return;
  }
  var h='';
  for(var i=0;i<aiState.length;i++)h+=provRowHtml(aiState[i],i);
  box.innerHTML=h;
}

function onProvClick(e){
  var btn=e.target&&e.target.closest?e.target.closest('button'):null;
  var row=e.target&&e.target.closest?e.target.closest('.prov-row'):null;
  if(!row)return;
  var id=row.getAttribute('data-id');
  var idx=-1;
  for(var i=0;i<aiState.length;i++)if(aiState[i].id===id)idx=i;
  if(idx<0)return;
  var swWrap=e.target&&e.target.closest?e.target.closest('.prov-switch'):null;
  if(swWrap){
    var on=swWrap.querySelector('input').checked;
    aiState[idx].enabled=on?1:0;
    renderAiProviders();
    toast((aiState[idx].name||'AI')+(on?' 已启用':' 已停用'),on?'ok':'');
    return;
  }
  var act=btn?btn.getAttribute('data-act'):'edit';

  if(act==='up'){
    if(idx===0){toast('已经是第一个了');return;}
    var a=aiState[idx];aiState[idx]=aiState[idx-1];aiState[idx-1]=a;
    renderAiProviders();
    return;
  }
  if(act==='down'){
    if(idx===aiState.length-1){toast('已经是最后一个了');return;}
    var b=aiState[idx];aiState[idx]=aiState[idx+1];aiState[idx+1]=b;
    renderAiProviders();
    return;
  }
  if(act==='del'){
    if(aiState.length<2){toast('至少保留一个 AI');return;}
    if(!confirm('删除「'+(aiState[idx].name||'这个 AI')+'」？'))return;
    aiState.splice(idx,1);
    renderAiProviders();
    return;
  }
  openAiModal(idx);
}

function collectProviders(){
  var out=[];
  for(var i=0;i<aiState.length;i++){
    var p=aiState[i];
    out.push({id:p.id,name:p.name,baseUrl:p.baseUrl,apiKey:p.apiKey,model:p.model,
      temperature:p.temperature,enabled:p.enabled,vision:p.vision||'auto'});
  }
  return out;
}

function saveProviders(restart,btn){
  if(!aiState.length){toast('至少保留一个 AI','bad');return;}
  busy(btn,true);
  api('POST','/api/ai',{providers:collectProviders()})
    .then(function(d){
      var n=d&&d.saved?d.saved.length:aiState.length;
      for(var i=0;i<aiState.length;i++){
        if(aiState[i].apiKey)aiState[i].hasKey=true;
        aiState[i].apiKey='';
      }
      renderAiProviders();
      toast('已保存 '+n+' 个 AI','ok');
      if(!restart)return null;
      return api('POST','/api/bot/restart',{}).then(function(){
        toast('已重启，新配置生效','ok');
      });
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);});
}

function showAi(){
  stopStatusTimer();
  rendered=false;
  setActive('ai');
  setTopActions('');
  setPill('AI 对话','');
  $('wrap').innerHTML=skeletonAi();
  api('GET','/api/ai').then(function(d){
    if(!d)return;
    aiState=(d.providers||[]).map(function(p){
      return {id:p.id,name:p.name,baseUrl:p.baseUrl,apiKey:'',model:p.model,
        temperature:p.temperature,enabled:p.enabled?1:0,vision:p.vision||'auto',hasKey:!!p.hasKey,models:[]};
    });
    renderAiPage();
  }).catch(function(e){
    $('wrap').innerHTML='<div class="card"><div class="card-head"><h3>AI 列表读取失败</h3></div>'
      +'<p class="error-text">'+esc(e.message)+'</p></div>';
    setPill('读取失败','bad');
  });
}

var imageGenState={model:'',baseUrl:'',apiKey:'',hasKey:false,testedModel:'',testedUrl:'',tested:false,result:''};
var igenEscBound=false;

function renderAiPage(){
  var h='<div class="card"><div class="card-head"><h3>AI 列表</h3>'
    +'<span class="hint">按顺序尝试，失败自动换下一个；点行可编辑</span></div>'
    +'<div class="prov-list" id="prov-list"></div>'
    +'<div class="form-actions">'
    +'<button class="btn" id="b-ai-add" type="button">＋ 添加 AI</button>'
    +'<span class="grow"></span>'
    +'<button class="btn" id="b-ai-save" type="button">'+IX.check+'<span>保存</span></button>'
    +'<button class="btn primary" id="b-ai-save-restart" type="button">'+IX.refresh+'<span>保存并重启</span></button>'
    +'</div></div>';
  h+='<div class="card"><div class="card-head"><h3>内置国内 AI 配置</h3>'
    +'<span class="hint">点一下打开弹窗，地址和模型都填好，只需再填 API Key</span></div>'
    +'<div class="chip-row" id="ai-presets">'+aiPresetChips()+'</div></div>';
  h+='<div class="card"><div class="card-head"><h3>怎么用</h3></div>'
    +'<p class="tip">每个 AI 一套 Base URL + API Key + 模型，接口要兼容 OpenAI 的 <b>/chat/completions</b>。'
    +'添加和编辑都在弹窗里完成，可以先「测试」确认能通再保存。列表顺序就是优先级：机器人先问第一个，'
    +'超时、报错、配额用完就自动切到下一个，全部失败才会回一句「出了点小状况」。停用的 AI 不参与。<br>'
    +'注：讯飞星火的「API Key」填控制台里的 <b>APIPassword</b>；腾讯混元已升级为 TokenHub 平台，地址用的是新接口。<br>'
    +'国外模型（OpenAI、Gemini、Grok 等）在 Cloudflare Workers 上可直连，不需要代理；调用是机器人服务器发的，跟你本地网络无关。<br>'
    +'改完点「保存」立即生效（机器人自动热更新，无需重启）；「保存并重启」会完整重启一遍连接。</p></div>';
  h+=aiModalHtml();
  $('wrap').innerHTML=h;
  renderAiProviders();
  bindAiModal();

  $('b-ai-add').addEventListener('click',function(){openAiModal(-1);});
  $('b-ai-save').addEventListener('click',function(){saveProviders(false,this);});
  $('b-ai-save-restart').addEventListener('click',function(){saveProviders(true,this);});
  $('prov-list').addEventListener('click',onProvClick);
  $('ai-presets').addEventListener('click',onPresetClick);
}

/* 内置 AI 服务商（OpenAI 兼容端点，地址已按官方文档核实），点预设打开弹窗自动填名称/地址/模型 */
var AI_PRESETS=[
  {label:'Qwen 中转',name:'Qwen 中转（jdb.us.ci）',url:'https://api.jdb.us.ci/v1',model:'qwen3.7-plus'},
  {label:'Qwen 识图',name:'Qwen 识图（jdb.us.ci）',url:'https://api.jdb.us.ci/v1',model:'qwen3-vl-plus'},
  {label:'OpenAI',name:'OpenAI',url:'https://api.openai.com/v1',model:'gpt-5-mini'},
  {label:'Google Gemini',name:'Google Gemini',url:'https://generativelanguage.googleapis.com/v1beta/openai/',model:'gemini-2.5-flash'},
  {label:'xAI Grok',name:'xAI Grok',url:'https://api.x.ai/v1',model:'grok-4'},
  {label:'Groq',name:'Groq（免费额度）',url:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile'},
  {label:'OpenRouter',name:'OpenRouter 聚合',url:'https://openrouter.ai/api/v1',model:'openai/gpt-4o-mini'},
  {label:'Mistral',name:'Mistral',url:'https://api.mistral.ai/v1',model:'mistral-small-latest'},
  {label:'DeepSeek',name:'DeepSeek',url:'https://api.deepseek.com/v1',model:'deepseek-chat'},
  {label:'通义千问',name:'通义千问（百炼）',url:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen-plus'},
  {label:'智谱 GLM',name:'智谱 GLM',url:'https://open.bigmodel.cn/api/paas/v4',model:'glm-4-flash'},
  {label:'Kimi',name:'Kimi（月之暗面）',url:'https://api.moonshot.cn/v1',model:'kimi-latest'},
  {label:'豆包',name:'火山方舟（豆包）',url:'https://ark.cn-beijing.volces.com/api/v3',model:'doubao-seed-1-6-flash-250815'},
  {label:'硅基流动',name:'硅基流动',url:'https://api.siliconflow.cn/v1',model:'deepseek-ai/DeepSeek-V3'},
  {label:'腾讯混元',name:'腾讯混元 TokenHub',url:'https://tokenhub.tencentmaas.com/v1',model:'hy3'},
  {label:'讯飞星火',name:'讯飞星火',url:'https://spark-api-open.xf-yun.com/v1',model:'4.0Ultra'},
  {label:'MiniMax',name:'MiniMax',url:'https://api.minimaxi.com/v1',model:'MiniMax-M2'},
  {label:'零一万物',name:'零一万物 Yi',url:'https://api.lingyiwanwu.com/v1',model:'yi-lightning'},
  {label:'阶跃星辰',name:'阶跃星辰 Step',url:'https://api.stepfun.com/v1',model:'step-2-16k'},
  {label:'百川智能',name:'百川智能',url:'https://api.baichuan-ai.com/v1',model:'Baichuan4-Turbo'},
  {label:'魔搭免费',name:'魔搭 ModelScope（免费额度）',url:'https://api-inference.modelscope.cn/v1',model:'deepseek-ai/DeepSeek-V3'}
];
function aiPresetChips(){
  var h='';
  for(var i=0;i<AI_PRESETS.length;i++)h+='<button class="chip" type="button" data-i="'+i+'">'+esc(AI_PRESETS[i].label)+'</button>';
  return h;
}
function onPresetClick(e){
  var btn=e.target&&e.target.closest?e.target.closest('.chip'):null;
  if(!btn)return;
  var p=AI_PRESETS[Number(btn.getAttribute('data-i')||'-1')];
  if(!p)return;
  openAiModal(-1,{name:p.name,url:p.url,model:p.model});
}

/* ------------------------------ 工作区（沙箱 + 任务 + 记忆，合并） ------------------------------ */

function showWorkspace(){
  stopStatusTimer();
  rendered=false;
  setActive('workspace');
  setTopActions('');
  setPill('工作区','');
  $('wrap').innerHTML='<div class="card"><div class="card-head"><h3>工作区</h3>'
    +'<span class="hint">每个用户一份：文件（AiDO 沙箱）、任务与笔记（/工作）、对话记忆（ChatDO 三层）</span>'
    +'<button class="btn sm" id="b-ws-refresh" type="button">'+IX.refresh+'<span>刷新</span></button></div>'
    +'<p class="muted">按「人」隔离：单聊 <code>c2c:&lt;用户&gt;</code>、群聊 <code>group:&lt;群&gt;:u:&lt;用户&gt;</code>。点「查看」能看到这个人的文件、任务/笔记，以及 AI 记住他的三层记忆。</p>'
    +'<div id="ws-list"><div class="sk-field"><span class="sk-bar sk-w60"></span></div></div>'
    +'<div class="card-head" style="margin-top:1.1rem"><h3>定时任务</h3><span class="hint" id="rem-count"></span></div>'
    +'<p class="muted">群里说「明天 8 点提醒我开会」「10 分钟后提醒我喝水」就会出现在这里；到点主动发消息，重复任务自动顺延。</p>'
    +'<div class="prov-list" id="rem-list"><p class="muted">加载中…</p></div></div>';
  var btn=$('b-ws-refresh');
  if(btn)btn.addEventListener('click',function(){loadWorkspaces();loadReminders();});
  loadWorkspaces();
  loadReminders();
}

function loadWorkspaces(){
  var box=$('ws-list');
  if(box)box.innerHTML='<div class="sk-field"><span class="sk-bar sk-w60"></span></div>';
  // 同时拉沙箱与工作区两套索引，按 scope 合并成一个用户列表
  Promise.all([
    api('GET','/api/sandboxes').then(function(d){return (d&&d.items)||[];}).catch(function(){return [];}),
    api('GET','/api/workspaces').then(function(d){return (d&&d.items)||[];}).catch(function(){return [];})
  ]).then(function(r){ renderWorkspaces(r[0],r[1]); })
    .catch(function(e){ if(box)box.innerHTML='<p class="error-text">'+esc(e.message)+'</p>'; });
}

function renderWorkspaces(sandboxes,workspaces){
  var box=$('ws-list');
  if(!box)return;
  var byScope={};
  for(var i=0;i<sandboxes.length;i++){
    var s=sandboxes[i];
    byScope[s.scope]={scope:s.scope,scopeMasked:s.scopeMasked,kind:s.kind,updatedAt:s.updatedAt,
      files:s.files||0,lastTask:s.lastTask||'',hasSandbox:true};
  }
  for(var j=0;j<workspaces.length;j++){
    var w=workspaces[j];
    var rec=byScope[w.scope]||{scope:w.scope,scopeMasked:w.scopeMasked,kind:w.kind,updatedAt:w.updatedAt,hasSandbox:false};
    rec.tasks=w.tasks||0; rec.notes=w.notes||0; rec.hasWorkspace=true;
    if(!rec.lastTask)rec.lastTask=w.lastTask||'';
    if(!rec.updatedAt||(w.updatedAt&&w.updatedAt>rec.updatedAt))rec.updatedAt=w.updatedAt;
    if(!rec.scopeMasked)rec.scopeMasked=w.scopeMasked;
    if(!rec.kind)rec.kind=w.kind;
    byScope[w.scope]=rec;
  }
  var items=Object.keys(byScope).map(function(k){return byScope[k];});
  items.sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});
  if(!items.length){
    box.innerHTML='<p class="muted">还没有工作区。群里 @机器人 发 <b>/工作 帮我整理一下…</b>，或说「写一篇…保存成 a.md 发我」就会创建。</p>';
    return;
  }
  var h='';
  for(var m=0;m<items.length;m++){
    var it=items[m];
    var tags='<span class="ws-tag">'+(it.kind==='c2c'?'单聊':'群聊')+'</span>';
    if(it.hasSandbox)tags+='<span class="ws-tag">文件 '+esc(String(it.files||0))+' 个</span>';
    if(it.hasWorkspace)tags+='<span class="ws-tag">任务 '+esc(String(it.tasks||0))+' · 笔记 '+esc(String(it.notes||0))+'</span>';
    tags+='<span class="ws-tag">'+esc(it.updatedAt?absTime(it.updatedAt):'')+'</span>';
    h+='<div class="ws-row" data-scope="'+esc(it.scope)+'">'
      +'<div class="ws-main"><b>'+esc(it.scopeMasked||'')+'</b>'
      +'<small>'+esc(it.lastTask||'（还没执行过任务）')+'</small>'
      +'<div class="ws-tags">'+tags+'</div></div>'
      +'<div class="prov-tools"><button class="btn sm" type="button" data-ws="detail">查看</button>'
      +'<button class="btn sm" type="button" data-ws="clear">清空</button></div></div>';
  }
  box.innerHTML=h;
  if(!box.__wsBound){ box.__wsBound=true; box.addEventListener('click',onWorkspaceClick); }
}

function onWorkspaceClick(e){
  var btn=e.target&&e.target.closest?e.target.closest('button[data-ws]'):null;
  if(!btn)return;
  var row=btn.closest('.ws-row');
  if(!row)return;
  var scope=row.getAttribute('data-scope')||'';
  var act=btn.getAttribute('data-ws');
  if(act==='clear'){
    if(!confirm('清空这个用户的工作区（文件、任务、笔记）？'))return;
    Promise.all([
      api('POST','/api/sandboxes/clear',{scope:scope}).catch(function(){}),
      api('POST','/api/workspaces/clear',{scope:scope}).catch(function(){})
    ]).then(function(){ toast('已清空'); loadWorkspaces(); })
      .catch(function(err){ toast(err.message,'bad'); });
  } else if(act==='detail'){
    openWorkspaceDetail(scope);
  }
}

function openWorkspaceDetail(scope){
  var m=document.getElementById('ws-modal-mask');
  if(!m){
    m=document.createElement('div');
    m.className='modal-mask';
    m.id='ws-modal-mask';
    m.innerHTML='<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>工作区详情</h3>'
      +'<button class="modal-x" type="button" id="ws-modal-x" aria-label="关闭">×</button></div>'
      +'<div class="modal-body ws-detail" id="ws-detail-body"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click',function(ev){
      if(ev.target===m||ev.target.id==='ws-modal-x')m.hidden=true;
    });
  }
  var body=$('ws-detail-body');
  body.innerHTML='<p class="muted">加载中…</p>';
  m.hidden=false;
  // 并行拉三份：沙箱文件、工作区任务/笔记、记忆三层
  Promise.all([
    api('POST','/api/sandboxes/detail',{scope:scope}).catch(function(){return {files:[],runs:0};}),
    api('POST','/api/workspaces/detail',{scope:scope}).catch(function(){return {tasks:[],notes:[],log:[],runs:0};}),
    api('POST','/api/memory',{scope:scope}).catch(function(){return {messages:0,summary:'',facts:[],recent:[]};})
  ]).then(function(r){ renderWorkspaceDetail(scope,r[0],r[1],r[2]); })
    .catch(function(e){ body.innerHTML='<p class="error-text">'+esc(e.message)+'</p>'; });
}

function renderWorkspaceDetail(scope,sandbox,workspace,memory){
  var body=$('ws-detail-body');
  if(!body)return;

  var files=(sandbox.files||[]).length?sandbox.files.map(function(f){
    var t=f.updatedAt?absTime(f.updatedAt):'';
    return '<li><details><summary>· '+esc(f.path)+'（'+esc(String(f.bytes))+'B'+(t?' · '+esc(t):'')+'）</summary><pre class="file-pre">'+esc(String(f.content||'（无内容）'))+'</pre></details></li>';
  }).join(''):'<li class="muted">（空）</li>';

  var tasks=(workspace.tasks||[]).length?workspace.tasks.map(function(x){return '<li>'+(x.done?'✅':'⬜')+' #'+x.id+' '+esc(x.text)+'</li>';}).join(''):'<li class="muted">（空）</li>';
  var notes=(workspace.notes||[]).length?workspace.notes.slice(-10).map(function(n){return '<li>· '+esc(n.text)+'</li>';}).join(''):'<li class="muted">（空）</li>';

  // 记忆分层图：三层各自的量 + 内容
  var recentHtml=(memory.recent&&memory.recent.length)
    ? '<div class="mem-recent">'+memory.recent.map(function(x){
        var role=x.role==='user'?'用户':'助手';
        var cls=x.role==='user'?'mem-user':'mem-bot';
        return '<div class="mem-line '+cls+'"><span class="mem-role">'+role+'</span><span class="mem-text">'+esc(x.content)+'</span></div>';
      }).join('')+'</div>'
    : '<p class="muted">（还没有对话）</p>';

  var summaryHtml=memory.summary
    ? '<p class="mem-summary">'+esc(memory.summary)+'</p>'
    : '<p class="muted">（还没有摘要，攒够 20 条才会压缩生成）</p>';

  var factList=memory.facts||[];
  var factsHtml=factList.length
    ? '<ul class="mem-facts">'+factList.map(function(f){
        var t=f.at?absTime(f.at):'';
        return '<li><span>'+esc(f.text)+'</span>'+(t?'<span class="mem-fact-time">'+esc(t)+'</span>':'')+'</li>';
      }).join('')+'</ul>'
    : '<p class="muted">（还没有长期事实）</p>';

  body.innerHTML='<div class="muted">'+esc(scope)+'</div>'
    +'<h4>📂 文件（沙箱 · 写入 '+(sandbox.runs||0)+' 次）</h4><ul>'+files+'</ul>'
    +'<h4>📋 任务清单（/工作）</h4><ul>'+tasks+'</ul>'
    +'<h4>📝 笔记（/工作）</h4><ul>'+notes+'</ul>'
    +'<h4>🧠 记忆分层（ChatDO）</h4>'
    +'<div class="mem-block">'
    +'<div class="mem-layer"><b>第一层 · 最近原文</b><span class="hint">'+(memory.messages||0)+' 条</span></div>'
    +recentHtml
    +'<div class="mem-layer"><b>第二层 · 滚动摘要</b><span class="hint">'+(memory.summaryLen||0)+' 字</span></div>'
    +summaryHtml
    +'<div class="mem-layer"><b>第三层 · 长期事实</b><span class="hint">'+factList.length+' 条</span></div>'
    +factsHtml
    +'</div>';
}

function showImageGen(){
  stopStatusTimer();
  rendered=false;
  setActive('imagegen');
  setTopActions('');
  setPill('生图模型','');
  $('wrap').innerHTML='<div class="card"><div class="card-head"><h3>生图模型</h3></div>'
    +'<div class="sk-field"><span class="sk-bar sk-w60"></span></div></div>';
  api('GET','/api/config').then(function(c){
    var cfg=(c&&c.config)||{};
    var conf=(c&&c.configured)||{};
    imageGenState.baseUrl=cfg.imageGenBaseUrl||'';
    imageGenState.model=cfg.imageGenModel||'';
    imageGenState.apiKey='';
    imageGenState.hasKey=!!conf.imageGenApiKey;
    imageGenState.tested=false;
    imageGenState.result='';
    renderImageGenPage();
  }).catch(function(e){
    $('wrap').innerHTML='<div class="card"><div class="card-head"><h3>配置读取失败</h3></div>'
      +'<p class="error-text">'+esc(e.message)+'</p></div>';
    setPill('读取失败','bad');
  });
}

function igenRowHtml(){
  var host=imageGenState.baseUrl||'';
  var k=host.indexOf('://');
  if(k>=0)host=host.substring(k+3);
  k=host.indexOf('/');
  if(k>=0)host=host.substring(0,k);
  var flag=imageGenState.tested?'<span class="prov-flag on">已测试</span>'
    :'<span class="prov-flag off">未测试</span>';
  var keyFlag=imageGenState.hasKey?'<span class="prov-keyok">Key 已设置</span>':'<span class="prov-keyno">Key 未设置</span>';
  var h='<div class="prov-row" data-igen="1" title="点击编辑">';
  h+='<span class="prov-no">🎨</span>';
  h+='<div class="prov-info"><b>'+esc(imageGenState.model||'未配置（生图关闭）')+'</b><small>'
    +(host?esc(host):'不填地址和 Key 时用「AI 对话」第一个 AI 兜底')+'</small></div>';
  h+='<div class="prov-meta">'+keyFlag+flag+'</div>';
  h+='<div class="prov-tools"><button class="btn sm" type="button" data-act="edit">编辑</button></div>';
  h+='</div>';
  return h;
}

function igenModalHtml(){
  var h='<div class="modal-mask" id="igen-modal-mask" hidden>'
    +'<div class="modal" role="dialog" aria-modal="true" aria-labelledby="igen-m-title">'
    +'<div class="modal-head"><h3 id="igen-m-title">编辑生图配置</h3>'
    +'<button class="modal-x" type="button" id="igen-modal-x" aria-label="关闭">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label for="igen-url">Base URL</label>'
    +'<input id="igen-url" placeholder="https://api.example.com/v1" value="'+esc(imageGenState.baseUrl)+'"></div>'
    +'<div class="field"><label for="igen-key">API Key</label>'
    +'<div class="pw-wrap"><input id="igen-key" type="password" value="'+esc(imageGenState.apiKey||'')+'" placeholder="'
    +(imageGenState.hasKey?'已设置，留空沿用旧 Key':'sk-...')+'" autocomplete="new-password">'
    +'<button class="pw-toggle" type="button" id="igen-key-toggle">显示</button></div></div>'
    +'<div class="field"><label for="igen-model">模型</label>'
    +'<input id="igen-model" placeholder="qwen-image-3.0-pro" maxlength="64" value="'+esc(imageGenState.model)+'"></div>'
    +'<div class="field"><span class="hint">qwen-image-3.0-pro 单张通常 1~2 分钟（2048×2048，约 9MB）；机器人会先回一句「在画了」再发图。</span></div>'
    +'<div class="chip-label">主流生图模型，点一下直接填入：</div>'
    +'<div class="chip-row" id="igen-modal-chips">'+igenModelChips()+'</div>'
    +'<div class="test-result" id="igen-test-result" hidden></div>'
    +'</div>'
    +'<div class="modal-foot">'
    +'<button class="btn" type="button" id="b-igen-test">'+IX.play+'<span>测试</span></button>'
    +'<span class="grow"></span>'
    +'<button class="btn" type="button" id="igen-m-cancel">取消</button>'
    +'<button class="btn primary" type="button" id="igen-m-done">'+IX.check+'<span>完成</span></button>'
    +'</div></div></div>';
  return h;
}

function openIgenModal(){
  $('igen-m-title').textContent='编辑生图配置';
  $('igen-url').value=imageGenState.baseUrl||'';
  $('igen-key').value=imageGenState.apiKey||'';
  $('igen-key').placeholder=imageGenState.hasKey?'已设置，留空沿用旧 Key':'sk-...';
  $('igen-model').value=imageGenState.model||'';
  setIgenResult('','');
  $('igen-modal-mask').hidden=false;
}

function closeIgenModal(){
  var m=$('igen-modal-mask');
  if(m)m.hidden=true;
}

function setIgenResult(kind,msg){
  var el=$('igen-test-result');
  if(!el)return;
  el.hidden=!kind;
  el.className='test-result'+(kind?' '+kind:'');
  if(kind==='ok')el.innerHTML=msg||'';
  else el.textContent=msg||'';
}

function saveIgenModal(){
  var url=$('igen-url').value.trim();
  var key=$('igen-key').value.trim();
  var model=$('igen-model').value.trim();
  if(!url){toast('请填写 Base URL','bad');return;}
  if(!model){toast('请填写模型名','bad');return;}
  if(!key&&!imageGenState.hasKey){toast('请填写 API Key','bad');return;}
  imageGenState.baseUrl=url;
  imageGenState.model=model;
  imageGenState.apiKey=key;
  closeIgenModal();
  renderImageGenPage();
  toast('已更新生图配置，点下方「保存」后生效','ok');
}

function bindIgenModal(){
  $('b-igen-add').addEventListener('click',openIgenModal);
  var row=document.querySelector('[data-igen]');
  if(row)row.addEventListener('click',openIgenModal);
  $('b-igen-save').addEventListener('click',function(){saveImageGen(this);});
  $('igen-modal-x').addEventListener('click',closeIgenModal);
  $('igen-m-cancel').addEventListener('click',closeIgenModal);
  $('igen-modal-mask').addEventListener('click',function(e){if(e.target===this)closeIgenModal();});
  var key=$('igen-key');
  var toggle=$('igen-key-toggle');
  if(toggle)toggle.addEventListener('click',function(){
    var show=key.type==='password';
    key.type=show?'text':'password';
    this.textContent=show?'隐藏':'显示';
  });
  var reset=function(){
    imageGenState.tested=false;
    imageGenState.result='';
    setIgenResult('','');
    updateImageGenState();
  };
  $('igen-url').addEventListener('input',reset);
  $('igen-model').addEventListener('input',reset);
  $('igen-key').addEventListener('input',reset);
  $('b-igen-test').addEventListener('click',function(){testImageGen(this);});
  $('igen-m-done').addEventListener('click',saveIgenModal);
  var chips=$('igen-modal-chips');
  if(chips)chips.addEventListener('click',function(e){
    var chip=e.target&&e.target.closest?e.target.closest('.chip'):null;
    if(!chip)return;
    $('igen-model').value=chip.getAttribute('data-m')||'';
    reset();
  });
  var igenPresets=$('igen-model-presets');
  if(igenPresets)igenPresets.addEventListener('click',function(e){
    var chip=e.target&&e.target.closest?e.target.closest('.chip'):null;
    if(!chip)return;
    openIgenModal();
    $('igen-model').value=chip.getAttribute('data-m')||'';
    imageGenState.tested=false;
    setIgenResult('','');
    updateImageGenState();
  });
  if(!igenEscBound){
    igenEscBound=true;
    document.addEventListener('keydown',function(e){
      var m=$('igen-modal-mask');
      if(e.key==='Escape'&&m&&!m.hidden)closeIgenModal();
    });
  }
  // 每次重绘后按当前状态刷新保存按钮（弹窗点「完成」会重绘整页，不刷新会一直灰着）
  updateImageGenState();
}

function renderImageGenPage(){
  var h='<div class="card"><div class="card-head"><h3>生图配置</h3>'
    +'<span class="hint">先测试通过才能保存；点行或「编辑」在弹窗里改</span></div>'
    +igenRowHtml()
    +'<div class="form-actions">'
    +'<button class="btn" id="b-igen-add" type="button">✎ 编辑生图配置</button>'
    +'<span class="grow"></span>'
    +'<span class="hint" id="igen-state"></span>'
    +'<button class="btn primary" id="b-igen-save" type="button" disabled>'+IX.check+'<span>保存生图模型</span></button>'
    +'</div></div>';
  h+='<div class="card"><div class="card-head"><h3>主流生图模型</h3>'
    +'<span class="hint">点一下打开弹窗并填好模型名</span></div>'
    +'<div class="chip-row" id="igen-model-presets">'+igenModelChips()+'</div></div>';
  h+='<div class="card"><div class="card-head"><h3>怎么用</h3></div>'
    +'<p class="tip">生图用独立的 Base URL / API Key，和「AI 对话」里的对话模型互不影响，可以指向另一家服务商。'
    +'编辑在弹窗里完成，先点「<b>测试</b>」，服务商会现场画一张示例图；测试通过后保存按钮才会亮，保存后立即生效（机器人自动热更新）。<br>'
    +'群里发「/画 一只橘猫，水彩风格」或直接说「帮我画一只猫」就会出图。留空模型表示关闭生图。<br>'
    +'建议填服务商标注了 <b>image_gen</b> 的模型（比如 qwen-image-3.0-pro），接口需兼容 OpenAI 的 <b>/images/generations</b>。'
    +'Base URL 不知道填什么的话，「AI 对话」页的内置配置里有各家的地址。'
    +'不填 Base URL / Key 时，会自动用「AI 对话」里第一个 AI 的配置兜底。</p></div>';
  h+=igenModalHtml();
  $('wrap').innerHTML=h;
  bindIgenModal();
}

/* 主流生图模型（OpenAI 兼容 /images/generations），点预设打开弹窗并填入模型名 */
var IMAGE_MODEL_PRESETS=[
  'qwen-image-3.0-pro','qwen-image','wanx2.1-t2i-plus','seedream-4.0',
  'doubao-seedream-3-0-t2i','cogview-4','dall-e-3','gpt-image-1.5','gpt-image-1','flux-schnell','nano-banana'
];
function igenModelChips(){
  var h='';
  for(var i=0;i<IMAGE_MODEL_PRESETS.length;i++)h+='<button class="chip" type="button" data-m="'+esc(IMAGE_MODEL_PRESETS[i])+'">'+esc(IMAGE_MODEL_PRESETS[i])+'</button>';
  return h;
}

function updateImageGenState(){
  var st=$('igen-state');
  var save=$('b-igen-save');
  var ok=imageGenState.tested&&imageGenState.model
    &&imageGenState.model===imageGenState.testedModel
    &&imageGenState.baseUrl===imageGenState.testedUrl;
  if(save)save.disabled=!ok;
  if(st){
    if(ok)st.textContent='已测试通过';
    else if(imageGenState.model)st.textContent='未测试，保存前先在弹窗里测试';
    else st.textContent='未配置';
  }
}

function testImageGen(btn){
  var urlEl=$('igen-url');
  var keyEl=$('igen-key');
  var modelEl=$('igen-model');
  var url=urlEl?urlEl.value.trim():'';
  var key=keyEl?keyEl.value.trim():'';
  var model=modelEl?modelEl.value.trim():'';
  if(!url){toast('先填 Base URL','bad');return;}
  if(!model){toast('先填模型名','bad');return;}
  if(!key&&!imageGenState.hasKey){toast('先填 API Key','bad');return;}
  var orig=btn.innerHTML;
  busy(btn,true);
  btn.innerHTML=IX.refresh+'<span>生成中…（约 10~40 秒）</span>';
  api('POST','/api/imagegen/test',{model:model,baseUrl:url,apiKey:key})
    .then(function(r){
      imageGenState.testedModel=model;
      imageGenState.testedUrl=url;
      imageGenState.model=model;
      imageGenState.baseUrl=url;
      imageGenState.tested=!!(r&&r.ok);
      if(r&&r.ok){
        setIgenResult('ok','<span class="ok-text">测试通过，示例图：</span>'
          +'<a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">打开原图</a>'
          +'<img class="igen-preview" src="'+esc(r.url)+'" alt="生图示例" referrerpolicy="no-referrer">');
      }else{
        setIgenResult('bad','测试失败：'+((r&&r.error)||'未知错误'));
      }
      updateImageGenState();
      toast(r&&r.ok?'生图模型可用':'测试失败，请检查地址或模型名',r&&r.ok?'ok':'bad');
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);btn.innerHTML=orig;});
}

function saveImageGen(btn){
  if(!imageGenState.tested||imageGenState.model!==imageGenState.testedModel
    ||imageGenState.baseUrl!==imageGenState.testedUrl){
    toast('请先测试通过再保存','bad');
    return;
  }
  busy(btn,true);
  api('POST','/api/config',{imageGenBaseUrl:imageGenState.baseUrl,
    imageGenApiKey:imageGenState.apiKey||'',imageGenModel:imageGenState.model})
    .then(function(){
      if(imageGenState.apiKey)imageGenState.hasKey=true;
      imageGenState.apiKey='';
      renderImageGenPage();
      toast('生图模型已保存，立即生效','ok');
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);});
}

/* ============================== 群管理 ============================== */
var grpModal={openid:'',nextCursor:'',members:[]};
var grpEscBound=false;

function grpPermHint(msg){
  return String(msg||'').indexOf('11253')>=0
    ?msg+'（官方白名单接口：到 QQ 开放平台 q.qq.com 的机器人管理后台申请「群管理」相关接口权限，通过后即可用）'
    :msg;
}

function groupsShell(){
  var h='<div class="card"><div class="card-head"><h3>群列表</h3><span class="hint" id="grp-count"></span></div>';
  h+='<p class="tip">机器人收到群消息或被拉进新群时，会自动把群记到这里（完整 openid 存在数据库里，列表只显示打码版，需要完整版点复制按钮）。</p>';
  h+='<div class="grp-add"><input id="grp-add-input" placeholder="手动添加：粘贴群 openid" maxlength="128">'
    +'<button class="btn" type="button" id="grp-add-btn">'+IX.check+'<span>添加</span></button>'
    +'<button class="btn" type="button" id="grp-refresh">'+IX.refresh+'<span>刷新</span></button></div>';
  h+='<div class="prov-list" id="group-list"><p class="muted">加载中…</p></div></div>';
  h+='<div class="card"><div class="card-head"><h3>官方接口能力说明</h3></div>';
  h+='<dl class="dl">';
  h+='<dt>群资料</dt><dd>点群行打开弹窗：群名 / 简介 / 分类 / 标签 / 人数，外加机器人在群里的状态（角色、入群时间、消息接收设置、是否允许主动推送）</dd>';
  h+='<dt>成员管理</dt><dd>「拉取成员列表」是官方内邀接口（开放平台申请不到，等官方开放）；已批禁言权限的话，可以在弹窗里粘贴成员 openid 直接禁言 / 解除，或点「拉取成员列表」选中操作。机器人需要群管理员身份，最长 30 天</dd>';
  h+='<dt>禁言状态</dt><dd>弹窗实时显示全员禁言模式和当前被禁言的成员（官方已开放的查询接口）</dd>';
  h+='<dt>权限</dt><dd>群资料 / 机器人状态属官方白名单（报 code=11253 需联系平台运营）；撤回、入群审批、禁言、批量移除可在开放平台自助申请</dd>';
  h+='<dt>回复开关</dt><dd>只控制本机器人是否在这个群里回话（黑名单机制），不影响官方群管理</dd>';
  h+='</dl></div>';
  return h;
}

function grpRowHtml(g){
  var seen=g.lastSeen?fmtEntryTime(g.lastSeen):'—';
  var h='<div class="prov-row'+(g.replyEnabled?'':' is-off')+'" data-openid="'+esc(g.openid)+'" title="点行查看群资料">';
  h+='<span class="prov-no">👥</span>';
  h+='<div class="prov-info"><b>'+esc(g.masked)+'</b><small>最近活跃 '+esc(seen)+'</small></div>';
  h+='<div class="prov-meta">';
  h+=g.source==='manual'?'<span class="prov-flag off">手动添加</span>':'<span class="prov-flag on">自动收集</span>';
  h+='</div>';
  h+='<div class="prov-tools">';
  h+='<label class="prov-switch" title="开关本机器人在这个群的回复"><input type="checkbox" data-act="toggle"'+(g.replyEnabled?' checked':'')+'><i></i></label>';
  h+='<button class="btn sm" type="button" data-act="members">成员</button>';
  h+='<button class="icon-btn" type="button" data-act="copy" title="复制完整 openid">'+IX.key+'</button>';
  h+='<button class="icon-btn" type="button" data-act="del" title="从列表移除">'+IX.trash+'</button>';
  h+='</div></div>';
  return h;
}

function loadGroups(){
  var list=$('group-list');
  if(!list)return Promise.resolve();
  return api('GET','/api/groups').then(function(d){
    var items=(d&&d.items)||[];
    var cnt=$('grp-count');
    if(cnt)cnt.textContent=items.length?('共 '+items.length+' 个群'):'';
    if(!items.length){
      list.innerHTML='<p class="muted">还没有记录。机器人在群里收到第一条消息、或被拉进新群时，会自动把群加进来；也可以在上面手动添加。</p>';
      return;
    }
    var h='';
    for(var i=0;i<items.length;i++)h+=grpRowHtml(items[i]);
    list.innerHTML=h;
  }).catch(function(e){
    list.innerHTML='<p class="error-text">'+esc(e.message)+'</p>';
  });
}

function addGroupRow(){
  var input=$('grp-add-input');
  var openid=String((input&&input.value)||'').trim();
  if(!openid){toast('先粘贴群 openid','bad');return;}
  var btn=$('grp-add-btn');
  if(btn)btn.disabled=true;
  api('POST','/api/groups/add',{openid:openid}).then(function(){
    if(input)input.value='';
    toast('已添加到群列表','ok');
    return loadGroups();
  }).catch(function(e){toast(e.message,'bad');}).then(function(){if(btn)btn.disabled=false;});
}

function removeGroupRow(openid){
  if(!confirm('从群列表移除这个群？只影响后台列表，不影响机器人运行。'))return;
  api('POST','/api/groups/remove',{openid:openid}).then(function(){
    toast('已移除','ok');
    return loadGroups();
  }).catch(function(e){toast(e.message,'bad');});
}

function copyGrpId(text){
  var done=function(){toast('完整 openid 已复制','ok');};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(function(){toast('复制失败','bad');});
  }else{
    toast('当前浏览器不支持一键复制','bad');
  }
}

function onGroupClick(e){
  var actEl=e.target.closest('[data-act]');
  var row=e.target.closest('.prov-row');
  if(!row)return;
  var openid=row.getAttribute('data-openid');
  if(actEl){
    var act=actEl.getAttribute('data-act');
    if(act==='toggle')return;
    if(act==='members')openGrpModal(openid,true);
    else if(act==='del')removeGroupRow(openid);
    else if(act==='copy')copyGrpId(openid);
    return;
  }
  openGrpModal(openid,false);
}

function onGroupToggle(e){
  var input=e.target.closest('input[data-act="toggle"]');
  if(!input)return;
  var row=e.target.closest('.prov-row');
  if(!row)return;
  var openid=row.getAttribute('data-openid');
  var enabled=!!input.checked;
  input.disabled=true;
  api('POST','/api/groups/reply',{openid:openid,enabled:enabled?1:0}).then(function(){
    row.classList.toggle('is-off',!enabled);
    toast(enabled?'已开启该群的回复':'已关闭该群的回复','ok');
  }).catch(function(err){
    input.checked=!enabled;
    toast(err.message,'bad');
  }).then(function(){input.disabled=false;});
}

function showGroups(){
  stopStatusTimer();
  rendered=false;
  setActive('groups');
  setTopActions('');
  setPill('群管理','');
  var wrap=$('wrap');
  if(!$('group-list')){
    wrap.innerHTML=groupsShell();
    $('grp-add-btn').addEventListener('click',addGroupRow);
    $('grp-add-input').addEventListener('keydown',function(e){if(e.key==='Enter')addGroupRow();});
    $('grp-refresh').addEventListener('click',function(){loadGroups();});
    var list=$('group-list');
    list.addEventListener('click',onGroupClick);
    list.addEventListener('change',onGroupToggle);
  }
  return loadGroups();
}

/* ---- 群管理弹窗：群资料 + 成员/禁言 ---- */

function grpInfoHtml(info,state){
  var h='<dl class="dl">';
  if(info){
    h+='<dt>群名称</dt><dd>'+esc(info.group_name||'—')+'</dd>';
    h+='<dt>群简介</dt><dd>'+esc(info.group_finger_memo||'—')+'</dd>';
    h+='<dt>群分类</dt><dd>'+esc(info.group_class_text||'—')
      +(info.group_tags&&info.group_tags.length?('（'+esc(info.group_tags.join('、'))+'）'):'')+'</dd>';
    h+='<dt>群成员数</dt><dd>'+esc(info.group_member_num==null?'—':String(info.group_member_num))+'</dd>';
  }
  if(state){
    var role=state.member_role==='owner'?'群主':(state.member_role==='admin'?'管理员':'普通成员');
    var recv=state.recv_msg_setting==='all'?'全部消息'
      :(state.recv_msg_setting==='mention_and_context'?'@ 及上下文':'仅 @（消息接收设置）');
    h+='<dt>机器人角色</dt><dd'+(state.member_role==='admin'||state.member_role==='owner'?' class="ok"':' class="warn"')+'>'+esc(role)+'</dd>';
    h+='<dt>机器人入群</dt><dd>'+esc(state.joined_at?fmtEntryTime(state.joined_at):'—')+'</dd>';
    h+='<dt>消息接收</dt><dd>'+esc(recv)+'</dd>';
    h+='<dt>主动推送</dt><dd>'+(state.allow_proactive_msg?'允许':'不允许')+'</dd>';
  }
  h+='</dl>';
  return h;
}

function grpModalHtml(){
  var h='<div class="modal-mask" id="grp-modal-mask" hidden>';
  h+='<div class="modal modal-sheet" role="dialog" aria-modal="true" aria-labelledby="grp-m-title">';
  h+='<div class="modal-head"><h3 id="grp-m-title">群管理</h3>';
  h+='<button class="modal-x" type="button" id="grp-modal-x" aria-label="关闭">×</button></div>';
  h+='<div class="modal-body">';
  h+='<div class="chip-label" id="grp-m-openid"></div>';
  h+='<div id="grp-m-info"><p class="muted">正在读取群资料…</p></div>';
  h+='<div class="chip-label">成员管理（官方接口，每页 30 条）</div>';
  h+='<div class="form-actions"><div class="field grow"><label for="grp-mute-mins">禁言时长</label><select id="grp-mute-mins">'
    +'<option value="10">10 分钟</option><option value="60">1 小时</option><option value="720">12 小时</option>'
    +'<option value="1440">1 天</option><option value="10080">7 天</option><option value="43200">30 天（上限）</option>'
    +'</select></div>';
  h+='<button class="btn" type="button" id="grp-members-btn">'+IX.refresh+'<span>拉取成员列表</span></button>';
  h+='<button class="btn" type="button" id="grp-members-more" hidden>下一页</button></div>';
  h+='<div class="form-actions"><div class="field grow"><label for="grp-manual-mid">手动禁言（成员列表内邀中拉不到时，直接粘贴成员 openid）</label>'
    +'<input id="grp-manual-mid" placeholder="成员 openid" maxlength="128"></div>';
  h+='<button class="btn" type="button" id="grp-manual-btn">禁言</button></div>';
  h+='<div id="grp-m-members"><p class="muted">还没拉取成员。</p></div>';
  h+='</div>';
  h+='<div class="modal-foot"><span class="hint" id="grp-m-note"></span><span class="grow"></span>';
  h+='<button class="btn" type="button" id="grp-m-close">关闭</button></div>';
  h+='</div></div>';
  return h;
}

function grpMemberRow(m){
  var role=m.member_role==='owner'?'群主':(m.member_role==='admin'?'管理员':'成员');
  var h='<div class="prov-row" data-mid="'+esc(m.member_openid||'')+'">';
  h+='<span class="prov-no">'+(m.bot?'🤖':'🙂')+'</span>';
  h+='<div class="prov-info"><b>'+esc(m.username||'(无昵称)')+'</b><small>'+esc(m.member_openid||'')+'</small></div>';
  h+='<div class="prov-meta"><span class="prov-flag '
    +(m.member_role==='admin'||m.member_role==='owner'?'on':'off')+'">'+esc(role)+'</span></div>';
  h+='<div class="prov-tools">';
  if(m.bot){
    h+='<span class="prov-flag off">机器人</span>';
  }else{
    h+='<button class="btn sm" type="button" data-mact="mute">禁言</button>';
    h+='<button class="btn sm ghost" type="button" data-mact="unmute">解除</button>';
  }
  h+='</div></div>';
  return h;
}

function renderGrpMembers(ms,append){
  var box=$('grp-m-members');
  if(!box)return;
  if(append)grpModal.members=grpModal.members.concat(ms);
  else grpModal.members=ms;
  if(!grpModal.members.length){
    box.innerHTML='<p class="muted">列表为空。</p>';
    return;
  }
  var h='<div class="prov-list">';
  for(var i=0;i<grpModal.members.length;i++)h+=grpMemberRow(grpModal.members[i]);
  h+='</div>';
  box.innerHTML=h;
}

function loadGrpMembers(cursor){
  var note=$('grp-m-note');
  if(note)note.textContent='正在拉取成员…';
  api('GET','/api/groups/members?openid='+encodeURIComponent(grpModal.openid)
    +'&cursor='+encodeURIComponent(cursor||'')).then(function(d){
    if(note)note.textContent='';
    if(!d)return;
    renderGrpMembers(d.members||[],!!cursor);
    grpModal.nextCursor=d.nextCursor||'';
    var more=$('grp-members-more');
    if(more)more.hidden=!grpModal.nextCursor;
  }).catch(function(e){
    if(note)note.textContent='';
    var msg=String(e.message||'');
    if(msg.indexOf('11253')>=0){
      var box=$('grp-m-members');
      if(box)box.innerHTML='<p class="error-text">官方对「获取群成员列表」还是内邀制（开放平台申请不到这项权限），等官方开放后这里就能用。禁言不受影响：可以直接在上方粘贴成员 openid 手动禁言。</p>';
      return;
    }
    toast(grpPermHint(e.message),'bad');
  });
}

function muteGrpMember(mid,op){
  var mins=op==='del'?0:Number(($('grp-mute-mins')||{}).value||0);
  if(op!=='del'&&!mins){toast('先选一个禁言时长','bad');return;}
  api('POST','/api/groups/mute',{openid:grpModal.openid,memberOpenid:mid,op:op,minutes:mins}).then(function(){
    toast(op==='del'?'已解除禁言':'禁言已设置','ok');
    var mi=$('grp-manual-mid');
    if(mi)mi.value='';
    loadGrpManage(grpModal.openid);
  }).catch(function(e){
    toast(grpPermHint(e.message),'bad');
  });
}

function muteGrpManual(){
  var input=$('grp-manual-mid');
  var mid=String((input&&input.value)||'').trim();
  if(!mid){toast('先粘贴成员 openid','bad');return;}
  muteGrpMember(mid,'add');
}

function onGrpMemberClick(e){
  var btn=e.target.closest('[data-mact]');
  if(!btn)return;
  var row=e.target.closest('.prov-row');
  if(!row)return;
  var mid=row.getAttribute('data-mid');
  var act=btn.getAttribute('data-mact');
  if(act==='mute')muteGrpMember(mid,'add');
  else if(act==='unmute')muteGrpMember(mid,'del');
}

function closeGrpModal(){
  var m=$('grp-modal-mask');
  if(m)m.hidden=true;
}

function bindGrpModal(){
  $('grp-modal-x').addEventListener('click',closeGrpModal);
  $('grp-m-close').addEventListener('click',closeGrpModal);
  $('grp-members-btn').addEventListener('click',function(){loadGrpMembers('');});
  $('grp-members-more').addEventListener('click',function(){loadGrpMembers(grpModal.nextCursor);});
  $('grp-manual-btn').addEventListener('click',muteGrpManual);
  $('grp-manual-mid').addEventListener('keydown',function(e){if(e.key==='Enter')muteGrpManual();});
  $('grp-m-members').addEventListener('click',onGrpMemberClick);
  var infoBox=$('grp-m-info');
  if(infoBox)infoBox.addEventListener('click',onGrpMemberClick);
  var mask=$('grp-modal-mask');
  if(mask)mask.addEventListener('click',function(e){if(e.target===mask)closeGrpModal();});
  if(!grpEscBound){
    grpEscBound=true;
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'){
        var m=$('grp-modal-mask');
        if(m&&!m.hidden)closeGrpModal();
      }
    });
  }
}

function grpMuteHtml(ms){
  var g=ms.global_rule||{};
  var mode=g.mode||'none';
  var modeTxt=mode==='always'?'全员禁言中':(mode==='schedule'?'定时/周期禁言已配置':'未开启全员禁言');
  var h='<div class="chip-label">群禁言状态（实时查询官方接口）</div>';
  h+='<dl class="dl"><dt>全员禁言</dt><dd'+(mode==='none'?'':' class="warn"')+'>'+esc(modeTxt)+'</dd>';
  var rules=0;
  if(mode==='schedule'){
    var sr=g.schedule_rules||[],rr=g.recurring_rules||[];
    for(var i=0;i<sr.length;i++)if(sr[i].enabled)rules++;
    for(var j=0;j<rr.length;j++)if(rr[j].enabled)rules++;
  }
  h+='<dt>生效规则</dt><dd>'+(mode==='schedule'?(rules+' 条启用中'):'—')+'</dd></dl>';
  var list=ms.members||[];
  if(!list.length){
    h+='<p class="muted">当前没有成员被禁言。</p>';
  }else{
    h+='<div class="prov-list">';
    for(var k=0;k<list.length;k++){
      var m=list[k];
      h+='<div class="prov-row" data-mid="'+esc(m.member_openid||'')+'">';
      h+='<span class="prov-no">🔇</span>';
      h+='<div class="prov-info"><b>'+esc(m.username||'(无昵称)')+'</b><small>禁言到期 '+esc(m.mute_expire_at?fmtEntryTime(m.mute_expire_at):'—')+'</small></div>';
      h+='<div class="prov-tools"><button class="btn sm ghost" type="button" data-mact="unmute">解除</button></div>';
      h+='</div>';
    }
    h+='</div>';
  }
  return h;
}

function loadGrpManage(openid){
  var box=$('grp-m-info');
  if(box)box.innerHTML='<p class="muted">正在读取群资料…</p>';
  return api('GET','/api/groups/manage?openid='+encodeURIComponent(openid)).then(function(d){
    var out=$('grp-m-info');
    if(!out||!d)return;
    var parts=[];
    if(d.info)parts.push(grpInfoHtml(d.info,null));
    else parts.push('<p class="error-text">群资料读取失败：'+esc(grpPermHint(d.infoError||'未知错误'))+'</p>');
    if(d.state)parts.push(grpInfoHtml(null,d.state));
    else if(d.stateError)parts.push('<p class="error-text">机器人状态读取失败：'+esc(grpPermHint(d.stateError))+'</p>');
    if(d.muteState)parts.push(grpMuteHtml(d.muteState));
    else if(d.muteError)parts.push('<p class="error-text">禁言状态读取失败：'+esc(grpPermHint(d.muteError))+'</p>');
    out.innerHTML=parts.join('');
  }).catch(function(e){
    var out=$('grp-m-info');
    if(out)out.innerHTML='<p class="error-text">'+esc(grpPermHint(e.message))+'</p>';
  });
}

function openGrpModal(openid,autoMembers){
  grpModal.openid=openid;
  grpModal.nextCursor='';
  grpModal.members=[];
  var wrap=$('wrap');
  if(!$('grp-modal-mask')){
    wrap.insertAdjacentHTML('beforeend',grpModalHtml());
    bindGrpModal();
  }
  var mask=$('grp-modal-mask');
  mask.hidden=false;
  mask.classList.add('mask-sheet');
  var oid=$('grp-m-openid');
  if(oid)oid.textContent='群 openid：'+openid;
  var mbox=$('grp-m-members');
  if(mbox)mbox.innerHTML='<p class="muted">还没拉取成员。</p>';
  var more=$('grp-members-more');
  if(more)more.hidden=true;
  var note=$('grp-m-note');
  if(note)note.textContent='';
  loadGrpManage(openid);
  if(autoMembers)loadGrpMembers('');
}

/* ============================== 定时任务 ============================== */
var remState={items:[]};

function showReminders(){
  stopStatusTimer();
  rendered=false;
  setActive('reminders');
  setTopActions('');
  setPill('定时任务','');
  $('wrap').innerHTML='<div class="card"><div class="card-head"><h3>定时任务</h3>'
    +'<span class="hint" id="rem-count"></span></div>'
    +'<p class="tip">机器人收到消息后会识别「明天 8 点提醒我开会」「10 分钟后提醒我喝水」这类请求并存到这里；到点由每分钟巡检主动发消息。'
    +'重复任务（每天 / 每周）发完自动顺延到下一次。<b>注意</b>：QQ 对主动消息有频率和配额限制，发送失败的任务会在下面标红并记入聊天记录。</p>'
    +'<div class="form-actions"><button class="btn" type="button" id="rem-refresh">'+IX.refresh+'<span>刷新</span></button></div>'
    +'<div class="prov-list" id="rem-list"><p class="muted">加载中…</p></div></div>';
  $('rem-refresh').addEventListener('click',function(){loadReminders();});
  loadReminders();
}

function loadReminders(){
  api('GET','/api/reminders').then(function(d){
    remState.items=(d&&d.items)||[];
    renderReminders();
  }).catch(function(e){
    var box=$('rem-list');
    if(box)box.innerHTML='<p class="error-text">'+esc(e.message)+'</p>';
  });
}

function remStatusHtml(status){
  var map={pending:['等待中','ok'],sending:['发送中','warn'],done:['已发送',''],failed:['发送失败','bad'],cancelled:['已取消','']};
  var s=map[status]||[status||'未知',''];
  return '<span class="pill-state'+(s[1]?' '+s[1]:'')+'"><i></i>'+esc(s[0])+'</span>';
}

function remRepeatText(rule){
  if(!rule)return '';
  if(rule==='daily')return '每天';
  var m=/^weekly:([1-7])$/.exec(String(rule));
  return m?('每周'+['','一','二','三','四','五','六','日'][Number(m[1])]):rule;
}

function renderReminders(){
  var box=$('rem-list');
  if(!box)return;
  var items=remState.items;
  var pending=0;
  for(var i=0;i<items.length;i++)if(items[i].status==='pending'||items[i].status==='sending')pending++;
  var c=$('rem-count');
  if(c)c.textContent='待发送 '+pending+' 条 / 共 '+items.length+' 条';
  if(!items.length){
    box.innerHTML='<p class="muted">还没有定时任务。在群里说「明天 8 点提醒我开会」就能创建。</p>';
    return;
  }
  var h='';
  for(var k=0;k<items.length;k++){
    var it=items[k];
    var canCancel=it.status==='pending'||it.status==='sending';
    h+='<div class="prov-row" data-rem="'+it.id+'">';
    h+='<span class="prov-no">⏰</span>';
    h+='<div class="prov-info"><b>'+esc(it.text)+'</b><small>'
      +(it.isC2C?'私聊':'群聊')+' · '+esc(it.scopeMasked||'')
      +(it.repeatRule?' · '+esc(remRepeatText(it.repeatRule)):'')
      +(it.lastError?' · <span class="error-text">'+esc(it.lastError)+'</span>':'')
      +'</small></div>';
    h+='<div class="prov-meta"><span class="prov-time">'+esc(fmtEntryTime(it.dueAt))+'</span>'+remStatusHtml(it.status)+'</div>';
    if(canCancel)h+='<div class="prov-tools"><button class="btn sm ghost" type="button" data-remcancel="'+it.id+'">取消</button></div>';
    h+='</div>';
  }
  box.innerHTML=h;
  box.onclick=function(e){
    var btn=e.target&&e.target.closest?e.target.closest('[data-remcancel]'):null;
    if(!btn)return;
    var id=Number(btn.getAttribute('data-remcancel'));
    if(!confirm('取消这条定时任务？'))return;
    api('POST','/api/reminders/cancel',{id:id}).then(function(){
      toast('已取消','ok');
      loadReminders();
    }).catch(function(err){toast(err.message,'bad');});
  };
}

/* ============================== 路由 ============================== */
// 路径路由：/status、/config、/ai、/imagegen、/groups、/workspace、/logs
// 不再用 #hash，地址栏就是干净的 /status 这种。
// 注意：不能用带 \/ 的正则字面量——ADMIN_JS 是模板字符串，\/ 会被吃成 /，
// 导致正则非法、整段脚本语法错误、页面一行 JS 都不执行（坑过一次）。
function route(){
  var p = String(location.pathname || '/').split('/').filter(function(x){ return x; });
  var tab = p.length ? p[0] : 'status';
  if(tab==='config')showConfig();
  else if(tab==='ai')showAi();
  else if(tab==='imagegen')showImageGen();
  else if(tab==='workspace')showWorkspace();
  else if(tab==='groups')showGroups();
  else if(tab==='logs')showLogs();
  else showStatus();
}

/* ============================== 启动 ============================== */
applyTheme(currentTheme());

var logoutBtn=$('logout');
if(logoutBtn)logoutBtn.addEventListener('click',function(){
  logoutBtn.disabled=true;
  api('POST','/api/auth/logout',{}).catch(function(){}).then(function(){
    location.replace('/login');
  });
});

var themeBtn=$('theme-toggle');
if(themeBtn)themeBtn.addEventListener('click',toggleTheme);

var burger=$('burger');
var side=$('side');
var mask=$('mask');
function closeSide(){
  if(side)side.classList.remove('open');
  if(mask)mask.classList.remove('show');
}
if(burger&&side){
  burger.addEventListener('click',function(){
    var open=side.classList.toggle('open');
    if(mask)mask.classList.toggle('show',open);
  });
  if(mask)mask.addEventListener('click',closeSide);
  window.addEventListener('popstate',closeSide);
}

window.addEventListener('popstate',route);
window.addEventListener('beforeunload',stopStatusTimer);
route();
`;
