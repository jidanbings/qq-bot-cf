
export const ADMIN_JS = `
var confirmState={el:null,resolve:null,lastFocus:null,onKey:null,finishing:false};

function confirmDialog(opts){
  opts=opts||{};
  if(confirmState.el)settleConfirm(false);

  var title=opts.title||'确认操作';
  var message=opts.message||'';
  var detail=opts.detail||'';
  var okText=opts.confirm||'确定';
  var noText=opts.cancel||'取消';
  var danger=!!opts.danger;

  var lastFocus=document.activeElement;

  var mask=document.createElement('div');
  mask.className='modal-mask confirm-mask';
  mask.setAttribute('role','presentation');

  var box=document.createElement('div');
  box.className='modal confirm'+(danger?' danger':'');
  box.setAttribute('role','dialog');
  box.setAttribute('aria-modal','true');
  box.setAttribute('aria-labelledby','cf-title');
  if(detail)box.setAttribute('aria-describedby','cf-detail');

  var head=document.createElement('div');
  head.className='confirm-head';
  var ico=document.createElement('span');
  ico.className='confirm-ico';
  ico.innerHTML=danger?IX.alert:IX.info;
  var h3=document.createElement('h3');
  h3.id='cf-title';
  h3.textContent=title;
  head.appendChild(ico);
  head.appendChild(h3);

  var body=document.createElement('div');
  body.className='confirm-body';
  var p=document.createElement('p');
  p.className='confirm-msg';
  p.textContent=message;
  body.appendChild(p);
  if(detail){
    var d=document.createElement('p');
    d.className='confirm-detail';
    d.id='cf-detail';
    d.textContent=detail;
    body.appendChild(d);
  }

  var foot=document.createElement('div');
  foot.className='confirm-foot';
  var cancelBtn=document.createElement('button');
  cancelBtn.type='button';
  cancelBtn.className='btn';
  cancelBtn.id='cf-cancel';
  cancelBtn.textContent=noText;

  var okBtn=document.createElement('button');
  okBtn.type='button';
  okBtn.className='btn '+(danger?'danger-solid':'primary');
  okBtn.id='cf-ok';
  okBtn.textContent=okText;

  foot.appendChild(cancelBtn);
  foot.appendChild(okBtn);
  box.appendChild(head);
  box.appendChild(body);
  box.appendChild(foot);
  mask.appendChild(box);
  document.body.appendChild(mask);

  var onKey=function(e){
    if(!confirmState.el)return;
    if(e.key==='Escape'){
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  };

  function finish(result){
    if(confirmState.finishing)return;
    confirmState.finishing=true;
    document.removeEventListener('keydown',onKey,true);
    if(mask.parentNode)mask.parentNode.removeChild(mask);
    confirmState.el=null;
    confirmState.onKey=null;
    var res=confirmState.resolve;
    confirmState.resolve=null;
    confirmState.finishing=false;
    if(lastFocus&&lastFocus.focus&&document.contains(lastFocus)){
      try{lastFocus.focus();}catch(e){}
    }
    if(typeof res==='function')res(!!result);
  }

  cancelBtn.addEventListener('click',function(){finish(false);});
  okBtn.addEventListener('click',function(){finish(true);});
  mask.addEventListener('click',function(e){
    if(e.target===mask)finish(false);
  });

  document.addEventListener('keydown',onKey,true);

  confirmState.el=mask;
  confirmState.onKey=onKey;

  (danger?cancelBtn:okBtn).focus();

  return new Promise(function(resolve){
    confirmState.resolve=resolve;
  });
}

function settleConfirm(result){
  if(!confirmState.el)return false;
  var btn=confirmState.el.querySelector(result?'#cf-ok':'#cf-cancel');
  if(btn){btn.click();return true;}
  return false;
}

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
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>',
  chevDown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
};

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
function fmtEntryTime(iso){
  var d=new Date(iso);
  if(isNaN(d.getTime()))return String(iso||'').replace('T',' ').slice(0,19);
  return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+' '+pad2(d.getHours())+':'+pad2(d.getMinutes());
}

var META={
  status:{title:'运行状态',crumb:'概览 / 运行状态'},
  config:{title:'机器人配置',crumb:'设置 / 机器人配置'},
  ai:{title:'AI 模型',crumb:'设置 / AI 模型'},
  groups:{title:'工作区',crumb:'管理 / 工作区'},
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
  if(m){m.className=cls+' m-state';m.innerHTML=html;}
}

function setTopActions(html){
  var box=$('top-actions');
  if(box)box.innerHTML=html||'';
}

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

var WS_STATE={0:'连接中',1:'已连接',2:'关闭中',3:'已关闭'};
var statusTimer=null;
var autoRefresh=true;
try{ autoRefresh=localStorage.getItem('botAutoRefresh')!=='0'; }catch(e){}

var S={};
var rendered=false;
var TRANSPORT_MODE='';// 配置页里显式保存的事件接收方式（webhook / ws，空=自动）
var CUR_APPID='';
var CUR_WEBHOOK_VERIFIED=false;
var CUR_LAST_EVENT_AT=0;
var CUR_PLATFORM_MODE='';

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
  else if(!s.aiReady)out.push(['bad','AI 未配置完整','Base URL / API Key / 模型三者缺一，机器人收到了消息也回不出来。到「AI 模型」补全后保存即可，不用重启。']);
  if(isWs&&s.running&&!s.tokenExpiry)out.push(['bad','Access Token 未获取','到「机器人配置」确认 AppID / Secret 与开放平台一致。']);
  else if(isWs&&(s.identifyFailures||0)>=5&&!(s.quotaWaitUntil&&s.quotaWaitUntil>now)){
    out.push(['warn','连续鉴权失败 '+s.identifyFailures+' 次',
      '网关持续拒绝 IDENTIFY（op9）。机器人还没上线时，到「机器人配置」把「沙箱环境」打开再试。']);
  }
  if(!s.running&&!out.length)out.push(['info',isWs?'机器人已停止':'机器人已停用',
    isWs?'点下面「启动」恢复运行。自动保活'+(s.desiredRunning?'仍在等待':'已关闭')+'。'
        :'点下面「启动」恢复接收消息。']);
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

function skListSkeleton(n){
  var h='';
  for(var i=0;i<n;i++){
    h+='<div class="prov-row sk-row-item">'
      +'<span class="sk-block sk-no"></span>'
      +'<div class="prov-info"><span class="sk-bar sk-w30"></span><span class="sk-bar sk-w50"></span></div>'
      +'</div>';
  }
  return h;
}

function convSkeleton(n){
  var h='';
  for(var i=0;i<n;i++){
    h+='<div class="conv sk-conv">'
      +'<span class="sk-block sk-conv-av"></span>'
      +'<div class="conv-main"><span class="sk-bar sk-w40"></span><span class="sk-bar sk-w70"></span></div>'
      +'</div>';
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


function qqDevSettingsUrl(appId){
  var id=String(appId||'').replace(/[^0-9]/g,'');
  return 'https://q.qq.com/qqbot/dashboard/manage/'+id+'?sec=dev-settings';
}

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

  h+='<div class="tp-actions">';
  if(appId){
    h+='<a class="btn primary" href="'+esc(devUrl)+'" target="_blank" rel="noopener noreferrer">'
      +IX.link+'<span>去 QQ 开放平台修改</span></a>';
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

function menuBlockHtml(){
  return '<p class="tip">菜单最多 10 项，名称不超过 10 个字符（一个汉字算 2 个）。'
    +'类型：<b>发送消息</b> 点击把文字填进输入框，<b>跳转链接</b> 打开网页（必须 https）。'
    +'改完用户重进会话才能看到。</p>'
    +'<div id="menu-editor"><p class="muted">读取中…</p></div>';
}

// 内置提示词（人设）库：点击填入系统提示词输入框。
// 每个条目是一套完整的 system prompt，覆盖常见使用场景。
var PROMPT_PRESETS = [
  {
    id: 'friendly',
    label: '友好助手',
    desc: '默认人设，热情友好、简洁自然',
    text: '你是一个友好、靠谱、乐于助人的 QQ 机器人助手。回答保持简洁、自然、口语化，用中文交流。遇到不确定的问题如实说明，不编造。',
  },
  {
    id: 'cat',
    label: '可爱猫娘',
    desc: '喵系萌宠，语气俏皮可爱',
    text: '你是一只可爱的猫娘助手，说话带一点「喵」的口癖，语气软萌俏皮、活泼可爱。用中文交流，回答可以卖萌但也要靠谱，别为了可爱丢掉准确性。',
  },
  {
    id: 'tech',
    label: '技术专家',
    desc: '严谨专业，代码和技术问题深入解答',
    text: '你是一位资深技术专家，擅长编程、系统设计、运维等技术领域。回答严谨、专业、结构清晰，代码要给出可运行示例并解释关键点。用中文交流，技术术语可保留英文原文。',
  },
  {
    id: 'teacher',
    label: '学习导师',
    desc: '耐心讲解，循循善诱帮助学习',
    text: '你是一位耐心的学习导师，擅长用通俗易懂的方式讲解知识。回答时分步骤拆解，先讲清概念再举例，鼓励用户思考。根据用户水平调整深度，避免一下子倒太多。用中文交流。',
  },
  {
    id: 'funny',
    label: '幽默段子手',
    desc: '风趣幽默，聊天气氛活跃',
    text: '你是一个幽默风趣的聊天机器人，擅长接梗、讲段子、活跃气氛。回答轻松有趣，适当使用网络流行语和表情，但不要过度油腻。该认真的时候也能认真。用中文交流。',
  },
  {
    id: 'translator',
    label: '翻译助手',
    desc: '中英互译，翻译准确地道',
    text: '你是一位专业的翻译助手，擅长中英文互译。翻译要准确、地道、符合目标语言习惯，必要时给出直译与意译两种版本。用户发来非中文内容时默认翻译成中文，反之译成英文。',
  },
  {
    id: 'writer',
    label: '写作助手',
    desc: '文案、文章、创作润色',
    text: '你是一位写作助手，擅长撰写和润色各种文本：文案、故事、文章、邮件、报告等。行文流畅，逻辑清晰，能根据用户要求调整风格和长度。先问清需求再动笔，不确定的地方主动确认。用中文交流。',
  },
  {
    id: 'concise',
    label: '极简回复',
    desc: '一句话说清，绝不啰嗦',
    text: '你是一个极简风格的助手，回答尽量用一句话或几个短语说清要点，绝不啰嗦、不铺陈。用户要详细展开时再展开。用中文交流。',
  },
  {
    id: 'creative',
    label: '创意脑洞',
    desc: '天马行空，擅长灵感发散',
    text: '你是一个充满创意的脑洞助手，擅长头脑风暴、灵感发散、给出各种意想不到的点子。回答可以大胆、新奇、跳跃，多给几个不同方向的方案供用户挑选。用中文交流。',
  },
];

var FIELDS=[
  {id:'qq',icon:IX.bot,title:'QQ 开放平台',desc:'QQ 机器人开放平台里的应用凭据',items:[
    {key:'appId',label:'QQ AppID',type:'text',ph:'机器人 AppID',required:true},
    {key:'secret',label:'QQ Secret',type:'password',ph:'机器人密钥',secret:true,required:true},
    {key:'sandbox',label:'沙箱环境',type:'select',narrow:true,options:[['0','否（正式环境）'],['1','是（沙箱环境）']],
      hint:'机器人未上线或已下架时只能连沙箱，正式环境会拒绝鉴权（关闭码 4914）'}
  ]},
  {id:'transport',icon:IX.link,title:'事件接收方式',desc:'决定机器人怎么收到 QQ 的消息，直接影响计费',custom:transportCards},
  {id:'behavior',icon:IX.chat,title:'对话行为',desc:'回复方式与上下文长度',items:[
    {key:'systemPrompt',label:'系统提示词',type:'textarea',ph:'你是一个友好、靠谱的 QQ 机器人助手……',wide:true,
      preset:true,required:true,
      hint:'必填。可选用下方内置人设，或直接自己写。'},
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
  {id:'menu',icon:IX.spark,title:'自定义菜单',
    desc:'QQ 聊天窗口左下角那个菜单，用户点开就能看到',custom:menuBlockHtml},
  {id:'filter',icon:IX.filter,title:'过滤',desc:'命中即丢弃，机器人不会回复',items:[
    {key:'groupBlacklist',label:'群黑名单',type:'textarea',ph:'group_openid1, group_openid2',wide:true,hint:'多个用逗号分隔，只对群聊生效'},
    {key:'sensitiveWords',label:'敏感词',type:'textarea',ph:'词1, 词2',wide:true,hint:'多个用逗号分隔，消息里出现任意一个就不会回复'}
  ]}
];

function sectionKeys(secId){
  var keys=[];
  for(var s=0;s<FIELDS.length;s++){
    var sec=FIELDS[s];
    if(sec.custom)continue;
    if(secId&&sec.id!==secId)continue;
    var items=sec.items||[];
    for(var i=0;i<items.length;i++)keys.push(items[i].key);
  }
  return keys;
}

function fieldHtml(f,cfg,conf){
  var v=cfg[f.key]==null?'':String(cfg[f.key]);
  var ph=f.ph||'';
  if(f.secret&&conf[f.key])ph='已设置，留空表示不修改';
  var h='<div class="field'+(f.wide?' wide':'')+'">';
  var labelFor=(f.type==='select')?'selt_'+f.key:'cf_'+f.key;
  h+='<label for="'+labelFor+'">'+esc(f.label)
    +(f.required&&!(f.secret&&conf[f.key])?'<span class="req-flag">必填</span>':'')
    +(f.secret&&conf[f.key]?'<span class="req-flag">已设置</span>':'')+'</label>';
  if(f.type==='textarea'){
    h+='<textarea id="cf_'+f.key+'" placeholder="'+esc(ph)+'" rows="3">'+esc(v)+'</textarea>';
    if(f.preset&&f.key==='systemPrompt'){
      h+='<div class="prompt-presets" id="pp-'+f.key+'">';
      for(var pi=0;pi<PROMPT_PRESETS.length;pi++){
        var pp=PROMPT_PRESETS[pi];
        h+='<button class="chip" type="button" data-pp="'+esc(pp.id)+'" title="'+esc(pp.desc)+'">'+esc(pp.label)+'</button>';
      }
      h+='</div>';
    }
  }else if(f.type==='select'){
    // Custom select: a hidden native select keeps the value (collectConfig still
    // reads its .value); the visible trigger/menu are built by selHtml() below.
    h+=selHtml(f.key,v,f.options,{narrow:f.narrow});
  }else if(f.type==='password'){
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

// Reusable custom-select markup. Kept separate so every native <select> on the
// page (config fields, menu editor "type", AI modal "model/vision", group modal
// "mute") can render the same safe dropdown instead of the browser default.
// opts: {narrow:bool, nativeId:'...', nativeAttrs:' name="x" data-mf="y"'}
function selHtml(key,value,options,opts){
  opts=opts||{};
  var nativeId=opts.nativeId||('cf_'+key);
  var nativeAttrs=opts.nativeAttrs||'';
  var h='<div class="sel'+(opts.narrow?' sel-narrow':'')+'" id="sel_'+key+'" data-key="'+esc(key)+'">';
  h+='<button class="sel-trigger" type="button" id="selt_'+key+'" aria-haspopup="listbox" aria-expanded="false">'
    +'<span class="sel-label" id="sell_'+key+'"></span>'
    +'<span class="sel-arrow">'+IX.chevDown+'</span></button>';
  h+='<div class="sel-menu" id="selm_'+key+'" role="listbox" hidden>';
  for(var i=0;i<options.length;i++){
    var ov=options[i][0];
    h+='<button class="sel-opt" type="button" role="option" data-val="'+esc(ov)+'"'
      +(String(value)===String(ov)?' aria-selected="true"':'')+'>'+esc(options[i][1])+'</button>';
  }
  h+='</div>';
  h+='<select id="'+nativeId+'"'+nativeAttrs+' hidden aria-hidden="true">';
  for(var j=0;j<options.length;j++){
    var ov2=options[j][0];
    h+='<option value="'+esc(ov2)+'"'+(String(value)===String(ov2)?' selected':'')+'>'+esc(options[j][1])+'</option>';
  }
  h+='</select>';
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
    h+='<div class="form-section fs-sec-'+esc(sec.id)+'"><div class="fs-head"><span class="fs-ico">'+sec.icon+'</span>'
      +'<div><h3>'+esc(sec.title)+'</h3><p>'+esc(sec.desc)+'</p></div>'
      +'<span class="fs-state" id="fs-'+sec.id+'"></span></div><div class="fs-body">';
    if(sec.custom){
      h+=sec.custom();
    }else{
      h+='<div class="grid">';
      for(var i=0;i<sec.items.length;i++)h+=fieldHtml(sec.items[i],cfg,conf);
      h+='</div>';
      h+='<div class="fs-foot">'
        +'<span class="fs-foot-note">保存即热更新，无需重启</span>'
        +'<button class="btn primary" id="b-sec-save-'+sec.id+'" type="button" data-sec="'+sec.id+'">'
        +IX.check+'<span>保存</span></button></div>';
    }
    h+='</div></div>';
  }
  $('wrap').innerHTML=h;

  var secBtns=document.querySelectorAll('[data-sec]');
  for(var sb=0;sb<secBtns.length;sb++){
    secBtns[sb].addEventListener('click',function(){
      saveSection(this.getAttribute('data-sec'),this);
    });
  }

  bindTransportCards();
  // 自定义菜单是独立接口（/v2/menu），不跟 config 一起提交，单独异步加载
  if($('menu-editor'))loadMenuEditor();
  bindPromptPresets();

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
  bindSelects();
  updateSectionStates();
  setTopActions('');
}

// Custom select: open/close/select/keyboard/click-outside live here.
// Safety: option text is escaped then set via textContent (never innerHTML);
// the chosen value is stored in the hidden native select, so collectors stay unchanged.
// bindSel(root) binds every .sel inside root (a DOM node, default document),
// so modals and re-rendered menu rows can share the exact same component.
var selOpenKey=null;
var selOuterBound=false;

function bindSel(root){
  root=root||document;
  var sels=root.querySelectorAll?root.querySelectorAll('.sel'):[];
  for(var i=0;i<sels.length;i++){
    // IIFE captures each select's own refs; without it every handler shares
    // the loop's var and would open the last dropdown no matter what you click.
    (function(){
      var sel=sels[i];
      var key=sel.getAttribute('data-key');
      var trigger=$('selt_'+key);
      var menu=$('selm_'+key);
      var native=sel.querySelector?sel.querySelector('select'):null;
      var label=$('sell_'+key);
      if(!trigger||!menu||!native||!label)return;

      // init: show the current value's label text
      syncSelLabel(label,native,menu);

      trigger.addEventListener('click',function(e){
        e.stopPropagation();
        if(selOpenKey===key){closeSel();return;}
        closeSel();
        selOpenKey=key;
        menu.hidden=false;
        trigger.setAttribute('aria-expanded','true');
      });

      var opts=menu.querySelectorAll('.sel-opt');
      for(var o=0;o<opts.length;o++){
        opts[o].addEventListener('click',function(){
          var val=this.getAttribute('data-val');
          native.value=val;
          syncSelLabel(label,native,menu);
          // fire a native change event so markDirty / row handlers run
          if(native.dispatchEvent){
            var ev;
            try{ev=new Event('change',{bubbles:true});}catch(e2){ev=document.createEvent('Event');ev.initEvent('change',true,false);}
            native.dispatchEvent(ev);
          }
          closeSel();
        });
      }
    })();
  }
  // Click-outside close: the trigger's click calls stopPropagation, so it never
  // reaches here; an option click selects first, then reaches here; any other
  // click on the page just closes the open menu.
  if(!selOuterBound){
    selOuterBound=true;
    document.addEventListener('click',function(){
      closeSel();
    });
  }
}

function bindSelects(){
  bindSel(document);
}

function syncSelLabel(label,native,menu){
  if(!label||!native)return;
  var val=native.value;
  if(!menu)return;
  var opts=menu.querySelectorAll('.sel-opt');
  var text=val;
  for(var i=0;i<opts.length;i++){
    if(opts[i].getAttribute('data-val')===val){
      text=opts[i].textContent;
      break;
    }
  }
  label.textContent=text;
  // sync aria-selected
  for(var j=0;j<opts.length;j++){
    var isSel=opts[j].getAttribute('data-val')===val;
    if(isSel)opts[j].setAttribute('aria-selected','true');
    else opts[j].removeAttribute('aria-selected');
  }
}

function closeSel(){
  if(!selOpenKey)return;
  var t=$('selt_'+selOpenKey);
  var m=$('selm_'+selOpenKey);
  if(t)t.setAttribute('aria-expanded','false');
  if(m)m.hidden=true;
  selOpenKey=null;
}

function markDirty(){
  updateSectionStates();
}

// 内置提示词：点按钮把对应人设写进系统提示词输入框（不覆盖用户已写的内容，先提示确认）
function bindPromptPresets(){
  var box=$('pp-systemPrompt');
  if(!box)return;
  var ta=$('cf_systemPrompt');
  box.addEventListener('click',function(e){
    var chip=e.target&&e.target.closest?e.target.closest('[data-pp]'):null;
    if(!chip||!ta)return;
    var id=chip.getAttribute('data-pp');
    var preset=null;
    for(var i=0;i<PROMPT_PRESETS.length;i++)if(PROMPT_PRESETS[i].id===id)preset=PROMPT_PRESETS[i];
    if(!preset)return;
    var cur=ta.value.trim();
    if(cur){
      confirmDialog({
        title:'覆盖当前提示词？',
        message:'会把你现在写的提示词替换成「'+preset.label+'」的人设。',
        confirm:'覆盖',
        danger:true
      }).then(function(yes){
        if(!yes)return;
        ta.value=preset.text;
        markDirty();
        toast('已填入「'+preset.label+'」','ok');
      });
    }else{
      ta.value=preset.text;
      markDirty();
      toast('已填入「'+preset.label+'」','ok');
    }
  });
}

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

function updateSectionStates(){
  for(var s=0;s<FIELDS.length;s++){
    var sec=FIELDS[s];
    if(sec.custom){
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

function collectConfig(secId){
  var keys=sectionKeys(secId||'');
  var patch={};
  for(var k=0;k<keys.length;k++){
    var el=$('cf_'+keys[k]);
    if(el)patch[keys[k]]=el.value;
  }
  return patch;
}

function snapshotOthers(savedKeys){
  var keys=sectionKeys('');
  var out={};
  for(var k=0;k<keys.length;k++){
    if(savedKeys.indexOf(keys[k])>=0)continue;
    var el=$('cf_'+keys[k]);
    if(el)out[keys[k]]=el.value;
  }
  return out;
}

function restoreOthers(draft){
  for(var key in draft){
    if(!Object.prototype.hasOwnProperty.call(draft,key))continue;
    var el=$('cf_'+key);
    if(el&&el.value!==draft[key])el.value=draft[key];
  }
}

function afterSave(d,draft){
  var hot=!(d&&d.botReloaded===false);
  toast(hot?'已保存，热更新生效':'已保存（机器人未运行，启动后生效）','ok');
  return api('GET','/api/config').then(function(c){
    if(!c)return;
    renderConfig(c);
    if(draft)restoreOthers(draft);
    updateSectionStates();
  });
}

function postConfig(patch,btn,draft){
  busy(btn,true);
  api('POST','/api/config',patch).then(function(d){
    return afterSave(d,draft);
  }).catch(function(e){
    toast(e.message,'bad');
    busy(btn,false);
  });
}

function saveSection(secId,btn){
  var patch=collectConfig(secId);
  if(!Object.keys(patch).length){toast('这一块没有可保存的项','bad');return;}
  // 必填校验：required 字段留空直接拒绝保存
  var missing=missingRequired(secId);
  if(missing){
    toast('「'+missing+'」是必填项，不能为空','bad');
    var el=$('cf_'+missing);
    if(el&&el.focus)el.focus();
    return;
  }
  postConfig(patch,btn,snapshotOthers(Object.keys(patch)));
}

// 返回该区块第一个未填写的 required 字段 key，没有则返回空串
function missingRequired(secId){
  for(var s=0;s<FIELDS.length;s++){
    var sec=FIELDS[s];
    if(sec.custom)continue;
    if(secId&&sec.id!==secId)continue;
    var items=sec.items||[];
    for(var i=0;i<items.length;i++){
      var f=items[i];
      if(!f.required)continue;
      // 敏感字段（secret）有值时后端不回传明文，输入框为空也算「已填」
      var el=$('cf_'+f.key);
      if(!el)continue;
      var saved=!!(f.secret&&String(el.getAttribute('placeholder')||'').indexOf('已设置')===0);
      if(!String(el.value||'').trim()&&!saved)return f.label;
    }
  }
  return '';
}

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
  list.innerHTML=convSkeleton(6);
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

function deleteConversation(scope){
  if(!scope)return;
  var isSys=scope==='system';
  var label=isSys?'全部系统消息':('会话 #'+scope);
  confirmDialog({
    title:'删除'+label+'？',
    message:'该会话的全部聊天记录都会被删除，不可恢复。',
    detail:'删除的是这个会话下的所有消息，不是单独一条。',
    confirm:'删除',
    danger:true
  }).then(function(yes){
    if(!yes)return;
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
  });
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

var aiState=[];
var aiSeq=0;

function modelSelOptions(p){
  var ms=p.models||[];
  var cur=p.model||'';
  if(!ms.length){
    return cur?[[cur,cur]]:[['','先点「拉取模型」']];
  }
  var opts=[];
  var has=false;
  for(var i=0;i<ms.length;i++)if(ms[i]===cur)has=true;
  if(!cur||!has)opts.push(['','请选择模型']);
  for(var j=0;j<ms.length;j++)opts.push([ms[j],ms[j]]);
  return opts;
}

// Re-render the model custom select (its options depend on the fetched model list)
function renderModelSel(cur,models){
  var wrap=$('ai-m-model-wrap');
  if(!wrap)return;
  wrap.innerHTML=selHtml('ai-m-model',cur,modelSelOptions({model:cur,models:models}),{nativeId:'ai-m-model',nativeAttrs:' name="ai-m-model"'});
  bindSel(wrap);
}

var aiModal={idx:-1,isNew:false,p:null,models:[]};
var aiEscBound=false;

function aiModalHtml(){
  var h='<div class="modal-mask" id="ai-modal-mask" hidden>'
    +'<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ai-m-title">'
    +'<div class="modal-head"><h3 id="ai-m-title">添加 AI</h3>'
    +'<button class="modal-x" type="button" id="ai-modal-x" aria-label="关闭">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label for="ai-m-name">名称</label><input id="ai-m-name" name="ai-m-name" maxlength="40" placeholder="例如 主账号"></div>'
    +'<div class="field"><label for="ai-m-url">Base URL</label><input id="ai-m-url" name="ai-m-url" placeholder="https://api.example.com/v1"></div>'
    +'<div class="field"><label for="ai-m-key">API Key</label><div class="pw-wrap"><input id="ai-m-key" name="ai-m-key" type="password" placeholder="sk-..." autocomplete="new-password">'
    +'<button class="pw-toggle" type="button" id="ai-m-key-toggle">显示</button></div></div>'
    +'<div class="field"><label for="selt_ai-m-model">模型</label><div class="model-row">'
    +'<div class="sel-wrap" id="ai-m-model-wrap">'+selHtml('ai-m-model','',[['','先点「拉取模型」']],{nativeId:'ai-m-model',nativeAttrs:' name="ai-m-model"'})+'</div>'
    +'<button class="btn" type="button" id="ai-m-pull">'+IX.refresh+'<span>拉取模型</span></button></div></div>'
    +'<div class="grid">'
    +'<div class="field"><label for="ai-m-temp">Temperature</label><input id="ai-m-temp" name="ai-m-temp" type="number" inputmode="decimal" step="0.1" placeholder="0.8"></div>'
    +'<div class="field"><label class="prov-check"><input type="checkbox" id="ai-m-on" name="ai-m-on" checked>启用参与回复</label></div>'
    +'<div class="field"><label for="selt_ai-m-vision">识图能力</label>'
    +selHtml('ai-m-vision','auto',[['auto','自动判断（按模型名）'],['1','支持识图'],['0','不支持（纯文本）']],{nativeId:'ai-m-vision',nativeAttrs:' name="ai-m-vision"'})
    +'</div>'
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
    +'<label class="prov-switch" title="点一下启用/停用"><input type="checkbox" class="prov-sw" id="prov-sw-'+esc(p.id)+'" name="prov-en-'+esc(p.id)+'"'+(p.enabled?' checked':'')+'><i></i></label>'
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
  renderModelSel(p.model||'',aiModal.models);
  $('ai-m-temp').value=p.temperature||'0.8';
  $('ai-m-on').checked=!!p.enabled;
  $('ai-m-vision').value=p.vision||'auto';
  syncSelLabel($('sell_ai-m-vision'),$('ai-m-vision'),$('selm_ai-m-vision'));
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
      renderModelSel(cur,aiModal.models);
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
  bindSel($('ai-modal-mask'));
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
    var name=aiState[idx].name||'这个 AI';
    confirmDialog({
      title:'删除「'+name+'」？',
      message:'删除后要从列表里重新添加才能恢复，需要再填一次地址和 API Key。',
      detail:'这一步只改内存里的列表，点「保存」后才真正写入；点「取消」可原样退出。',
      confirm:'删除',
      danger:true
    }).then(function(yes){
      if(!yes)return;
      var at=-1;
      for(var j=0;j<aiState.length;j++)if(aiState[j].id===id)at=j;
      if(at<0)return;
      if(aiState.length<2){toast('至少保留一个 AI');return;}
      aiState.splice(at,1);
      renderAiProviders();
      toast('已从列表移除，点「保存」生效','ok');
    });
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

function saveProviders(btn){
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
      toast('已保存 '+n+' 个 AI，热更新生效','ok');
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);});
}

function showAi(){
  stopStatusTimer();
  rendered=false;
  setActive('ai');
  setTopActions('');
  setPill('AI 模型','');
  $('wrap').innerHTML=skeletonAi();
  Promise.all([
    api('GET','/api/ai'),
    api('GET','/api/config').catch(function(){ return null; })
  ]).then(function(r){
    var d=r[0], cfgResp=r[1];
    if(!d)return;
    aiState=(d.providers||[]).map(function(p){
      return {id:p.id,name:p.name,baseUrl:p.baseUrl,apiKey:'',model:p.model,
        temperature:p.temperature,enabled:p.enabled?1:0,vision:p.vision||'auto',hasKey:!!p.hasKey,models:[]};
    });
    if(cfgResp){
      var cfg=(cfgResp.config)||{};
      var conf=(cfgResp.configured)||{};
      imageGenState.baseUrl=cfg.imageGenBaseUrl||'';
      imageGenState.model=cfg.imageGenModel||'';
      imageGenState.apiKey='';
      imageGenState.hasKey=!!conf.imageGenApiKey;
      imageGenState.tested=false;
      imageGenState.result='';
      cfState.chat=(cfg.cfChatEnabled=='0')?'0':'1';
      cfState.imageGen=(cfg.cfImageGenEnabled=='0')?'0':'1';
      cfState.voice=(cfg.cfVoiceEnabled=='0')?'0':'1';
      voiceState.baseUrl=cfg.voiceBaseUrl||'';
      voiceState.model=cfg.voiceModel||'';
      voiceState.speaker=cfg.voiceSpeaker||'';
      voiceState.apiKey='';
      voiceState.hasKey=!!conf.voiceApiKey;
      voiceState.tested=false;
    }
    renderAiPage();
  }).catch(function(e){
    $('wrap').innerHTML='<div class="card"><div class="card-head"><h3>AI 列表读取失败</h3></div>'
      +'<p class="error-text">'+esc(e.message)+'</p></div>';
    setPill('读取失败','bad');
  });
}

var imageGenState={model:'',baseUrl:'',apiKey:'',hasKey:false,testedModel:'',testedUrl:'',tested:false,result:''};
var igenEscBound=false;

// 内置 CF 能力开关 + 外部语音配置
var cfState={chat:'1',imageGen:'1',voice:'1'};
var voiceState={baseUrl:'',apiKey:'',model:'',speaker:'',hasKey:false,tested:false};
var voiceEscBound=false;

function renderAiPage(){
  var h='<div class="card"><div class="card-head"><h3>AI 模型</h3>'
    +'<span class="hint">内置 Cloudflare 能力开箱即用，外部模型按需添加</span></div>';

  // 内置 CF 能力：固定三项 + 开关
  h+='<div class="ai-sec">'
    +'<div class="ai-sec-head"><b>内置 Cloudflare 能力</b>'
    +'<span class="hint">默认开启，免费额度，无需任何 Key</span></div>'
    +cfRowHtml('chat','💬','对话','@cf/qwen/qwen3-30b-a3b-fp8','AI 回复用这个内置模型，失败会自动切到下面外部模型')
    +cfRowHtml('imageGen','🎨','生图','@cf/black-forest-labs/flux-1-schnell','/画 用它生成图片（配了外部生图模型则优先外部）')
    +cfRowHtml('voice','🔊','语音','@cf/myshell-ai/melotts','/语音 用它合成语音（配了外部语音则优先外部）')
    +'<div class="fs-foot"><span class="fs-foot-note">开关即时保存，热更新生效</span>'
    +'<button class="btn primary" id="b-cf-save" type="button">'+IX.check+'<span>保存开关</span></button></div>'
    +'</div>';

  h+='<div class="ai-sec">'
    +'<div class="ai-sec-head"><b>对话模型</b>'
    +'<span class="hint">按顺序尝试，失败自动换下一个</span>'
    +'<button class="btn sm" id="b-ai-add" type="button">＋ 添加</button></div>'
    +'<div class="prov-list" id="prov-list"></div>'
    +'<div class="fs-foot"><span class="fs-foot-note">保存后机器人自动重读列表，不用重启</span>'
    +'<button class="btn primary" id="b-ai-save" type="button">'+IX.check+'<span>保存</span></button></div>'
    +'</div>';

  h+='<div class="ai-sec">'
    +'<div class="ai-sec-head"><b>生图模型</b>'
    +'<span class="hint">留空即用内置 CF 生图；填了则优先外部，需测试通过</span>'
    +'<button class="btn sm" id="b-igen-add" type="button">✎ 编辑</button></div>'
    +'<div id="igen-row-wrap">'+igenRowHtml()+'</div>'
    +'<div class="fs-foot"><span class="fs-foot-note" id="igen-state"></span>'
    +'<button class="btn primary" id="b-igen-save" type="button" disabled>'+IX.check+'<span>保存</span></button></div>'
    +'</div>';

  // 外部语音（OpenAI 兼容 /audio/speech），可选
  h+='<div class="ai-sec">'
    +'<div class="ai-sec-head"><b>语音合成</b>'
    +'<span class="hint">默认用内置 CF 语音；填了外部服务则优先外部（OpenAI 兼容 /audio/speech）</span>'
    +'<button class="btn sm" id="b-voice-add" type="button">✎ 编辑</button></div>'
    +'<div id="voice-row-wrap">'+voiceRowHtml()+'</div>'
    +'<div class="fs-foot"><span class="fs-foot-note" id="voice-state"></span>'
    +'<button class="btn primary" id="b-voice-save" type="button" disabled>'+IX.check+'<span>保存</span></button></div>'
    +'</div>';

  h+='</div>';

  h+='<div class="card"><div class="card-head"><h3>快速添加</h3>'
    +'<span class="hint">点一下填好地址和模型，只需再补 API Key</span></div>'
    +'<p class="chip-label">对话模型</p>'
    +'<div class="chip-row" id="ai-presets">'+aiPresetChips()+'</div>'
    +'<p class="chip-label mt-sm">生图模型</p>'
    +'<div class="chip-row" id="igen-model-presets">'+igenModelChips()+'</div>'
    +'</div>';

  h+='<div class="card"><div class="card-head"><h3>怎么用</h3></div>'
    +'<p class="tip">接口都要兼容 OpenAI。对话模型走 <b>/chat/completions</b>，生图走 <b>/images/generations</b>，语音走 <b>/audio/speech</b>。<br>'
    +'「对话模型」列表顺序就是优先级：内置 CF 先答，失败自动换外部，全部失败才回一句「出了点小状况」。'
    +'停用的不参与。点行可编辑，编辑在弹窗里完成，可以先「测试」确认能通再保存。<br>'
    +'生图、语音默认用内置 Cloudflare 能力，也可以指向外部服务商。<br>'
    +'讯飞星火的「API Key」填控制台里的 <b>APIPassword</b>；腾讯混元已升级为 TokenHub，地址用新接口。'
    +'国外模型（OpenAI、Gemini、Grok 等）在 Cloudflare Workers 上可直连，不需要代理。</p></div>';

  h+=aiModalHtml();
  h+=igenModalHtml();
  h+=voiceModalHtml();
  $('wrap').innerHTML=h;
  renderAiProviders();
  bindAiModal();
  bindIgenModal();
  bindVoiceModal();

  $('b-ai-add').addEventListener('click',function(){openAiModal(-1);});
  $('b-ai-save').addEventListener('click',function(){saveProviders(this);});
  $('prov-list').addEventListener('click',onProvClick);
  $('ai-presets').addEventListener('click',onPresetClick);
  $('b-cf-save').addEventListener('click',function(){saveCfSwitches(this);});
  bindCfSwitches();
}

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


function showWorkspace(){
  stopStatusTimer();
  rendered=false;
  setActive('workspace');
  setTopActions('');
  setPill('工作区','');
  $('wrap').innerHTML='<div class="card">'
    +'<div class="card-head"><h3>工作区</h3>'
    +'<span class="hint">群管理已融入群卡片 · 定时任务在最下面</span></div>'
    +'<div class="card-head mt-sm"><h3>用户工作区</h3>'
    +'<span class="hint">每个用户一份：文件、任务与笔记、对话记忆</span>'
    +'<button class="btn sm" id="b-ws-refresh" type="button">'+IX.refresh+'<span>刷新</span></button></div>'
    +'<p class="muted">按「人」隔离：单聊 <code>c2c:&lt;用户&gt;</code>、群聊 <code>group:&lt;群&gt;:u:&lt;用户&gt;</code>。'
    +'群卡片里可以直接开关回复、查成员、复制 openid、移除群；点卡片展开看群内每个用户的工作区。</p>'
    +'<div id="ws-list">'+skListSkeleton(4)+'</div>'
    +'<div class="card-head mt-lg"><h3>定时任务</h3><span class="hint" id="rem-count"></span></div>'
    +'<p class="tip">群里说「明天 8 点提醒我开会」「10 分钟后提醒我喝水」就会出现在这里；到点主动发消息，重复任务自动顺延。'
    +'QQ 对主动消息有频率和配额限制，发送失败的任务会标红。</p>'
    +'<div class="rem-toolbar"><button class="btn sm" type="button" id="rem-refresh">'+IX.refresh+'<span>刷新</span></button>'
    +'<label class="rem-selall"><input type="checkbox" id="rem-sel-all" name="rem-sel-all"><span>全选</span></label>'
    +'<button class="btn sm danger hidden" type="button" id="rem-del-sel">'+IX.trash+'<span>删除选中</span></button></div>'
    +'<div class="ws-rem-scroll" id="rem-list">'+skListSkeleton(3)+'</div>'
    +'</div>';
  $('b-ws-refresh').addEventListener('click',function(){loadWorkspaces();});
  $('rem-refresh').addEventListener('click',function(){loadReminders();});
  $('rem-del-sel').addEventListener('click',function(){deleteSelectedReminders();});
  loadWorkspaces();
  loadReminders();
}

function loadMenuEditor(){
  var box=$('menu-editor');
  if(!box)return;
  api('GET','/api/menu').then(function(d){
    var menu=(d&&d.menu)||null;
    renderMenuEditor(menu, d&&d.version);
  }).catch(function(e){
    if(box)box.innerHTML='<p class="error-text">'+esc(e.message)+'</p>';
  });
}

var menuState={items:[],version:0};

function renderMenuEditor(menu,version){
  var box=$('menu-editor');
  if(!box)return;
  // 只在「从服务端拉回来的场景」整体替换；内部重绘时传的是当前 items，不能覆盖掉正在编辑的内容
  if(menu&&Array.isArray(menu.items))menuState.items=menu.items;
  if(version)menuState.version=version;
  var h='';
  h+='<div class="form-actions"><span class="hint">'
    +(menuState.version?('当前版本 v'+menuState.version):'还没设置过菜单')+'</span><span class="grow"></span>'
    +'<button class="btn sm" type="button" id="b-menu-add">＋ 添加菜单项</button></div>';
  if(!menuState.items.length){
    h+='<p class="muted">还没有菜单项。可以加几个常用的，比如「帮助 /help」「画图 /画 」。'
      +'<br>想恢复成没有菜单，把下面所有项删掉再保存即可。</p>';
  }else{
    h+='<div class="menu-list">';
    for(var i=0;i<menuState.items.length;i++)h+=menuItemHtml(menuState.items[i],i);
    h+='</div>';
  }
  h+='<div class="fs-foot"><span class="fs-foot-note">保存后立即生效，用户重进会话可见</span>'
    +'<button class="btn primary" type="button" id="b-menu-save">'+IX.check+'<span>保存</span></button></div>';
  box.innerHTML=h;

  // 每次重绘都要重新绑定：innerHTML 会把旧节点连同监听一起丢掉
  $('b-menu-add').addEventListener('click',function(){
    if(menuState.items.length>=10){toast('最多 10 个菜单项','bad');return;}
    syncMenuFromDom();
    menuState.items.push({type:'send_message',name:'',send_message:''});
    renderMenuEditor(null,0);
  });
  $('b-menu-save').addEventListener('click',saveMenu);
  // 用直接绑定而不是事件委托：下拉框改的是 value，
  // 委托到 click 上永远收不到，这就是「类型一直选不了」的原因
  var rows=box.querySelectorAll('[data-mi]');
  for(var r=0;r<rows.length;r++)bindMenuRow(rows[r]);
  // 类型下拉是自绘组件，也要绑一遍（含每一行的 custom select）
  bindSel(box);
}

function bindMenuRow(row){
  var idx=Number(row.getAttribute('data-mi'));
  var typeEl=row.querySelector('[data-mf="type"]');
  var nameEl=row.querySelector('[data-mf="name"]');
  var valEl=row.querySelector('[data-mf="value"]');

  if(nameEl){
    nameEl.addEventListener('input',function(){
      if(menuState.items[idx])menuState.items[idx].name=nameEl.value.trim();
    });
  }
  if(valEl){
    valEl.addEventListener('input',function(){
      var it=menuState.items[idx];
      if(!it)return;
      if(it.type==='link'){it.link=valEl.value.trim();it.send_message='';}
      else {it.send_message=valEl.value.trim();it.link='';}
    });
  }
  if(typeEl){
    typeEl.addEventListener('change',function(){
      var it=menuState.items[idx];
      if(!it)return;
      // 换类型时先把当前输入存下来，再切，别把用户写的内容丢了
      if(nameEl)it.name=nameEl.value.trim();
      var keep=valEl?valEl.value.trim():'';
      var prevType=it.type;
      it.type=typeEl.value;
      if(it.type==='link'){
        it.link=prevType==='link'?keep:'';
        it.send_message='';
      }else{
        it.send_message=prevType==='link'?keep:'';
        it.link='';
      }
      // 只重绘这一行，避免整块重绘导致焦点丢失
      var fresh=document.createElement('div');
      fresh.innerHTML=menuItemHtml(it,idx);
      var newRow=fresh.firstChild;
      row.parentNode.replaceChild(newRow,row);
      bindMenuRow(newRow);
      bindSel(newRow);
    });
  }

  var rm=row.querySelector('[data-mact="remove"]');
  if(rm){
    rm.addEventListener('click',function(){
      syncMenuFromDom();
      menuState.items.splice(idx,1);
      renderMenuEditor(null,0);
    });
  }
}

function menuItemHtml(it,i){
  var type=it.type||'send_message';
  // 每个字段都要有唯一 id 并让 label 用 for 指过去，否则无障碍检查会报
  // 「form field should have id or name」「No label associated with a form field」，
  // 读屏软件也无法把标签念给用户听。
  var idName='menu-'+i+'-name';
  var idType='menu-'+i+'-type';
  var idValue='menu-'+i+'-value';
  var valueLabel=(type==='link')?'链接（https://）':'发送的内容';
  var h='<div class="menu-row" data-mi="'+i+'">';
  h+='<span class="menu-no">'+(i+1)+'</span>';
  h+='<div class="field"><label for="'+idName+'">名称</label>'
    +'<input id="'+idName+'" name="'+idName+'" data-mf="name" maxlength="10"'
    +' value="'+esc(it.name||'')+'" placeholder="如：帮助"></div>';
  h+='<div class="field"><label for="selt_'+idType+'">类型</label>'
    +selHtml(idType,type,[['send_message','发送消息'],['link','跳转链接']])
    +'<select id="'+idType+'" name="'+idType+'" data-mf="type" hidden aria-hidden="true">'
    +'<option value="send_message"'+(type==='send_message'?' selected':'')+'>发送消息</option>'
    +'<option value="link"'+(type==='link'?' selected':'')+'>跳转链接</option>'
    +'</select></div>';
  h+='<div class="field grow"><label for="'+idValue+'">'+valueLabel+'</label>'
    +'<input id="'+idValue+'" name="'+idValue+'" data-mf="value" maxlength="2048"'
    +' value="'+esc(type==='link'?(it.link||''):(it.send_message||''))+'"'
    +' placeholder="'+(type==='link'?'https://example.com':'/help')+'"></div>';
  h+='<div class="prov-tools"><button class="btn sm danger" type="button" data-mact="remove">删除</button></div>';
  h+='</div>';
  return h;
}

function syncMenuFromDom(){
  var box=$('menu-editor');
  if(!box)return;
  var rows=box.querySelectorAll('[data-mi]');
  for(var i=0;i<rows.length;i++){
    var idx=Number(rows[i].getAttribute('data-mi'));
    var it=menuState.items[idx];
    if(!it)continue;
    var nameEl=rows[i].querySelector('[data-mf="name"]');
    var typeEl=rows[i].querySelector('[data-mf="type"]');
    var valEl=rows[i].querySelector('[data-mf="value"]');
    if(nameEl)it.name=nameEl.value.trim();
    if(typeEl)it.type=typeEl.value;
    if(valEl){
      if(it.type==='link'){it.link=valEl.value.trim();it.send_message='';}
      else {it.send_message=valEl.value.trim();it.link='';}
    }
  }
}

function saveMenu(){
  var btn=$('b-menu-save');
  syncMenuFromDom();
  var items=[];
  var err='';
  for(var i=0;i<menuState.items.length;i++){
    var it=menuState.items[i];
    if(!it.name){err='第 '+(i+1)+' 项还没填名称';break;}
    if(it.type==='link'){
      if(String(it.link||'').slice(0,8).toLowerCase()!=='https://'){err='第 '+(i+1)+' 项链接必须以 https:// 开头';break;}
      items.push({type:'link',name:it.name,link:it.link});
    }else{
      if(!it.send_message){err='第 '+(i+1)+' 项还没填发送内容';break;}
      items.push({type:'send_message',name:it.name,send_message:it.send_message});
    }
  }
  if(err){toast(err,'bad');return;}
  busy(btn,true);
  var payload={};
  payload.menu={items:items};
  api('POST','/api/menu',payload).then(function(){
    toast('菜单已保存','ok');
    loadMenuEditor();
  }).catch(function(e){
    toast(e.message,'bad');
    busy(btn,false);
  });
}

function loadWorkspaces(){
  var box=$('ws-list');
  if(box)box.innerHTML=skListSkeleton(4);
  Promise.all([
    api('GET','/api/sandboxes').then(function(d){return (d&&d.items)||[];}).catch(function(){return [];}),
    api('GET','/api/workspaces').then(function(d){return (d&&d.items)||[];}).catch(function(){return [];}),
    api('GET','/api/groups').then(function(d){return (d&&d.items)||[];}).catch(function(){return [];})
  ]).then(function(r){ renderWorkspaces(r[0],r[1],r[2]); })
    .catch(function(e){ if(box)box.innerHTML='<p class="error-text">'+esc(e.message)+'</p>'; });
}

function renderWorkspaces(sandboxes,workspaces,groupRows){
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
  var groupMap={};
  for(var g=0;g<groupRows.length;g++){
    var gr=groupRows[g];
    if(gr&&gr.openid)groupMap[gr.openid]=gr;
  }

  var items=Object.keys(byScope).map(function(k){return byScope[k];});
  items.sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});
  if(!items.length){
    box.innerHTML='<p class="muted">还没有工作区。群里 @机器人 发 <b>/工作 帮我整理一下…</b>，或说「写一篇…保存成 a.md 发我」就会创建。</p>';
    return;
  }

  var c2c=[];
  var groups={};   // groupOpenid -> { users:[...], latestAt, groupMeta }
  for(var m=0;m<items.length;m++){
    var it=items[m];
    if(it.kind==='c2c'){ c2c.push(it); continue; }
    var gid=groupOpenidOf(it.scope);
    if(!groups[gid])groups[gid]={gid:gid,users:[],latestAt:0,groupMeta:groupMap[gid]||null};
    groups[gid].users.push(it);
    if((it.updatedAt||0)>groups[gid].latestAt)groups[gid].latestAt=it.updatedAt;
  }

  var left='<div class="ws-col">'
    +'<div class="ws-col-head ws-fold-head" role="button" tabindex="0" aria-expanded="false">'
    +'<b>私聊对话</b><span class="ws-col-n">'+c2c.length+' 人</span>'
    +'<span class="ws-chevron">'+IX.chevron+'</span></div>'
    +'<div class="ws-col-list ws-fold-body" hidden>';
  for(var a=0;a<c2c.length;a++)left+=wsUserBtnHtml(c2c[a],'c2c');
  if(!c2c.length)left+='<p class="muted">（还没有私聊用户）</p>';
  left+='</div></div>';

  var groupList=Object.keys(groups).map(function(k){return groups[k];});
  groupList.sort(function(x,y){return y.latestAt-x.latestAt;});
  var right='<div class="ws-col">'
    +'<div class="ws-col-head"><b>群聊对话</b><span class="ws-col-n">'+groupList.length+' 群</span></div>'
    +'<div class="ws-col-list">';
  for(var b=0;b<groupList.length;b++){
    var grp=groupList[b];
    grp.users.sort(function(x,y){return (y.updatedAt||0)-(x.updatedAt||0);});
    var ubtns='';
    for(var c=0;c<grp.users.length;c++)ubtns+=wsUserBtnHtml(grp.users[c],'group-member');
    right+=wsGroupCardHtml(grp,ubtns);
  }
  if(!groupList.length)right+='<p class="muted">（还没有群聊用户）</p>';
  right+='</div></div>';

  box.innerHTML='<div class="ws-cols">'+left+right+'</div>';
  if(!box.__wsBound){
    box.__wsBound=true;
    box.addEventListener('click',onWorkspaceClick);
    box.addEventListener('change',onWorkspaceToggle);
  }
}

function wsGroupCardHtml(grp,urows){
  var meta=grp.groupMeta||{};
  var masked=meta.masked||grp.gid;
  var seen=meta.lastSeen?('最近活跃 '+fmtEntryTime(meta.lastSeen)):'';
  var src=meta.source==='manual'?'手动添加':'自动收集';
  var replyEnabled=meta.replyEnabled!==false;
  var h='<div class="ws-group" data-openid="'+esc(grp.gid)+'">'
    +'<div class="ws-group-head" role="button" tabindex="0" aria-expanded="false">'
    +'<span class="ws-badge">'+IX.groups+'</span>'
    +'<div class="ws-main"><b>群聊 · '+esc(masked)+'</b>'
    +'<small>'+(seen?seen+' · ':'')+src+' · '+grp.users.length+' 人</small></div>'
    +'<div class="ws-group-tools">'
    +'<label class="prov-switch" title="开关本机器人在这个群的回复"><input type="checkbox" id="grp-reply-'+esc(masked)+'" name="grp-reply-'+esc(masked)+'" data-gact="toggle"'+(replyEnabled?' checked':'')+'><i></i></label>'
    +'<button class="btn sm" type="button" data-gact="members" title="查看群资料 / 成员 / 禁言">成员</button>'
    +'<button class="icon-btn xs" type="button" data-gact="copy" title="复制完整 openid">'+IX.key+'</button>'
    +'<button class="icon-btn xs" type="button" data-gact="del" title="从群列表移除">'+IX.trash+'</button>'
    +'<span class="ws-chevron">'+IX.chevron+'</span>'
    +'</div></div>'
    +'<div class="ws-group-body" hidden><div class="ws-btn-grid">'+urows+'</div></div>'
    +'</div>';
  return h;
}

function groupOpenidOf(scope){
  var s=String(scope||'');
  if(s.indexOf('group:')!==0)return s;
  var rest=s.slice(6);
  var idx=rest.indexOf(':u:');
  return idx>=0?rest.slice(0,idx):rest;
}

function wsUserBtnHtml(it,kind){
  var initial=(it.scopeMasked&&it.scopeMasked.charAt(0))||'U';
  var sc=it.scope||'';
  var sub;
  if(kind==='group-member'){
    var idx=sc.indexOf(':u:');
    sub=idx>=0?('成员 '+esc(sc.slice(idx+3))) : esc(it.scopeMasked||'');
  } else {
    sub=esc(it.scopeMasked||'');
  }
  var meta=[];
  if(it.hasSandbox)meta.push('文件 '+it.files);
  if(it.hasWorkspace)meta.push('任务 '+it.tasks);
  return '<button class="ws-user-btn" type="button" data-ws="detail" data-scope="'+esc(sc)+'">'
    +'<span class="ws-badge ws-badge-user">'+esc(initial)+'</span>'
    +'<span class="ws-user-name">'+sub+'</span>'
    +(meta.length?'<span class="ws-user-meta">'+esc(meta.join(' · '))+'</span>':'')
    +'<span class="ws-user-time">'+esc(it.updatedAt?absTime(it.updatedAt):'')+'</span>'
    +'</button>';
}

function onWorkspaceClick(e){
  var foldHead=e.target&&e.target.closest?e.target.closest('.ws-fold-head'):null;
  if(foldHead){
    var foldBody=foldHead.nextElementSibling;
    if(!foldBody)return;
    var willShow=foldBody.hidden;
    foldBody.hidden=!willShow;
    foldHead.setAttribute('aria-expanded',String(willShow));
    foldHead.classList.toggle('is-open',willShow);
    return;
  }
  var gactEl=e.target&&e.target.closest?e.target.closest('[data-gact]'):null;
  if(gactEl){
    var gcard=gactEl.closest('.ws-group');
    if(!gcard)return;
    var gopenid=gcard.getAttribute('data-openid')||'';
    var gact=gactEl.getAttribute('data-gact');
    if(gact==='members')openGrpModal(gopenid,true);
    else if(gact==='del')removeGroupRow(gopenid);
    else if(gact==='copy')copyGrpId(gopenid);
    return;
  }
  var gh=e.target&&e.target.closest?e.target.closest('.ws-group-head'):null;
  if(gh){
    var grp=gh.closest('.ws-group');
    if(!grp)return;
    var body=grp.querySelector('.ws-group-body');
    if(!body)return;
    var willShow=body.hidden;
    body.hidden=!willShow;
    gh.setAttribute('aria-expanded',String(willShow));
    gh.classList.toggle('is-open',willShow);
    return;
  }
  var ubtn=e.target&&e.target.closest?e.target.closest('button[data-ws="detail"]'):null;
  if(ubtn){
    var uscope=ubtn.getAttribute('data-scope')||'';
    if(uscope)openWorkspaceDetail(uscope);
    return;
  }
}

function onWorkspaceToggle(e){
  var input=e.target&&e.target.closest?e.target.closest('input[data-gact="toggle"]'):null;
  if(!input)return;
  var gcard=input.closest('.ws-group');
  if(!gcard)return;
  var openid=gcard.getAttribute('data-openid')||'';
  var enabled=!!input.checked;
  input.disabled=true;
  api('POST','/api/groups/reply',{openid:openid,enabled:enabled?1:0}).then(function(){
    toast(enabled?'已开启该群的回复':'已关闭该群的回复','ok');
  }).catch(function(err){
    input.checked=!enabled;
    toast(err.message,'bad');
  }).then(function(){input.disabled=false;});
}

function openWorkspaceDetail(scope){
  var m=document.getElementById('ws-modal-mask');
  if(!m){
    m=document.createElement('div');
    m.className='modal-mask';
    m.id='ws-modal-mask';
    m.innerHTML='<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>工作区详情</h3>'
      +'<button class="modal-x" type="button" id="ws-modal-x" aria-label="关闭">×</button></div>'
      +'<div class="modal-body ws-detail" id="ws-detail-body"></div>'
      +'<div class="modal-foot ws-foot"><p class="ws-foot-scope" id="ws-detail-scope"></p>'
      +'<div class="ws-foot-actions">'
      +'<button class="btn danger" type="button" id="ws-clear-btn">'+IX.trash+'<span>清空这个用户</span></button>'
      +'<button class="btn" type="button" id="ws-close-btn">关闭</button>'
      +'</div></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click',function(ev){
      if(ev.target===m||ev.target.id==='ws-modal-x')m.hidden=true;
    });
    $('ws-close-btn').addEventListener('click',function(){m.hidden=true;});
    $('ws-clear-btn').addEventListener('click',function(){
      var cur=m.getAttribute('data-scope')||'';
      if(!cur)return;
      confirmDialog({
        title:'清空这个用户的工作区？',
        message:'文件、任务与笔记、对话记忆三层会全部清掉，不可恢复。',
        detail:cur,
        confirm:'清空',
        danger:true
      }).then(function(yes){
        if(!yes)return;
        Promise.all([
          api('POST','/api/sandboxes/clear',{scope:cur}).catch(function(){}),
          api('POST','/api/workspaces/clear',{scope:cur}).catch(function(){}),
          api('POST','/api/memory/clear',{scope:cur}).catch(function(){})
        ]).then(function(){ toast('已清空','ok'); m.hidden=true; loadWorkspaces(); })
          .catch(function(err){ toast(err.message,'bad'); });
      });
    });
  }
  m.setAttribute('data-scope',scope);
  var scopeEl=$('ws-detail-scope');
  if(scopeEl)scopeEl.textContent=scope;
  var body=$('ws-detail-body');
  body.innerHTML='<p class="muted">加载中…</p>';
  m.hidden=false;
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

  var recentHtml=(memory.recent&&memory.recent.length)
    ? '<div class="mem-recent">'+memory.recent.map(function(x){
        var role=x.role==='user'?'用户':'助手';
        var cls=x.role==='user'?'mem-user':'mem-bot';
        return '<div class="mem-line '+cls+'"><span class="mem-role">'+role+'</span><span class="mem-text">'+esc(x.content)+'</span></div>';
      }).join('')+'</div>'
    : '<p class="muted">（还没有对话）</p>';

  var summaryHtml=memory.summary
    ? '<p class="mem-summary">'+esc(memory.summary)+'</p>'
    : '<p class="muted">（还没有摘要，攒够了才会压缩生成）</p>';

  var factList=memory.facts||[];
  var SLOT_LABEL={name:'称呼',city:'所在地',job:'职业',stack:'技术栈',project:'在做的事',like:'喜欢',dislike:'讨厌',date:'重要日期',other:'其它'};
  var factsHtml=factList.length
    ? '<ul class="mem-facts">'+factList.map(function(f){
        var t=f.at?absTime(f.at):'';
        var tag=f.slot&&SLOT_LABEL[f.slot]?'<span class="mem-fact-slot">'+esc(SLOT_LABEL[f.slot])+'</span>':'';
        return '<li>'+tag+'<span class="mem-fact-text">'+esc(f.text)+'</span>'+(t?'<span class="mem-fact-time">'+esc(t)+'</span>':'')+'</li>';
      }).join('')+'</ul>'
    : '<p class="muted">（还没有长期事实）</p>';

  var msgChars=memory.messagesChars||0;
  var msgWarn=msgChars>12000?' <span class="mem-capped">超预算会裁剪</span>':'';

  body.innerHTML='<div class="muted">'+esc(scope)+'</div>'
    +'<h4>📂 文件（沙箱 · 写入 '+(sandbox.runs||0)+' 次）</h4><ul>'+files+'</ul>'
    +'<h4>📋 任务清单（/工作）</h4><ul>'+tasks+'</ul>'
    +'<h4>📝 笔记（/工作）</h4><ul>'+notes+'</ul>'
    +'<h4>🧠 记忆分层（ChatDO）</h4>'
    +'<div class="mem-block">'
    +'<div class="mem-layer"><b>第一层 · 最近原文</b><span class="hint">'+(memory.messages||0)+' 条 · '+(msgChars>=1000?(msgChars/1000).toFixed(1)+'k':msgChars)+' 字'+msgWarn+'</span></div>'
    +recentHtml
    +'<div class="mem-layer"><b>第二层 · 滚动摘要</b><span class="hint">'+(memory.summaryLen||0)+' / 20000 字</span></div>'
    +summaryHtml
    +'<div class="mem-layer"><b>第三层 · 长期事实</b><span class="hint">'+factList.length+' / 40 条'
      +((memory.factsSlotted||0)?'（'+memory.factsSlotted+' 条带槽位）':'')+'</span></div>'
    +factsHtml
    +'</div>';
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
  h+='<div class="prov-info"><b>'+esc(imageGenState.model||'未配置（用内置 CF 生图）')+'</b><small>'
    +(host?esc(host):'留空用内置 Cloudflare flux-1-schnell')+'</small></div>';
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
    +'<input id="igen-url" name="igen-url" placeholder="https://api.example.com/v1" value="'+esc(imageGenState.baseUrl)+'"></div>'
    +'<div class="field"><label for="igen-key">API Key</label>'
    +'<div class="pw-wrap"><input id="igen-key" name="igen-key" type="password" value="'+esc(imageGenState.apiKey||'')+'" placeholder="'
    +(imageGenState.hasKey?'已设置，留空沿用旧 Key':'sk-...')+'" autocomplete="new-password">'
    +'<button class="pw-toggle" type="button" id="igen-key-toggle">显示</button></div></div>'
    +'<div class="field"><label for="igen-model">模型</label>'
    +'<input id="igen-model" name="igen-model" placeholder="qwen-image-3.0-pro" maxlength="64" value="'+esc(imageGenState.model)+'"></div>'
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
  // 允许清空：三项全空 = 回到内置 CF 生图
  if(url||model){
    if(!url){toast('请填写 Base URL','bad');return;}
    if(!model){toast('请填写模型名','bad');return;}
    if(!key&&!imageGenState.hasKey){toast('请填写 API Key','bad');return;}
  }
  imageGenState.baseUrl=url;
  imageGenState.model=model;
  imageGenState.apiKey=key;
  closeIgenModal();
  var row=document.querySelector('[data-igen]');
  if(row)row.outerHTML=igenRowHtml();
  var newRow=document.querySelector('[data-igen]');
  if(newRow)newRow.addEventListener('click',openIgenModal);
  updateImageGenState();
  toast('已更新生图配置，点「保存」后生效','ok');
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
  updateImageGenState();
}

var IMAGE_MODEL_PRESETS=[
  'qwen-image-3.0-pro','qwen-image','wanx2.1-t2i-plus','seedream-4.0',
  'doubao-seedream-3-0-t2i','cogview-4','dall-e-3','gpt-image-1.5','gpt-image-1','flux-schnell','nano-banana'
];
function igenModelChips(){
  var h='';
  for(var i=0;i<IMAGE_MODEL_PRESETS.length;i++)h+='<button class="chip" type="button" data-m="'+esc(IMAGE_MODEL_PRESETS[i])+'">'+esc(IMAGE_MODEL_PRESETS[i])+'</button>';
  return h;
}

function cfRowHtml(key,ico,label,model,desc){
  return '<div class="cf-row" data-cf="'+key+'">'
    +'<span class="prov-no">'+ico+'</span>'
    +'<div class="prov-info"><b>'+label+'</b><small>'+esc(model)+' · '+esc(desc)+'</small></div>'
    +'<div class="prov-meta"><label class="prov-switch" title="点一下开启/关闭">'
    +'<input type="checkbox" class="cf-sw" data-cf="'+key+'"'+(cfState[key]!=='0'?' checked':'')+'><i></i></label></div>'
    +'</div>';
}

function bindCfSwitches(){
  var sws=document.querySelectorAll('.cf-sw');
  for(var i=0;i<sws.length;i++){
    sws[i].addEventListener('change',function(){
      var k=this.getAttribute('data-cf');
      cfState[k]=this.checked?'1':'0';
    });
  }
}

function saveCfSwitches(btn){
  busy(btn,true);
  api('POST','/api/config',{cfChatEnabled:cfState.chat,cfImageGenEnabled:cfState.imageGen,cfVoiceEnabled:cfState.voice})
    .then(function(){
      toast('内置能力开关已保存，立即生效','ok');
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);});
}

function voiceRowHtml(){
  var host=voiceState.baseUrl||'';
  var k=host.indexOf('://');
  if(k>=0)host=host.substring(k+3);
  k=host.indexOf('/');
  if(k>=0)host=host.substring(0,k);
  var keyFlag=voiceState.hasKey?'<span class="prov-keyok">Key 已设置</span>':'<span class="prov-keyno">Key 未设置</span>';
  var flag=voiceState.tested?'<span class="prov-flag on">已测试</span>':'<span class="prov-flag off">未测试</span>';
  var h='<div class="prov-row" data-voice="1" title="点击编辑">';
  h+='<span class="prov-no">🔊</span>';
  h+='<div class="prov-info"><b>'+esc(voiceState.model||'未配置（用内置 CF 语音）')+'</b><small>'
    +(host?esc(host):'OpenAI 兼容 /audio/speech，留空用内置')+'</small></div>';
  h+='<div class="prov-meta">'+keyFlag+flag+'</div>';
  h+='<div class="prov-tools"><button class="btn sm" type="button" data-act="edit">编辑</button></div>';
  h+='</div>';
  return h;
}

function voiceModalHtml(){
  var h='<div class="modal-mask" id="voice-modal-mask" hidden>'
    +'<div class="modal" role="dialog" aria-modal="true" aria-labelledby="voice-m-title">'
    +'<div class="modal-head"><h3 id="voice-m-title">编辑语音配置</h3>'
    +'<button class="modal-x" type="button" id="voice-modal-x" aria-label="关闭">×</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label for="voice-url">Base URL</label>'
    +'<input id="voice-url" name="voice-url" placeholder="https://api.openai.com/v1"></div>'
    +'<div class="field"><label for="voice-key">API Key</label>'
    +'<div class="pw-wrap"><input id="voice-key" name="voice-key" type="password" placeholder="sk-..." autocomplete="new-password">'
    +'<button class="pw-toggle" type="button" id="voice-key-toggle">显示</button></div></div>'
    +'<div class="grid">'
    +'<div class="field"><label for="voice-model">模型</label>'
    +'<input id="voice-model" name="voice-model" placeholder="tts-1 或 cosyvoice 等"></div>'
    +'<div class="field"><label for="voice-speaker">音色（可选）</label>'
    +'<input id="voice-speaker" name="voice-speaker" placeholder="alloy / 自定义音色名"></div>'
    +'</div>'
    +'<div class="field"><span class="hint">OpenAI 兼容 <b>/audio/speech</b>。留空地址/Key/模型任意一项时，退回内置 Cloudflare 语音。</span></div>'
    +'<div class="test-result" id="voice-test-result" hidden></div>'
    +'</div>'
    +'<div class="modal-foot">'
    +'<button class="btn" type="button" id="b-voice-test">'+IX.play+'<span>测试</span></button>'
    +'<span class="grow"></span>'
    +'<button class="btn" type="button" id="voice-m-cancel">取消</button>'
    +'<button class="btn primary" type="button" id="voice-m-done">'+IX.check+'<span>完成</span></button>'
    +'</div></div></div>';
  return h;
}

function openVoiceModal(){
  $('voice-url').value=voiceState.baseUrl||'';
  $('voice-key').value=voiceState.apiKey||'';
  $('voice-key').placeholder=voiceState.hasKey?'已设置，留空沿用旧 Key':'sk-...';
  $('voice-model').value=voiceState.model||'';
  $('voice-speaker').value=voiceState.speaker||'';
  setVoiceResult('','');
  $('voice-modal-mask').hidden=false;
}

function closeVoiceModal(){
  var m=$('voice-modal-mask');
  if(m)m.hidden=true;
}

function setVoiceResult(kind,msg){
  var el=$('voice-test-result');
  if(!el)return;
  el.hidden=!kind;
  el.className='test-result'+(kind?' '+kind:'');
  el.textContent=msg||'';
}

function updateVoiceState(){
  var st=$('voice-state');
  var save=$('b-voice-save');
  var configured=!!voiceState.baseUrl&&!!voiceState.model;
  if(configured){
    if(voiceState.tested)save.disabled=false;
    else save.disabled=true;
    st.textContent=voiceState.tested?'已测试通过':'已填写，先测试再保存';
  }else{
    save.disabled=false;
    st.textContent='未配置（用内置 CF 语音）';
  }
}

function testVoice(btn){
  var url=$('voice-url').value.trim();
  var key=$('voice-key').value.trim();
  var model=$('voice-model').value.trim();
  var speaker=$('voice-speaker').value.trim();
  if(!url){toast('先填 Base URL','bad');return;}
  if(!model){toast('先填模型名','bad');return;}
  if(!key&&!voiceState.hasKey){toast('先填 API Key','bad');return;}
  var orig=btn.innerHTML;
  busy(btn,true);
  btn.innerHTML=IX.refresh+'<span>合成中…</span>';
  api('POST','/api/voice/test',{baseUrl:url,apiKey:key,model:model,speaker:speaker})
    .then(function(r){
      voiceState.baseUrl=url;
      voiceState.model=model;
      voiceState.speaker=speaker;
      voiceState.tested=!!(r&&r.ok);
      if(r&&r.ok){
        setVoiceResult('ok','✓ 测试通过，返回音频 '+r.bytes+' 字节');
      }else{
        setVoiceResult('bad','测试失败：'+((r&&r.error)||'未知错误'));
      }
      updateVoiceState();
      toast(r&&r.ok?'语音模型可用':'测试失败，请检查地址或模型名',r&&r.ok?'ok':'bad');
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);btn.innerHTML=orig;});
}

function saveVoice(btn){
  var url=voiceState.baseUrl||'';
  var model=voiceState.model||'';
  var speaker=voiceState.speaker||'';
  if((url||model)&&!(url&&model)){
    toast('Base URL 和模型要一起填','bad');
    return;
  }
  if(url&&model&&!voiceState.tested){
    toast('请先测试通过再保存','bad');
    return;
  }
  busy(btn,true);
  api('POST','/api/config',{voiceBaseUrl:url,voiceApiKey:voiceState.apiKey||'',
    voiceModel:model,voiceSpeaker:speaker})
    .then(function(){
      if(voiceState.apiKey)voiceState.hasKey=true;
      voiceState.apiKey='';
      var row=document.querySelector('[data-voice]');
      if(row)row.outerHTML=voiceRowHtml();
      var nr=document.querySelector('[data-voice]');
      if(nr)nr.addEventListener('click',openVoiceModal);
      updateVoiceState();
      toast('语音配置已保存，立即生效','ok');
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);});
}

function bindVoiceModal(){
  $('b-voice-add').addEventListener('click',openVoiceModal);
  $('voice-modal-x').addEventListener('click',closeVoiceModal);
  $('voice-m-cancel').addEventListener('click',closeVoiceModal);
  $('voice-modal-mask').addEventListener('click',function(e){if(e.target===this)closeVoiceModal();});
  $('voice-key-toggle').addEventListener('click',function(){
    var input=$('voice-key');
    var show=input.type==='password';
    input.type=show?'text':'password';
    this.textContent=show?'隐藏':'显示';
  });
  $('b-voice-test').addEventListener('click',function(){testVoice(this);});
  $('voice-m-done').addEventListener('click',function(){saveVoice(this);});
  $('b-voice-save').addEventListener('click',function(){saveVoice(this);});
  var row=document.querySelector('[data-voice]');
  if(row)row.addEventListener('click',openVoiceModal);
  updateVoiceState();
  if(!voiceEscBound){
    voiceEscBound=true;
    document.addEventListener('keydown',function(e){
      var m=$('voice-modal-mask');
      if(e.key==='Escape'&&m&&!m.hidden)closeVoiceModal();
    });
  }
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
    else st.textContent='未配置（用内置 CF 生图）';
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
  // 清空（model/baseUrl 都空）时允许保存，回到内置 CF 生图
  if(imageGenState.model||imageGenState.baseUrl){
    if(!imageGenState.tested||imageGenState.model!==imageGenState.testedModel
      ||imageGenState.baseUrl!==imageGenState.testedUrl){
      toast('请先测试通过再保存','bad');
      return;
    }
  }
  busy(btn,true);
  api('POST','/api/config',{imageGenBaseUrl:imageGenState.baseUrl,
    imageGenApiKey:imageGenState.apiKey||'',imageGenModel:imageGenState.model})
    .then(function(){
      if(imageGenState.apiKey)imageGenState.hasKey=true;
      imageGenState.apiKey='';
      var row=document.querySelector('[data-igen]');
      if(row)row.outerHTML=igenRowHtml();
      var newRow=document.querySelector('[data-igen]');
      if(newRow)newRow.addEventListener('click',openIgenModal);
      updateImageGenState();
      toast('生图模型已保存，立即生效','ok');
    })
    .catch(function(e){toast(e.message,'bad');})
    .then(function(){busy(btn,false);});
}

var grpModal={openid:'',nextCursor:'',members:[]};
var grpEscBound=false;

function grpPermHint(msg){
  return String(msg||'').indexOf('11253')>=0
    ?msg+'（官方白名单接口：到 QQ 开放平台 q.qq.com 的机器人管理后台申请「群管理」相关接口权限，通过后即可用）'
    :msg;
}

function removeGroupRow(openid){
  confirmDialog({
    title:'从这个列表移除群？',
    message:'只影响后台的这个群卡片，不影响机器人继续在该群工作。',
    detail:openid,
    confirm:'移除',
    danger:true
  }).then(function(yes){
    if(!yes)return;
    api('POST','/api/groups/remove',{openid:openid}).then(function(){
      toast('已移除','ok');
      return loadWorkspaces();
    }).catch(function(e){toast(e.message,'bad');});
  });
}

function copyGrpId(text){
  var done=function(){toast('完整 openid 已复制','ok');};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(function(){toast('复制失败','bad');});
  }else{
    toast('当前浏览器不支持一键复制','bad');
  }
}


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
  h+='<div class="form-actions"><div class="field grow"><label for="selt_grp-mute-mins">禁言时长</label>'
    +selHtml('grp-mute-mins','10',[['10','10 分钟'],['60','1 小时'],['720','12 小时'],['1440','1 天'],['10080','7 天'],['43200','30 天（上限）']],{nativeId:'grp-mute-mins',nativeAttrs:' name="grp-mute-mins"'})
    +'</div>';
  h+='<button class="btn" type="button" id="grp-members-btn">'+IX.refresh+'<span>拉取成员列表</span></button>';
  h+='<button class="btn" type="button" id="grp-members-more" hidden>下一页</button></div>';
  h+='<div class="form-actions"><div class="field grow"><label for="grp-manual-mid">手动禁言（成员列表内邀中拉不到时，直接粘贴成员 openid）</label>'
    +'<input id="grp-manual-mid" name="grp-manual-mid" placeholder="成员 openid" maxlength="128"></div>';
  h+='<button class="btn" type="button" id="grp-manual-btn">禁言</button></div>';
  h+='<div id="grp-m-members"><p class="muted">还没拉取成员。</p></div>';
  h+=grpJoinBlockHtml();
  h+=grpBlacklistBlockHtml();
  h+='</div>';
  h+='<div class="modal-foot"><span class="hint" id="grp-m-note"></span><span class="grow"></span>';
  h+='<button class="btn" type="button" id="grp-m-close">关闭</button></div>';
  h+='</div></div>';
  return h;
}

function grpJoinBlockHtml(){
  var h='<div class="grp-sec">';
  h+='<div class="chip-label">入群申请（需机器人是群管理员）</div>';
  h+='<div class="form-actions">'
    +'<button class="btn" type="button" id="grp-jr-load">'+IX.refresh+'<span>拉取申请列表</span></button>'
    +'<span class="hint" id="grp-jr-state"></span></div>';
  h+='<div id="grp-jr-list"><p class="muted">还没拉取。</p></div>';
  h+='</div>';
  return h;
}

function grpBlacklistBlockHtml(){
  var h='<div class="grp-sec grp-sec-fold">';
  h+='<div class="ws-fold-head" role="button" tabindex="0" aria-expanded="false" data-gfold="blacklist">'
    +'<b>群黑名单 / 批量移除</b>'
    +'<span class="badge-warn">平台内邀能力，未开通会报 11253</span>'
    +'<span class="ws-chevron">'+IX.chevron+'</span></div>';
  h+='<div class="ws-fold-body" data-gfold-body="blacklist" hidden>';
  h+='<div class="form-actions">'
    +'<button class="btn" type="button" id="grp-bl-load">'+IX.refresh+'<span>查询黑名单</span></button>'
    +'<span class="hint" id="grp-bl-state"></span></div>';
  h+='<div class="form-actions"><div class="field grow">'
    +'<label for="grp-bl-mid">成员 openid（多个用逗号分隔，每次最多 20 个）</label>'
    +'<input id="grp-bl-mid" name="grp-bl-mid" placeholder="member_openid, member_openid" maxlength="3000"></div></div>';
  h+='<div class="form-actions">'
    +'<button class="btn danger" type="button" id="grp-rm-btn">移出群聊</button>'
    +'<button class="btn" type="button" id="grp-bl-add">加入黑名单</button>'
    +'<button class="btn" type="button" id="grp-bl-del">移出黑名单</button></div>';
  h+='<div id="grp-bl-list"><p class="muted">还没查询。</p></div>';
  h+='</div></div>';
  return h;
}

function grpJoinRow(j){
  var h='<div class="prov-row" data-jmid="'+esc(j.member_openid||'')+'" data-jrid="'+esc(j.join_request_id||'')+'">';
  h+='<span class="prov-no">'+(j.bot?'🤖':'👤')+'</span>';
  h+='<div class="prov-info"><b>'+esc(j.username||'(无昵称)')+'</b><small>'
    +esc(j.member_openid||'')
    +(j.apply_at?' · '+esc(absTime(j.apply_at)):'')
    +(j.apply_source==='invited'?' · 被邀请':'')
    +'</small>';
  if(j.verify_info&&j.verify_info.verify_message){
    h+='<small class="jr-msg">验证消息：'+esc(j.verify_info.verify_message)+'</small>';
  }
  if(j.risk_tips){
    h+='<small class="jr-risk">⚠ '+esc(j.risk_tips)+'</small>';
  }
  h+='</div>';
  h+='<div class="prov-tools">'
    +'<button class="btn sm primary" type="button" data-jact="approve">通过</button>'
    +'<button class="btn sm danger" type="button" data-jact="decline">拒绝</button>'
    +'</div></div>';
  return h;
}

function loadJoinRequests(){
  var st=$('grp-jr-state');
  var box=$('grp-jr-list');
  if(st)st.textContent='正在拉取…';
  api('GET','/api/groups/join-requests?openid='+encodeURIComponent(grpModal.openid))
    .then(function(d){
      if(st)st.textContent='';
      if(!box)return;
      var list=(d&&d.list)||[];
      if(!list.length){
        box.innerHTML='<p class="muted">当前没有待审批的入群申请。</p>';
        return;
      }
      var h='<div class="prov-list">';
      for(var i=0;i<list.length;i++)h+=grpJoinRow(list[i]);
      h+='</div>';
      box.innerHTML=h;
    })
    .catch(function(e){
      if(st)st.textContent='';
      if(box)box.innerHTML='<p class="error-text">'+esc(qqErrHint(e.message))+'</p>';
    });
}

function approveJoinRequest(rowEl,op,btn){
  var mid=rowEl.getAttribute('data-jmid');
  var jrid=rowEl.getAttribute('data-jrid');
  var name=(rowEl.querySelector('.prov-info b')||{}).textContent||mid;
  var doIt=function(addBlack){
    busy(btn,true);
    api('POST','/api/groups/join-approve',{
      openid:grpModal.openid,memberOpenid:mid,op:op,
      joinRequestId:jrid,addToBlacklist:!!addBlack
    }).then(function(){
      toast(op==='approve'?('已通过 '+name):('已拒绝 '+name),'ok');
      rowEl.parentNode.removeChild(rowEl);
    }).catch(function(e){
      toast(qqErrHint(e.message),'bad');
      busy(btn,false);
    });
  };
  if(op==='approve'){doIt(false);return;}
  confirmDialog({
    title:'拒绝 '+name+' 的入群申请？',
    message:'拒绝后对方会收到通知，需要重新申请才能进群。',
    confirm:'拒绝',
    danger:true
  }).then(function(yes){ if(yes)doIt(false); });
}

function grpBlacklistRow(u){
  var h='<div class="prov-row" data-blid="'+esc(u.member_openid||'')+'">';
  h+='<span class="prov-no">'+(u.bot?'🤖':'🚫')+'</span>';
  h+='<div class="prov-info"><b>'+esc(u.username||'(无昵称)')+'</b><small>'+esc(u.member_openid||'')
    +(u.banned_at?' · 拉黑于 '+esc(absTime(u.banned_at)):'')+'</small></div>';
  h+='<div class="prov-tools"><button class="btn sm" type="button" data-blact="del">移出黑名单</button></div>';
  h+='</div>';
  return h;
}

function loadBlacklist(){
  var st=$('grp-bl-state');
  var box=$('grp-bl-list');
  if(st)st.textContent='正在查询…';
  api('GET','/api/groups/blacklist?openid='+encodeURIComponent(grpModal.openid))
    .then(function(d){
      if(st)st.textContent='';
      if(!box)return;
      var users=(d&&d.users)||[];
      if(!users.length){
        box.innerHTML='<p class="muted">黑名单为空。</p>';
        return;
      }
      var h='<div class="prov-list">';
      for(var i=0;i<users.length;i++)h+=grpBlacklistRow(users[i]);
      h+='</div>';
      box.innerHTML=h;
    })
    .catch(function(e){
      if(st)st.textContent='';
      if(box)box.innerHTML='<p class="error-text">'+esc(qqErrHint(e.message))+'</p>';
    });
}

function parseOpenidList(v){
  var raw=String(v||'');
  var out=[];
  var cur='';
  for(var i=0;i<raw.length;i++){
    var ch=raw.charAt(i);
    var code=raw.charCodeAt(i);
    var isSep=(code===32||code===12288||ch===','||ch==='，');
    if(isSep){ if(cur){out.push(cur);cur='';} }
    else cur+=ch;
  }
  if(cur)out.push(cur);
  return out;
}

function grpMembersRemove(){
  var ids=parseOpenidList(($('grp-bl-mid')||{}).value);
  if(!ids.length){toast('先填成员 openid','bad');return;}
  if(ids.length>20){toast('单次最多 20 个','bad');return;}
  confirmDialog({
    title:'移除 '+ids.length+' 个群成员？',
    message:'被移除的成员需要重新申请才能进群加入。',
    detail:ids.join('、'),
    confirm:'移除',
    danger:true
  }).then(function(yes){
    if(!yes)return;
    api('POST','/api/groups/members-remove',{openid:grpModal.openid,memberOpenids:ids})
      .then(function(d){
        toast('已移除 '+(d&&d.result==='success'?ids.length:0)+' 个成员','ok');
      })
      .catch(function(e){toast(qqErrHint(e.message),'bad');});
  });
}

function grpBlacklistOp(op){
  var ids=parseOpenidList(($('grp-bl-mid')||{}).value);
  if(!ids.length){toast('先填成员 openid','bad');return;}
  if(ids.length>20){toast('单次最多 20 个','bad');return;}
  api('POST','/api/groups/blacklist',{openid:grpModal.openid,op:op,memberOpenids:ids})
    .then(function(d){
      var fail=(d&&d.failOpenids)||[];
      if(fail.length)toast('部分失败：'+fail.length+' 个','bad');
      else toast(op==='add'?'已加入黑名单':'已移出黑名单','ok');
      loadBlacklist();
    })
    .catch(function(e){toast(qqErrHint(e.message),'bad');});
}

function qqErrHint(msg){
  var m=String(msg||'');
  if(m.indexOf('11253')>=0){
    return m+'（这是平台的「内邀能力」：群成员管理相关接口需要联系 QQ 平台运营申请白名单后才能用）';
  }
  if(m.indexOf('40034')>=0||m.indexOf('无权限')>=0){
    return m+'（确认机器人已经是这个群的管理员）';
  }
  return m;
}

function bindGrpExtras(){
  var jr=$('grp-jr-load');
  if(jr)jr.addEventListener('click',loadJoinRequests);
  var bl=$('grp-bl-load');
  if(bl)bl.addEventListener('click',loadBlacklist);
  var rm=$('grp-rm-btn');
  if(rm)rm.addEventListener('click',grpMembersRemove);
  var ba=$('grp-bl-add');
  if(ba)ba.addEventListener('click',function(){grpBlacklistOp('add');});
  var bd=$('grp-bl-del');
  if(bd)bd.addEventListener('click',function(){grpBlacklistOp('del');});

  var jl=$('grp-jr-list');
  if(jl)jl.addEventListener('click',function(e){
    var btn=e.target&&e.target.closest?e.target.closest('[data-jact]'):null;
    if(!btn)return;
    var row=e.target.closest('[data-jmid]');
    if(!row)return;
    approveJoinRequest(row,btn.getAttribute('data-jact'),btn);
  });
  var bll=$('grp-bl-list');
  if(bll)bll.addEventListener('click',function(e){
    var btn=e.target&&e.target.closest?e.target.closest('[data-blact]'):null;
    if(!btn)return;
    var row=e.target.closest('[data-blid]');
    if(!row)return;
    var mid=row.getAttribute('data-blid');
    api('POST','/api/groups/blacklist',{openid:grpModal.openid,op:'del',memberOpenids:[mid]})
      .then(function(){toast('已移出黑名单','ok');loadBlacklist();})
      .catch(function(err){toast(qqErrHint(err.message),'bad');});
  });

  // 折叠头：点标题或回车切换内邀功能区的展开/收起
  var foldHead=document.querySelector('[data-gfold="blacklist"]');
  if(foldHead){
    foldHead.addEventListener('click',function(){
      toggleGrpFold(foldHead);
    });
    foldHead.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        toggleGrpFold(foldHead);
      }
    });
  }
}

function toggleGrpFold(head){
  var body=head.parentNode.querySelector('[data-gfold-body]');
  if(!body)return;
  var hidden=body.hidden;
  body.hidden=!hidden;
  head.classList.toggle('is-open',!hidden);
  head.setAttribute('aria-expanded',hidden?'true':'false');
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
  $('grp-m-members').addEventListener('click',onGrpMemberClick);
  bindGrpExtras();
  bindSel($('grp-modal-mask'));
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

var remState={items:[]};

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
    updateDelSelBtn();
    return;
  }
  var h='<table class="rem-table"><thead><tr>'
    +'<th class="rem-th-check"></th>'
    +'<th>内容</th><th class="rem-th-target">目标</th>'
    +'<th class="rem-th-time">到期时间</th><th class="rem-th-status">状态</th>'
    +'<th class="rem-th-ops">操作</th>'
    +'</tr></thead><tbody>';
  for(var k=0;k<items.length;k++){
    var it=items[k];
    var canCancel=it.status==='pending'||it.status==='sending';
    h+='<tr class="rem-tr" data-rem="'+it.id+'">';
    h+='<td class="rem-td-check"><input type="checkbox" id="rem-sel-'+it.id+'" name="rem-sel-'+it.id+'" data-remsel="'+it.id+'"></td>';
    h+='<td class="rem-td-text"><b>'+esc(it.text)+'</b>'
      +(it.repeatRule?'<span class="rem-repeat">'+esc(remRepeatText(it.repeatRule))+'</span>':'')
      +(it.lastError?'<small class="error-text">'+esc(it.lastError)+'</small>':'')
      +'</td>';
    h+='<td class="rem-td-target"><span class="rem-kind">'+(it.isC2C?'私聊':'群聊')+'</span>'
      +esc(it.scopeMasked||'')+'</td>';
    h+='<td class="rem-td-time" data-label="到期">'+esc(fmtEntryTime(it.dueAt))+'</td>';
    h+='<td class="rem-td-status" data-label="状态">'+remStatusHtml(it.status)+'</td>';
    h+='<td class="rem-td-ops">';
    if(canCancel)h+='<button class="btn sm ghost" type="button" data-remcancel="'+it.id+'">取消</button>';
    h+='<button class="icon-btn sm" type="button" data-remdel="'+it.id+'" title="删除这条任务">'+IX.trash+'</button>';
    h+='</td></tr>';
  }
  h+='</tbody></table>';
  box.innerHTML=h;

  box.onclick=function(e){
    var cancelBtn=e.target&&e.target.closest?e.target.closest('[data-remcancel]'):null;
    if(cancelBtn){
      var id=Number(cancelBtn.getAttribute('data-remcancel'));
      confirmDialog({
        title:'取消这条定时任务？',
        message:'取消后这条任务不会再触发，但仍会留在列表里，可以之后重新创建。',
        confirm:'取消任务',
        cancel:'再想想'
      }).then(function(yes){
        if(!yes)return;
        api('POST','/api/reminders/cancel',{id:id}).then(function(){
          toast('已取消','ok');
          loadReminders();
        }).catch(function(err){toast(err.message,'bad');});
      });
      return;
    }
    var delBtn=e.target&&e.target.closest?e.target.closest('[data-remdel]'):null;
    if(delBtn){
      var did=Number(delBtn.getAttribute('data-remdel'));
      confirmDialog({
        title:'删除这条定时任务？',
        message:'删除后不可恢复。',
        detail:'如果只是想让它不再触发，可以选择「取消任务」，那样记录会保留。',
        confirm:'删除',
        danger:true
      }).then(function(yes){
        if(!yes)return;
        api('POST','/api/reminders/delete',{id:did}).then(function(){
          toast('已删除','ok');
          loadReminders();
        }).catch(function(err){toast(err.message,'bad');});
      });
      return;
    }
  };
  box.onchange=function(e){
    var t=e.target;
    if(!t||!t.matches)return;
    if(t.matches('[data-remsel]')){
      var selAll=$('rem-sel-all');
      var all=box.querySelectorAll('input[data-remsel]');
      var checked=box.querySelectorAll('input[data-remsel]:checked');
      if(selAll)selAll.checked=all.length>0&&checked.length===all.length;
      updateDelSelBtn();
    }
  };

  var selAllBox=$('rem-sel-all');
  if(selAllBox&&!selAllBox.__bound){
    selAllBox.__bound=true;
    selAllBox.addEventListener('change',function(){
      var all=this.checked;
      var cbs=box.querySelectorAll('input[data-remsel]');
      for(var i=0;i<cbs.length;i++)cbs[i].checked=all;
      updateDelSelBtn();
    });
  }
  if(selAllBox){
    var allNow=box.querySelectorAll('input[data-remsel]');
    var checkedNow=box.querySelectorAll('input[data-remsel]:checked');
    selAllBox.checked=allNow.length>0&&checkedNow.length===allNow.length;
  }
  updateDelSelBtn();
}

function selectedReminderIds(){
  var box=$('rem-list');
  if(!box)return [];
  var ids=[];
  var cbs=box.querySelectorAll('input[data-remsel]:checked');
  for(var i=0;i<cbs.length;i++)ids.push(Number(cbs[i].getAttribute('data-remsel')));
  return ids;
}

function updateDelSelBtn(){
  var btn=$('rem-del-sel');
  if(!btn)return;
  var n=selectedReminderIds().length;
  btn.classList.toggle('hidden',n===0);
  btn.innerHTML=IX.trash+'<span>删除选中'+(n?'（'+n+'）':'')+'</span>';
}

function deleteSelectedReminders(){
  var ids=selectedReminderIds();
  if(!ids.length){ toast('先勾选要删除的任务','bad'); return; }
  confirmDialog({
    title:'删除选中的 '+ids.length+' 条定时任务？',
    message:'删除后不可恢复。',
    detail:'如果只是想让它不再触发，可以逐条点「取消」保留记录。',
    confirm:'删除 '+ids.length+' 条',
    danger:true
  }).then(function(yes){
    if(!yes)return;
    api('POST','/api/reminders/delete',{ids:ids}).then(function(d){
      toast('已删除 '+(d&&d.deleted||ids.length)+' 条','ok');
      loadReminders();
    }).catch(function(err){ toast(err.message,'bad'); });
  });
}

function route(){
  var p = String(location.pathname || '/').split('/').filter(function(x){ return x; });
  var tab = p.length ? p[0] : 'status';
  if(tab==='config')showConfig();
  else if(tab==='ai')showAi();
  else if(tab==='imagegen')showAi();
  else if(tab==='workspace'||tab==='groups')showWorkspace();
  else if(tab==='logs')showLogs();
  else showStatus();
}

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

var navLinks = document.querySelectorAll('.tabs a, .side-links a[href^="/"]');
for (var ni = 0; ni < navLinks.length; ni++) {
  navLinks[ni].addEventListener('click', function (ev) {
    var href = this.getAttribute('href') || '';
    if (href.charAt(0) !== '/' || href === '/') return;
    if (href === location.pathname) return;
    ev.preventDefault();
    history.pushState(null, '', href);
    route();
    closeSide();
  });
}

window.addEventListener('popstate',route);
window.addEventListener('beforeunload',stopStatusTimer);
route();
`;
