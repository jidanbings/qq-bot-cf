/**
 * ToolEngine —— 工具执行器（由 WorkDO 内部持有，不是一个独立的 DO）。
 *
 * 机器人主 DO（QQBotDO）只负责收发与派发；真正的工具动作都在这里做：
 * 生图、梗图、语音、定时提醒、查群资料 / 状态 / 禁言。
 *
 * 需要 QQ 能力的信息（access_token、API base）由调用方随请求传入，
 * 本 DO 不保存凭据、不申请 token。
 */
import { addReminder, listMemes } from './db.js';
import { applyMp3Gain } from './utils/mp3-gain.js';
import { parseReminder } from './utils/reminder.js';
import { normalizeFaceTags } from './utils/qq-face.js';
import { withRetry } from './utils/retry.js';

const IMAGE_CAPTIONS = ['画好啦，看看喜不喜欢～', '喏，画好了 ✨', '画出来啦，还满意吗？', '给你画好了，慢慢看～'];
const MEME_CAPTIONS = ['（递上梗图）', '看图你就懂了', '这张太应景了', '来，接梗～'];

function toBase64(bytes) {
  const CHUNK = 3 * 0x4000;
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    let bin = '';
    for (let j = 0; j < chunk.length; j++) bin += String.fromCharCode(chunk[j]);
    out += btoa(bin);
  }
  return out;
}

export class ToolEngine {
  constructor(env) {
    this.env = env;
    this.seq = 0;
  }

  /* ------------------------------ 发送原语 ------------------------------ */

  msgUrl(ctx, withId = false) {
    const t = ctx.isC2C ? `users/${ctx.scopeId}` : `groups/${ctx.scopeId}`;
    return `${ctx.base}/v2/${t}/messages${withId && ctx.msgId ? '' : ''}`;
  }

