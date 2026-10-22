
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
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  filter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 4 21 10 15 10"/><path d="M20.5 14a8.5 8.5 0 1 1-2-8.9L21 8"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>',
  stop:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
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
  logs:{title:'聊天记录',crumb:'数据 / 聊天记录'}
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
  if(m){m.className=cls;m.innerHTML=html;}
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

function stateOf(s){
  if(!s)return {text:'读取中',kind:''};
  if(s.fatalStop)return {text:'已停机',kind:'bad'};
  if(s.quotaWaitUntil&&s.quotaWaitUntil>Date.now())return {text:'配额等待中',kind:'warn'};
  if(s.running)return {text:'运行中',kind:'ok'};
  return {text:'已停止',kind:'bad'};
}

function banners(s){
  var now=Date.now(),out=[];
  if(s.fatalStop)out.push(['bad','已停机',s.fatalStop+'　先去 QQ 开放平台处理，再点「启动」重新尝试。']);
  if(s.quotaWaitUntil&&s.quotaWaitUntil>now){
    out.push(['warn','会话配额已用尽',
      '预计 '+fmtClock(s.quotaWaitUntil)+' 恢复（还有 '+fmtDur(s.quotaWaitUntil-now)+'）。已经停止无效重连，到点会自动起来，不需要手动操作。']);
  }
  if(!s.qqReady)out.push(['bad','QQ 凭据不完整','缺少 AppID 或 Secret。到「机器人配置」填好并保存，机器人才能连上网关。']);
  else if(!s.aiReady)out.push(['bad','AI 未配置完整','Base URL / API Key / 模型三者缺一，机器人收到了消息也回不出来。到「机器人配置」补全后保存并重启。']);
  if(s.running&&!s.tokenExpiry)out.push(['bad','Access Token 未获取','到「机器人配置」确认 AppID / Secret 与开放平台一致。']);
  else if((s.identifyFailures||0)>=5&&!(s.quotaWaitUntil&&s.quotaWaitUntil>now)){
    out.push(['warn','连续鉴权失败 '+s.identifyFailures+' 次',
      '网关持续拒绝 IDENTIFY（op9）。机器人还没上线时，到「机器人配置」把「沙箱环境」打开再试。']);
  }
  if(!s.running&&!out.length)out.push(['info','机器人已停止','点下面「启动」恢复运行。自动保活'+(s.desiredRunning?'仍在等待':'已关闭')+'。']);
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
  h+=statCard('stat-ws',IX.link,'网关连接','<span class="sk-bar sk-w50"></span>','','');
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
    +'<p class="tip"><b>会话配额统计的是登录网关的次数</b>，不是聊天条数：长连接在线、心跳、收发消息都不消耗；只有新建会话（IDENTIFY）才 +1，断线重连走 RESUME 不消耗。</p></div>';

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

  var ws=s.wsState==null?'未连接':(WS_STATE[s.wsState]||String(s.wsState));
  var lim=s.sessionLimit;
  var left=lim?(Number(lim.remaining)||0):null;
  var total=lim?(Number(lim.total)||0):null;
  var waiting=!!(s.quotaWaitUntil&&s.quotaWaitUntil>now);

  var el=$('stat-bot');
  if(el){
    el.querySelector('.stat-value').innerHTML=(s.running?'<i class="dot ok"></i>运行中':'<i class="dot bad"></i>已停止');
    el.querySelector('.stat-value').className='stat-value '+(s.running?'ok':'bad');
    el.querySelector('.stat-sub').textContent='自动保活'+(s.desiredRunning?'已开启':'已关闭')
      +(s.lastStartAt?' · 启动于 '+fmtClock(s.lastStartAt):'');
  }
  el=$('stat-ws');
  if(el){
    el.querySelector('.stat-value').innerHTML=esc(ws);
    el.querySelector('.stat-value').className='stat-value '+((s.wsState===1)?'ok':'');
    el.querySelector('.stat-sub').textContent=(s.sessionId?'会话已建立':'会话未建立')
      +' · 内存会话 '+esc(s.sessionCount==null?0:s.sessionCount)+' 个';
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
  if(hint)hint.textContent=s.desiredRunning?'自动保活已开启，断了会自己重连':'自动保活已关闭';

  var d=$('details');
  if(d){
    var wv=s.workerVersion||'';
    var dv=s.version||'';
    var sameVer=!!(wv&&dv&&wv===dv);
    var verTxt='Worker '+(wv?'v'+wv:'未上报')+' · DO '+(dv?'v'+dv:'未上报');
    if(!sameVer&&wv&&dv)verTxt+='（点「立即切换版本」可马上生效）';
    var rows=[
      ['版本',verTxt,sameVer?'ok':'warn'],
      ['运行环境',s.sandbox?'沙箱环境':'正式环境',''],
      ['API 域名',s.apiBase||'—',''],
      ['会话 ID',s.sessionId||'尚未建立（还没成功登录过）',''],
      ['活跃模型',s.aiModel||'未选择',s.aiModel?'ok':'bad'],
      ['并发上限',lim&&lim.max_concurrency?('每 5 秒 '+lim.max_concurrency+' 个会话'):'—',''],
      ['配额等待至',waiting?(fmtClock(s.quotaWaitUntil)+'（还有 '+fmtDur(s.quotaWaitUntil-now)+'）'):'无',waiting?'warn':''],
      ['连续鉴权失败',(s.identifyFailures||0)+' 次',(s.identifyFailures||0)>=5?'bad':''],
      ['最后关闭码',s.lastClose?('code='+s.lastClose.code+(s.lastClose.meaning?'　'+s.lastClose.meaning:'')+(s.lastClose.reason?'　'+s.lastClose.reason:'')+(s.lastClose.at?'　('+fmtClock(s.lastClose.at)+')':'')):'无',s.lastClose?'bad':''],
      ['停机原因',s.fatalStop||'无',s.fatalStop?'bad':'']
    ];
    var dh='';
    for(var i=0;i<rows.length;i++){
      dh+='<dt>'+esc(rows[i][0])+'</dt><dd class="'+rows[i][2]+'">'+esc(rows[i][1])+'</dd>';
    }
    d.innerHTML=dh;
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
var FIELDS=[
  {id:'qq',icon:IX.bot,title:'QQ 开放平台',desc:'QQ 机器人开放平台里的应用凭据',items:[
    {key:'appId',label:'QQ AppID',type:'text',ph:'机器人 AppID',required:true},
    {key:'secret',label:'QQ Secret',type:'password',ph:'机器人密钥',secret:true,required:true},
    {key:'sandbox',label:'沙箱环境',type:'select',options:[['0','否（正式环境）'],['1','是（沙箱环境）']],
      hint:'机器人未上线或已下架时只能连沙箱，正式环境会拒绝鉴权（关闭码 4914）'}
  ]},
  {id:'behavior',icon:IX.chat,title:'对话行为',desc:'回复方式与上下文长度',items:[
    {key:'systemPrompt',label:'系统提示词',type:'textarea',ph:'你是一个友好、靠谱的 QQ 机器人助手……',wide:true},
    {key:'historyLimit',label:'历史消息条数',type:'number',ph:'20',hint:'每次对话携带的上下文条数，1 ~ 100'},
    {key:'markdownReply',label:'Markdown 回复',type:'select',options:[['0','关（纯文本）'],['1','开（标题/列表/加粗等生效）']],
      hint:'AI 回复含标题、列表、加粗、链接时按 Markdown 发送，排版更好；纯文本回复不受影响'},
    {key:'autoRecall',label:'AI 故障自动撤回',type:'select',options:[['0','关'],['1','开']],
      hint:'AI 全部不可用时，自动撤回上一条机器人回复，避免留下「没答上来」的消息'}
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
    for(var i=0;i<FIELDS[s].items.length;i++)keys.push(FIELDS[s].items[i].key);
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
  var h='';
  for(var s=0;s<FIELDS.length;s++){
    var sec=FIELDS[s];
    h+='<div class="form-section"><div class="fs-head"><span class="fs-ico">'+sec.icon+'</span>'
      +'<div><h3>'+esc(sec.title)+'</h3><p>'+esc(sec.desc)+'</p></div>'
      +'<span class="fs-state" id="fs-'+sec.id+'"></span></div><div class="fs-body"><div class="grid">';
    for(var i=0;i<sec.items.length;i++)h+=fieldHtml(sec.items[i],cfg,conf);
    h+='</div></div></div>';
  }
  // 照 user.html：按钮直接放在表单末尾，没有 sticky 悬浮栏、没有常驻状态文字
  h+='<div class="form-actions">'
    +'<button class="btn" id="b-save" type="button">'+IX.check+'<span>保存配置</span></button>'
    +'<button class="btn primary" id="b-save-restart" type="button">'+IX.refresh+'<span>保存并重启</span></button></div>';
  $('wrap').innerHTML=h;

  $('b-save').addEventListener('click',function(){saveConfig(false);});
  $('b-save-restart').addEventListener('click',function(){saveConfig(true);});

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

/** 每个分组的右上角显示「已填写 n/m」，一眼看出还差什么 */
function updateSectionStates(){
  for(var s=0;s<FIELDS.length;s++){
    var sec=FIELDS[s];
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

/* ============================== 聊天记录 ============================== */
var LOG_PAGE_SIZE=20;
var LOG_KINDS=[['all','全部'],['group','群聊'],['c2c','私聊'],['system','系统']];
var logState={page:1,kind:'all'};

function entryHtml(it){
  if(it.kind==='system'){
    return '<article class="entry kind-system"><div class="entry-body">'
      +'<div class="sys-line"><span class="sys-ico">⚙️</span><span class="sys-text">'+esc(it.userContent)+'</span></div>'
      +'</div><div class="entry-head"><span class="tag sys">系统</span>'
      +'<span class="time">'+esc(fmtEntryTime(it.time))+'</span></div></article>';
  }
  var c2c=it.kind==='c2c';
  var h='<article class="entry">';
  h+='<div class="entry-head">';
  h+='<span class="tag '+(c2c?'c2c':'group')+'">'+(c2c?'私聊':'群聊')+'</span>';
  h+='<span class="scope" title="会话标识已脱敏">#'+esc(it.scopeId||'')+'</span>';
  if(it.model)h+='<span class="tag model" title="'+esc(it.model)+'">'+esc(it.model)+'</span>';
  h+='<span class="time">'+esc(fmtEntryTime(it.time))+'</span>';
  h+='</div><div class="entry-body">';
  h+='<div class="bubble-row user"><span class="who">问</span><span class="bubble-text">'+esc(it.userContent)+'</span></div>';
  h+='<div class="bubble-row ai"><span class="who">答</span><span class="bubble-text">'+esc(it.aiReply)+'</span></div>';
  h+='</div></article>';
  return h;
}

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

/* 本地预览示例数据：只在 127.0.0.1 / localhost 显示，部署后永远是真实记录 */
function isLocalPreview(){
  var h=location.hostname;
  return h==='127.0.0.1'||h==='localhost';
}
function demoItems(){
  var now=Date.now();
  function ago(min){return new Date(now-min*60000).toISOString();}
  return [
    {kind:'group',scopeId:'a3f8…9c21',userContent:'帮我画一只橘猫，水彩风格',aiReply:'[图片] 已生成 🖼',model:'生图 · qwen-image-3.0-pro',time:ago(3)},
    {kind:'group',scopeId:'a3f8…9c21',userContent:'今天上海天气怎么样？',aiReply:'今天上海多云，18～24℃，出门带件薄外套比较稳妥。',model:'DeepSeek · deepseek-chat',time:ago(16)},
    {kind:'system',scopeId:'system',userContent:'AI「DeepSeek」调用失败（HTTP 429），自动尝试下一个备用',time:ago(24)},
    {kind:'c2c',scopeId:'b91c…44da',userContent:'用一句话介绍你自己',aiReply:'我是跑在 Cloudflare 上的 AI 助手，随叫随到～',model:'DeepSeek · deepseek-chat',time:ago(47)},
    {kind:'group',scopeId:'77c0…12ab',userContent:'翻译成中文：Good things take time',aiReply:'好东西都需要时间沉淀。',model:'智谱 GLM · glm-4-flash',time:ago(88)},
    {kind:'system',scopeId:'system',userContent:'新成员加入群聊，已自动发送欢迎语',time:ago(150)},
    {kind:'c2c',scopeId:'e55b…90cc',userContent:'写一句生日祝福，要押韵',aiReply:'生日快乐笑开颜，岁岁平安福满天！',model:'DeepSeek · deepseek-chat',time:ago(1500)},
    {kind:'system',scopeId:'system',userContent:'后台修改配置，已热更新生效',time:ago(1620)}
  ];
}
function demoLogsHtml(){
  var items=demoItems();
  var h='<div class="demo-note">本地预览：下面是示例数据，部署到 Cloudflare 后这里显示真实聊天记录</div><div class="entries">';
  var prevDay='';
  for(var i=0;i<items.length;i++){
    var day=(items[i].time||'').slice(0,10);
    if(day&&day!==prevDay){h+=daySepHtml(items[i].time);prevDay=day;}
    h+=entryHtml(items[i]);
  }
  h+='</div>';
  return h;
}

function emptyHtml(){
  var kind=logState.kind;
  var title='还没有聊天记录';
  var desc='机器人回复第一条消息后，问答会成对记录在这里，最多保留最近 2000 条。';
  if(kind==='group'){title='还没有群聊记录';desc='在群里 @ 机器人提问之后，这里就会出现记录。';}
  if(kind==='c2c'){title='还没有私聊记录';desc='私聊机器人提问之后，这里就会出现记录。';}
  if(kind==='system'){title='还没有系统消息';desc='配置更新、AI 自动切换、入群欢迎等事件会记录在这里。';}
  return '<div class="empty"><span class="empty-ico">'+IX.chat+'</span><b>'+title+'</b><p>'+desc+'</p>'
    +'<div class="btn-row"><a class="btn" href="#status">去看看运行状态'+IX.arrow+'</a></div></div>';
}

function logShell(){
  var h='<div class="toolbar"><div class="seg" id="log-kind">';
  for(var i=0;i<LOG_KINDS.length;i++){
    h+='<button type="button" data-kind="'+LOG_KINDS[i][0]+'"'+(logState.kind===LOG_KINDS[i][0]?' class="active"':'')
      +'><span>'+LOG_KINDS[i][1]+'</span><span class="seg-n" data-k="'+LOG_KINDS[i][0]+'"></span></button>';
  }
  h+='</div>';
  h+='<button class="btn sm" id="b-refresh" type="button">'+IX.refresh+'<span>刷新</span></button>';
  h+='<button class="btn sm danger" id="b-clear" type="button">'+IX.trash+'<span>清空全部</span></button>';
  h+='<span class="count" id="log-count">读取中…</span></div>';
  h+='<div id="log-list"></div>';
  h+='<div class="pager" id="log-pager"></div>';
  return h;
}

function paintKindCounts(counts){
  var seg=$('log-kind');
  if(!seg||!counts)return;
  var ns=seg.querySelectorAll('.seg-n');
  for(var i=0;i<ns.length;i++){
    var k=ns[i].getAttribute('data-k');
    var n=counts[k];
    ns[i].textContent=n?' '+n:'';
  }
}

function paintPager(d){
  var el=$('log-pager');
  if(!el)return;
  if(!d.totalPages||d.totalPages<=1){el.innerHTML='';return;}
  el.innerHTML='<button class="btn sm" id="pg-prev" type="button"'+(d.page<=1?' disabled':'')+'>上一页</button>'
    +'<span class="pg-info">第 '+d.page+' / '+d.totalPages+' 页</span>'
    +'<button class="btn sm" id="pg-next" type="button"'+(d.page>=d.totalPages?' disabled':'')+'>下一页</button>';  var prev=$('pg-prev'),next=$('pg-next');
  if(prev)prev.addEventListener('click',function(){showLogs(d.page-1);});
  if(next)next.addEventListener('click',function(){showLogs(d.page+1);});
}

function loadLogs(page){
  var list=$('log-list');
  if(!list)return Promise.resolve();
  logState.page=Math.max(1,Number(page)||1);
  list.innerHTML=skeletonLogs();
  var count=$('log-count');
  if(count)count.textContent='读取中…';
  return api('GET','/api/logs?page='+logState.page+'&pageSize='+LOG_PAGE_SIZE+'&kind='+logState.kind)
    .then(function(d){
      if(!d)return;
      logState.page=d.page;
      paintKindCounts(d.kindCounts);
      if(!d.items.length&&isLocalPreview()){
        list.innerHTML=demoLogsHtml();
        if(count)count.textContent='示例数据（本地预览）';
        var nav2=$('nav-count');
        if(nav2)nav2.textContent='示例';
        paintPager({page:1,totalPages:1});
        return;
      }
      if(!d.items.length){
        list.innerHTML=emptyHtml();
      }else{
        var h='<div class="entries">';
        var prevDay='';
        for(var i=0;i<d.items.length;i++){
          var day=(d.items[i].time||'').slice(0,10);
          if(day&&day!==prevDay){h+=daySepHtml(d.items[i].time);prevDay=day;}
          h+=entryHtml(d.items[i]);
        }
        h+='</div>';
        list.innerHTML=h;
      }
      if(count)count.textContent='共 '+d.total+' 条';
      var nav=$('nav-count');
      if(nav)nav.textContent=d.total>999?'999+':String(d.total);
      paintPager(d);
    })
    .catch(function(e){
      list.innerHTML='<div class="empty"><span class="empty-ico">'+IX.alert+'</span><b>读取失败</b><p>'+esc(e.message)+'</p></div>';
      if(count)count.textContent='—';
    });
}

function showLogs(page){
  stopStatusTimer();
  rendered=false;
  setActive('logs');
  setTopActions('');
  setPill('聊天记录','');
  var wrap=$('wrap');
  if(!$('log-list')){
    wrap.innerHTML=logShell();
    $('b-refresh').addEventListener('click',function(){loadLogs(logState.page);});
    $('b-clear').addEventListener('click',clearLogs);
    var seg=$('log-kind');
    var btns=seg.querySelectorAll('button');
    for(var i=0;i<btns.length;i++){
      btns[i].addEventListener('click',function(){
        logState.kind=this.getAttribute('data-kind');
        for(var j=0;j<btns.length;j++)btns[j].className=(btns[j]===this?'active':'');
        loadLogs(1);
      });
    }
  }
  return loadLogs(page||logState.page);
}

function clearLogs(){
  if(!confirm('确定清空所有聊天记录？此操作不可撤销。'))return;
  api('POST','/api/logs/clear',{}).then(function(d){
    toast('已清空 '+(d&&d.deleted!=null?d.deleted:0)+' 条记录','ok');
    return loadLogs(1);
  }).catch(function(e){toast(e.message,'bad');});
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
  h+='<div class="prov-meta">'+keyFlag
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
      model:(preset&&preset.model)||'',temperature:'0.8',enabled:1,hasKey:false,models:[]};
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
      temperature:p.temperature,enabled:p.enabled});
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
        temperature:p.temperature,enabled:p.enabled?1:0,hasKey:!!p.hasKey,models:[]};
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
    ?msg+'（官方白名单接口：需要到 QQ 开放平台申请「群管理」接口权限）'
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
  h+='<dt>成员管理</dt><dd>弹窗里点「拉取成员列表」（每页 30 条，可翻页），选中时长后可对成员禁言或解除禁言；机器人需要群管理员身份，最长 30 天</dd>';
  h+='<dt>权限</dt><dd>群资料 / 成员 / 禁言都是官方白名单接口，报 code=11253 说明机器人还没拿到权限，去 QQ 开放平台申请即可</dd>';
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
  h+='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="grp-m-title">';
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
    toast(grpPermHint(e.message),'bad');
  });
}

function muteGrpMember(mid,op){
  var mins=op==='del'?0:Number(($('grp-mute-mins')||{}).value||0);
  if(op!=='del'&&!mins){toast('先选一个禁言时长','bad');return;}
  api('POST','/api/groups/mute',{openid:grpModal.openid,memberOpenid:mid,op:op,minutes:mins}).then(function(){
    toast(op==='del'?'已解除禁言':'禁言已设置','ok');
  }).catch(function(e){
    toast(grpPermHint(e.message),'bad');
  });
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
  $('grp-m-members').addEventListener('click',onGrpMemberClick);
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
  var oid=$('grp-m-openid');
  if(oid)oid.textContent='群 openid：'+openid;
  var infoBox=$('grp-m-info');
  if(infoBox)infoBox.innerHTML='<p class="muted">正在读取群资料…</p>';
  var mbox=$('grp-m-members');
  if(mbox)mbox.innerHTML='<p class="muted">还没拉取成员。</p>';
  var more=$('grp-members-more');
  if(more)more.hidden=true;
  var note=$('grp-m-note');
  if(note)note.textContent='';
  api('GET','/api/groups/manage?openid='+encodeURIComponent(openid)).then(function(d){
    var box=$('grp-m-info');
    if(!box||!d)return;
    var parts=[];
    if(d.info)parts.push(grpInfoHtml(d.info,null));
    else parts.push('<p class="error-text">群资料读取失败：'+esc(grpPermHint(d.infoError||'未知错误'))+'</p>');
    if(d.state)parts.push(grpInfoHtml(null,d.state));
    else if(d.stateError)parts.push('<p class="error-text">机器人状态读取失败：'+esc(grpPermHint(d.stateError))+'</p>');
    box.innerHTML=parts.join('');
  }).catch(function(e){
    var box=$('grp-m-info');
    if(box)box.innerHTML='<p class="error-text">'+esc(grpPermHint(e.message))+'</p>';
  });
  if(autoMembers)loadGrpMembers('');
}

/* ============================== 路由 ============================== */
function route(){
  var tab=(location.hash||'#status').slice(1);
  if(tab==='config')showConfig();
  else if(tab==='ai')showAi();
  else if(tab==='imagegen')showImageGen();
  else if(tab==='groups')showGroups();
  else if(tab==='logs')showLogs(1);
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
  window.addEventListener('hashchange',closeSide);
}

window.addEventListener('hashchange',route);
window.addEventListener('beforeunload',stopStatusTimer);
route();
`;