  async sendText(ctx, content) {
    const text = normalizeFaceTags(String(content || '')).slice(0, 1800);
    if (!text) return null;
    this.seq += 1;
    const res = await fetch(this.msgUrl(ctx), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${ctx.token}` },
      body: JSON.stringify({
        msg_type: 0,
        content: text,
        ...(ctx.msgId ? { msg_id: ctx.msgId, msg_seq: ctx.seqBase + this.seq } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`发送文本失败 HTTP ${res.status}${t ? ' ' + t.slice(0, 100) : ''}`);
    }
    const data = await res.json().catch(() => ({}));
    return data.id || null;
  }

  async upload(ctx, { fileType, source, fileName, fileExt }) {
    const prefix = fileType === 3 ? 'audio' : fileType === 2 ? 'video' : fileType === 4 ? 'file' : 'image';
    const url = `${ctx.base}/v2/${ctx.isC2C ? 'users' : 'groups'}/${ctx.scopeId}/files`;
    let body;
    const dataUri = /^data:([^;]+);base64,(.+)$/i.exec(source || '');
    if (dataUri) {
      const ext = fileExt || (dataUri[1].includes('jpeg') ? 'jpg' : dataUri[1].split('/')[1] || 'bin');
      body = { file_type: fileType, file_name: fileName || `${prefix}.${ext}`, file_data: dataUri[2], srv_send_msg: false };
    } else {
      body = { file_type: fileType, url: source, srv_send_msg: false };
    }
    const res = await withRetry(
      async () => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${ctx.token}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(body.url ? 60000 : 30000),
        });
        if (!r.ok) {
          const err = new Error(`upload HTTP ${r.status}`);
          err.status = r.status;
          throw err;
        }
        return r;
      },
      {
        maxAttempts: 2,
        delay: 700,
        shouldRetry: (e) => e.status === undefined || e.status === 429 || e.status >= 500,
      }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`上传失败 HTTP ${res.status}${t ? ' ' + t.slice(0, 100) : ''}`);
    }
    const data = await res.json();
    if (!data.file_info) throw new Error('上传没有返回 file_info');
    return data.file_info;
  }

  async sendMedia(ctx, { fileType, source, fileExt, fileName }) {
    const fileInfo = await this.upload(ctx, { fileType, source, fileExt, fileName });
    this.seq += 1;
    const res = await withRetry(
      async () => {
        const r = await fetch(this.msgUrl(ctx), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `QQBot ${ctx.token}` },
          body: JSON.stringify({
            msg_type: 7,
            media: { file_info: fileInfo },
            ...(ctx.msgId ? { msg_id: ctx.msgId, msg_seq: ctx.seqBase + this.seq } : {}),
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          const err = new Error(`发送媒体失败 HTTP ${r.status}${t ? ' ' + t.slice(0, 100) : ''}`);
          err.status = r.status;
          throw err;
        }
        return r;
      },
      {
        maxAttempts: 2,
        delay: 700,
        shouldRetry: (e) => e.status === undefined || e.status === 429 || e.status >= 500,
      }
    );
    const data = await res.json().catch(() => ({}));
    return data.id || null;
  }

  /* ------------------------------ 工具实现 ------------------------------ */

  async toolImage(ctx, args, cfg) {
    const model = String(cfg.imageGenModel || '').trim();
    if (!model) throw new Error('还没配置生图模型');
    const base = String(cfg.imageBase || '').trim();
    const key = String(cfg.imageKey || '').trim();
    if (!base || !key) throw new Error('生图接口没配全');
    const prompt = String(args.prompt || '').trim().slice(0, 800);
    if (!prompt) throw new Error('缺少画面描述');

    const res = await fetch(`${base}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, n: 1 }),
      signal: AbortSignal.timeout(150000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`生图失败 HTTP ${res.status}${t ? ' ' + t.slice(0, 100) : ''}`);
    }
    const data = await res.json();
    const item = data.data?.[0] || {};
    const url = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
    if (!url) throw new Error('生图接口没有返回图片');
    await this.sendMedia(ctx, { fileType: 1, source: url, fileExt: 'png' });
    const line = String(args.caption || '').trim() || IMAGE_CAPTIONS[Math.floor(Math.random() * IMAGE_CAPTIONS.length)];
    await this.sendText(ctx, line);
    return { note: `已生成图片并发送（${prompt.slice(0, 30)}）` };
  }

  async toolMeme(ctx, args, cfg) {
    const rows = await listMemes(this.env);
    if (!rows.length) throw new Error('梗图库是空的（部署时会自动导入）');
    let row = null;
    const want = String(args.name || '').trim();
    if (want) row = rows.find((r) => r.name === want);
    if (!row) row = rows[Math.floor(Math.random() * rows.length)];
    const dataUri = `data:image/jpeg;base64,${row.data}`;
    await this.sendMedia(ctx, { fileType: 1, source: dataUri, fileExt: 'jpg' });
    const line = String(args.caption || '').trim() || MEME_CAPTIONS[Math.floor(Math.random() * MEME_CAPTIONS.length)];
    await this.sendText(ctx, line);
    return { note: `已发送梗图「${row.name}」` };
  }

  async synthVoice(text, lang) {
    const ai = this.env && this.env.AI;
    if (!ai || typeof ai.run !== 'function') throw new Error('当前环境没有 Workers AI 绑定');
    const out = await ai.run('@cf/myshell-ai/melotts', { prompt: String(text).slice(0, 300), lang: String(lang || 'zh') });
    let bytes = null;
    if (out instanceof ArrayBuffer) bytes = new Uint8Array(out);
    else if (out instanceof Uint8Array) bytes = out;
    else if (out && typeof out.arrayBuffer === 'function') bytes = new Uint8Array(await out.arrayBuffer());
    else if (out && typeof out.audio === 'string') {
      const bin = atob(out.audio);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else if (out && out.body && typeof out.body.getReader === 'function') {
      bytes = new Uint8Array(await new Response(out.body).arrayBuffer());
    }
    if (!bytes || !bytes.length) throw new Error('TTS 没有返回音频');
    return bytes;
  }

  async toolVoice(ctx, args, cfg) {
    const text = String(args.text || '').trim().slice(0, 300);
    if (!text) throw new Error('缺少要说的内容');
    let bytes = await this.synthVoice(text, cfg.voiceLang || 'zh');
    const gain = Math.max(0, Math.min(12, Number(cfg.voiceGain || '6') || 0));
    if (gain > 0) {
      try {
        bytes = applyMp3Gain(bytes, gain);
      } catch {
        /* 增益失败就用原音频 */
      }
    }
    await this.sendMedia(ctx, { fileType: 3, source: `data:audio/mpeg;base64,${toBase64(bytes)}`, fileExt: 'mp3' });
    if (args.caption) await this.sendText(ctx, args.caption);
    return { note: `已发送语音（${text.slice(0, 30)}）` };
  }

  async toolFile(ctx, args) {
    const name = String(args.name || (args.path || '').split('/').pop() || 'file.txt').slice(0, 80);
    const content = String(args.content == null ? '' : args.content);
    if (!name) throw new Error('缺少文件名');
    const bytes = new TextEncoder().encode(content);
    if (bytes.length > 512 * 1024) throw new Error('文件超过 512KB');
    const ext = name.indexOf('.') >= 0 ? name.split('.').pop().slice(0, 8) : 'txt';
    const msgId = await this.sendMedia(ctx, {
      fileType: 4,
      source: `data:text/plain;base64,${toBase64(bytes)}`,
      fileName: name,
      fileExt: ext,
    });
    if (args.caption) await this.sendText(ctx, args.caption);
    return { note: `已发送文件 ${name}${msgId ? '（id=' + msgId + '）' : ''}` };
  }

  async toolRemind(ctx, args) {
    const when = String(args.when || '').trim();
    const text = String(args.text || '').trim();
    const parsed = parseReminder(when + ' 提醒我 ' + text, Date.now());
    if (!parsed) throw new Error('没听懂时间，试试「明天 8:30」「10分钟后」「每天 8:00」');
    const key = ctx.isC2C ? `c2c:${ctx.scopeId}` : `group:${ctx.scopeId}`;
    await addReminder(this.env, {
      scopeKey: key,
      isC2C: ctx.isC2C ? 1 : 0,
      scopeId: ctx.scopeId,
      dueAt: parsed.dueAt,
      text: parsed.text,
      repeatRule: parsed.repeatRule,
    });
    await this.sendText(ctx, `⏰ 好的，${parsed.whenText}提醒你：${parsed.text}${parsed.repeatRule ? '（重复提醒）' : ''}`);
    return { note: `已设置提醒：${parsed.text.slice(0, 40)} @ ${parsed.dueAt}` };
  }

  async qq(ctx, path) {
    const res = await fetch(`${ctx.base}/v2${path}`, {
      headers: { Authorization: `QQBot ${ctx.token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`QQ 接口 HTTP ${res.status}${t ? ' ' + t.slice(0, 100) : ''}`);
    }
    return res.json();
  }

  formatGroupInfo(info) {
    const lines = [`群名：${info.group_name || '(未命名)'}`];
    if (info.class_text) lines.push(`分类：${info.class_text}`);
    if (info.member_num != null) lines.push(`人数：${info.member_num}`);
    if (info.finger_memo) lines.push(`简介：${String(info.finger_memo).slice(0, 200)}`);
    return lines.join('\n');
  }

  formatBotState(st) {
    const roleMap = { owner: '群主', admin: '管理员', member: '普通成员' };
    const recvMap = { all: '全部消息', only_mention: '仅 @我', mention_and_context: '仅 @我 + 上下文' };
    const lines = [`我的角色：${roleMap[st.member_role] || st.member_role || '未知'}`];
    if (st.recv_msg_setting) lines.push(`消息接收：${recvMap[st.recv_msg_setting] || st.recv_msg_setting}`);
    lines.push(`允许主动推送：${st.allow_proactive_msg ? '是' : '否'}`);
    return lines.join('\n');
  }

  formatMuteState(ms) {
    const mode = ms && ms.global_rule ? ms.global_rule.mode : 'none';
    const modeTxt = mode === 'always' ? '全员禁言中' : mode === 'schedule' ? '定时/周期禁言' : '未开启全员禁言';
    const members = Array.isArray(ms && ms.members) ? ms.members : [];
    const lines = [`全员禁言：${modeTxt}`];
    if (members.length) {
      lines.push(`被禁言成员（${members.length}）：`);
      for (const m of members.slice(0, 5)) {
        const until = m.mute_expire_at ? new Date(m.mute_expire_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—';
        lines.push(`· ${m.username || '(无昵称)'} 到 ${until}`);
      }
    } else lines.push('当前没有成员被禁言');
    return lines.join('\n');
  }

  /* ------------------------------ 入口 ------------------------------ */

  async exec({ tool, args, ctx, cfg }) {
    this.seq = 0;
    const a = args && typeof args === 'object' ? args : {};
    try {
      let out;
      if (tool === 'image') out = await this.toolImage(ctx, a, cfg || {});
      else if (tool === 'meme') out = await this.toolMeme(ctx, a, cfg || {});
      else if (tool === 'voice') out = await this.toolVoice(ctx, a, cfg || {});
      else if (tool === 'file') out = await this.toolFile(ctx, a);
      else if (tool === 'remind') out = await this.toolRemind(ctx, a);
      else if (tool === 'group_info' || tool === 'group_state' || tool === 'mute_state') {
        if (ctx.isC2C) throw new Error('这个只能在群里查');
        if (tool === 'group_info') await this.sendText(ctx, this.formatGroupInfo(await this.qq(ctx, `/groups/${ctx.scopeId}/info`)));
        else if (tool === 'group_state') await this.sendText(ctx, this.formatBotState(await this.qq(ctx, `/groups/${ctx.scopeId}/bot_state`)));
        else await this.sendText(ctx, this.formatMuteState(await this.qq(ctx, `/groups/${ctx.scopeId}/restrict_chat_setting`)));
        out = { note: `已执行 ${tool}` };
      } else {
        throw new Error(`不认识工具「${tool}」`);
      }
      return { ok: true, used: this.seq, note: out.note };
    } catch (e) {
      try {
        await this.sendText(ctx, `工具「${tool}」执行失败：${String(e.message).slice(0, 80)}`);
      } catch {
        /* 连错误都发不出去就放弃 */
      }
      return { ok: false, used: this.seq, note: `工具 ${tool} 失败：${e.message.slice(0, 60)}` };
    }
  }

}

