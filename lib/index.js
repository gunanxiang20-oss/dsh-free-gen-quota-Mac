/**
 * dsh-free-gen-quota — 免费生图/生视频额度工场
 *
 * 职责：
 *  1. 市面免费渠道目录（lib/catalog.js，离线数据）
 *  2. 领取引擎：guide（控制台开通引导）/ key（密钥托管+检测）/ checkin（HTTP 自动签到）/ bridge（免密钥内置桥）
 *  3. Pollinations 本地桥：在 127.0.0.1 固定端口暴露 OpenAI 兼容 /v1/images/generations，
 *     把免密钥 GET 翻译成团团TV 可直接消费的协议
 *  4. 一键「写入团团TV」：通过宿主 settings 服务把渠道合并进 dsh-imagegen 命名空间（保留用户已有渠道）
 *  5. 自动领取调度：对 checkin 型渠道按周期自动签到，结果落盘 ~/.dsh/free-gen-quota/
 *  6. Agent 工具 + 自带 HTML 面板（GET /api/free-gen/panel）
 *
 * 刻意的边界：
 *  - 不动用户已配置的渠道；合并语义 = 保留非本插件的渠道 + upsert 本插件渠道
 *  - 凭据只落本机 ~/.dsh/free-gen-quota/state.json（0600）
 *  - 视频类免费额度以「引导 + 额度检测」为主，不代提交付费动作
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import http from 'node:http';
import { CATALOG } from './catalog.js';

const PLUGIN_NAME = 'dsh-free-gen-quota';
const DATA_DIR = process.env.DSH_HOME?.trim()
  ? join(process.env.DSH_HOME.trim(), 'free-gen-quota')
  : join(homedir(), '.dsh', 'free-gen-quota');
const STATE_FILE = join(DATA_DIR, 'state.json');
const LOG_FILE = join(DATA_DIR, 'claims.jsonl');
const IMAGEGEN_NS = 'dsh-imagegen';
const AGENT_SECTION_ORDER = 4200;

/* ───────────────────────── state ───────────────────────── */

function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return { providers: {}, autoClaim: true, ...parsed };
    }
  } catch {}
  return { providers: {}, autoClaim: true, lastAutoRun: 0, createdAt: Date.now() };
}

function saveState(state) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(tmp, STATE_FILE);
  try { chmodSync(STATE_FILE, 0o600); } catch {}
}

function appendLog(entry) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(LOG_FILE, `${JSON.stringify({ at: Date.now(), ...entry })}\n`, { flag: 'a' });
  } catch {}
}

function providerState(state, id) {
  state.providers[id] ??= {};
  return state.providers[id];
}

function maskKey(value) {
  const text = String(value ?? '');
  if (text === '') return '';
  if (text.length <= 10) return `${text.slice(0, 2)}****`;
  return `${text.slice(0, 6)}****${text.slice(-4)}`;
}

/* ───────────────────────── pollinations bridge ───────────────────────── */

function parseSizeToPixels(size, fallbackWidth, fallbackHeight) {
  const text = String(size ?? '').trim().toLowerCase();
  const fixed = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1024, 1024], '4:3': [1152, 864], '3:4': [864, 1152] };
  if (fixed[text]) return fixed[text];
  const wh = /^(\d{2,4})\s*[x×]\s*(\d{2,4})$/.exec(text);
  if (wh) {
    const w = Math.min(2048, Math.max(64, Number(wh[1])));
    const h = Math.min(2048, Math.max(64, Number(wh[2])));
    return [w, h];
  }
  return [fallbackWidth, fallbackHeight];
}

function fetchWithTimeout(url, options = {}, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('bridge timeout')), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/* 匿名档限速：1 张 / 45 秒 / IP。桥内全局排队：consecutive 请求自动顺延；402/429 解析 Retry after 后重试一次。 */
const POLLINATIONS_MIN_INTERVAL_MS = 45_000;
const POLLINATIONS_MAX_WAIT_MS = 42_000;
let pollinationsLastStartAt = 0;

const bridgeSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryAfterMs(bodyText) {
  const match = /retry\s*after\s*(\d+)\s*s/i.exec(String(bodyText ?? ''));
  return match ? Math.min(120, Number(match[1])) * 1000 : 0;
}

async function pollinationsFetch(url) {
  const wait = POLLINATIONS_MIN_INTERVAL_MS - (Date.now() - pollinationsLastStartAt);
  if (wait > 0 && wait <= POLLINATIONS_MAX_WAIT_MS) await bridgeSleep(wait);
  let response = await fetchWithTimeout(url, { method: 'GET' }, 110_000);
  if (response.status === 402 || response.status === 429) {
    const text = await response.text().catch(() => '');
    const retryMs = parseRetryAfterMs(text) || Math.max(1000, POLLINATIONS_MIN_INTERVAL_MS - (Date.now() - pollinationsLastStartAt));
    if (retryMs > 0 && retryMs <= POLLINATIONS_MAX_WAIT_MS) {
      await bridgeSleep(retryMs + 1500);
      response = await fetchWithTimeout(url, { method: 'GET' }, 110_000);
      if (!response.ok) {
        const retryText = await response.text().catch(() => '');
        throw new Error(`pollinations 免费档限速未解除（HTTP ${response.status}）：${retryText.slice(0, 160)}。等一分钟再点，或到「免费额度工场」面板配置 SiliconFlow/ModelScope 免费 Key`);
      }
    } else {
      throw new Error(`pollinations 免费档限速（1 张/45 秒/IP），本次需等待 ${Math.ceil(retryMs / 1000)} 秒超出桥内上限。稍等再点，或到「免费额度工场」面板配置 SiliconFlow/ModelScope 免费 Key 解锁`);
    }
  }
  pollinationsLastStartAt = Date.now();
  return response;
}

async function generateWithPollinations(bridge, body) {
  const model = typeof body?.model === 'string' && body.model.trim() !== '' ? body.model.trim() : bridge.defaultModel;
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt === '') throw new Error('prompt is required');
  const [width, height] = parseSizeToPixels(body?.size, bridge.defaultWidth, bridge.defaultHeight);
  const n = Math.min(4, Math.max(1, Number(body?.n ?? 1) || 1));
  const data = [];
  for (let index = 0; index < n; index += 1) {
    const url = new URL(bridge.upstreamBase.endsWith('/') ? `${bridge.upstreamBase}${encodeURIComponent(prompt)}` : `${bridge.upstreamBase}/${encodeURIComponent(prompt)}`);
    url.searchParams.set('model', model);
    url.searchParams.set('width', String(width));
    url.searchParams.set('height', String(height));
    url.searchParams.set('nologo', 'true');
    url.searchParams.set('safe', 'false');
    if (index > 0) url.searchParams.set('seed', String(Math.floor(Math.random() * 1_000_000)));
    const response = await pollinationsFetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`pollinations HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    data.push({ b64_json: buffer.toString('base64') });
    if (index < n - 1) await bridgeSleep(1200);
  }
  return { created: Math.floor(Date.now() / 1000), data };
}

function startBridgeServer(bridge, port, log) {
  return new Promise((resolve) => {
    const attempt = (currentPort, remaining) => {
      const server = http.createServer(async (req, res) => {
        const pathname = new URL(req.url ?? '/', 'http://x').pathname.replace(/\/+$/, '') || '/';
        try {
          if (pathname === '/v1/models' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: [{ id: 'sana', object: 'model' }] }));
            return;
          }
          if (pathname === '/v1/images/generations' && req.method === 'POST') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            let body = {};
            try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch {}
            const result = await generateWithPollinations(bridge, body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
          }
          if (pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, plugin: PLUGIN_NAME }));
            return;
          }
          res.writeHead(404).end();
        } catch (error) {
          log?.(`bridge: ${error?.message ?? error}`);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: String(error?.message ?? error) } }));
        }
      });
      server.on('error', (error) => {
        if (error?.code === 'EADDRINUSE' && remaining > 0) {
          attempt(currentPort + 1, remaining - 1);
        } else {
          log?.(`bridge: bind failed on ${currentPort}: ${error?.message ?? error}`);
          resolve(null);
        }
      });
      server.listen(currentPort, '127.0.0.1', () => resolve({ server, port: currentPort }));
    };
    attempt(port, 10);
  });
}

/* ───────────────────────── claim / probe engine ───────────────────────── */

async function runCheckin(entry, credential, log) {
  const spec = entry.checkin;
  const headers = {};
  for (const [header, template] of Object.entries(spec.headers ?? {})) {
    headers[header] = String(template).replaceAll('{{credential}}', credential ?? '');
  }
  let body;
  if (spec.body !== undefined && spec.method !== 'GET') {
    body = JSON.stringify(typeof spec.body === 'string' ? { text: spec.body } : spec.body);
    headers['Content-Type'] ??= 'application/json';
  }
  const response = await fetchWithTimeout(spec.url, { method: spec.method ?? 'POST', headers, body }, 20_000);
  const text = await response.text().catch(() => '');
  const ok = response.ok && (spec.successMatch ? new RegExp(spec.successMatch, 'i').test(text) : true);
  return { ok, status: response.status, excerpt: text.slice(0, 300) };
}

async function probeImageGeneric(apiUrl, apiKey, model, size, protocol) {
  if (protocol === 'chat-completions') {
    const response = await fetchWithTimeout(`${apiUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: `生成一张图片：红色热气球飘在绿色山丘上空` }] })
    }, 60_000);
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, excerpt: text.slice(0, 240) };
  }
  if (protocol === 'qwen-draw') {
    const root = apiUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    const response = await fetchWithTimeout(`${root}/api/v1/services/aigc/text2image/image-synthesis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'X-DashScope-Async': 'enable' },
      body: JSON.stringify({ model, input: { prompt: '红色热气球飘在绿色山丘上空' }, parameters: { size: '1024*1024', n: 1 } })
    }, 30_000);
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, excerpt: text.slice(0, 240) };
  }
  if (protocol === 'minimax') {
    const response = await fetchWithTimeout(`${apiUrl.replace(/\/+$/, '')}/image_generation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt: '红色热气球飘在绿色山丘上空', width: 1024, height: 1024 })
    }, 60_000);
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, excerpt: text.slice(0, 240) };
  }
  const response = await fetchWithTimeout(`${apiUrl.replace(/\/+$/, '')}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt: '红色热气球飘在绿色山丘上空，明亮色调', n: 1, size })
  }, 90_000);
  const text = await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, excerpt: text.slice(0, 240) };
}

async function probeProvider(entry, state, log) {
  const provider = providerState(state, entry.id);
  if (entry.kind === 'bridge') {
    const health = await fetchWithTimeout(`http://127.0.0.1:${bridgeState.port}/health`, {}, 5_000).then((r) => r.ok).catch(() => false);
    return { ok: health, note: health ? '本地桥在线（免密钥）' : '本地桥不在线' };
  }
  if (entry.kind !== 'key' || !entry.channel || !entry.probe) return { ok: false, note: '该渠道不支持自动检测' };
  const apiKey = provider.key ?? '';
  if (apiKey === '') return { ok: false, note: '未保存 API Key' };
  let url = entry.probe.url ?? '';
  if (url.includes('{{accountId}}')) {
    url = url.replaceAll('{{accountId}}', provider.accountId ?? '');
    if ((provider.accountId ?? '') === '') return { ok: false, note: '缺少 Account ID（面板里补填）' };
  }
  if (entry.probe.raw) {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ prompt: 'a red balloon over green hills' })
    }, 90_000);
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, excerpt: text.slice(0, 240) };
  }
  return await probeImageGeneric(entry.channel.apiUrl, apiKey, entry.probe.model, entry.probe.size ?? '1024x1024', entry.channel.protocol ?? 'images');
}

/* ───────────────────────── write into 团团TV ───────────────────────── */

function buildChannel(entry, state, bridgePort) {
  if (entry.id === 'pollinations') {
    return {
      id: 'freegen/pollinations', preset: '', name: 'Pollinations 免费生图（本地桥）',
      apiUrl: `http://127.0.0.1:${bridgePort}/v1`, apiUrlFull: false, watermark: false,
      protocol: 'images', auth: 'api-key', subscription: '',
      models: entry.models.map((m) => ({ alias: m.alias, id: m.id })), videoModels: []
    };
  }
  if (!entry.channel) return null;
  const provider = providerState(state, entry.id);
  const hasKey = (provider.key ?? '') !== '';
  if (!hasKey) return null;
  return {
    id: `freegen/${entry.id}`, preset: '', name: entry.name.split('（')[0] + '（免费额度）',
    apiUrl: entry.channel.apiUrl, apiUrlFull: false, watermark: false,
    protocol: entry.channel.protocol ?? 'images', auth: 'api-key', subscription: '',
    models: (entry.channel.models ?? []).map((m) => ({ alias: m.alias, id: m.id })),
    videoModels: (entry.channel.videoModels ?? []).map((m) => ({ alias: m.alias, id: m.id }))
  };
}

function secretKeyFor(entry, state, bridgePort) {
  if (entry.id === 'pollinations') return 'pollinations-free';
  const provider = providerState(state, entry.id);
  return provider.key ?? '';
}

/* ───────────────────────── panel html ───────────────────────── */

function panelHtml(ctxPath) {
  return `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>免费生图额度工场 · Free Gen Quota</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box;margin:0}
body{background:#0e1013;color:#e6e8ec;font:14px/1.6 -apple-system,'PingFang SC','Microsoft YaHei',sans-serif;padding:28px}
h1{font-size:20px;margin-bottom:4px}
.sub{color:#8a919e;font-size:12px;margin-bottom:20px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap}
button{background:#23282f;border:1px solid #323a44;color:#e6e8ec;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px}
button.primary{background:#2f6feb;border-color:#2f6feb}
button:disabled{opacity:.45;cursor:not-allowed}
.card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.name{font-weight:600;font-size:14px}
.tag{display:inline-block;font-size:11px;border-radius:99px;padding:1px 8px;margin-left:8px;vertical-align:1px}
.tag.image{background:#173a2a;color:#4ade80}.tag.video{background:#3a2a17;color:#fbbf24}.tag.both{background:#1c2f4a;color:#60a5fa}
.tag.kind{background:#2b2f36;color:#a8b3c0}
.free{color:#9aa4b2;font-size:12px;margin:6px 0}
.steps{color:#7d8794;font-size:12px;margin:6px 0 0 0;white-space:pre-line}
.status{font-size:12px;margin-top:8px}
.ok{color:#4ade80}.bad{color:#f87171}.warn{color:#fbbf24}
.krow{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
input{background:#171a1f;border:1px solid #323a44;border-radius:8px;color:#e6e8ec;padding:6px 10px;font-size:12px;min-width:240px}
.actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
#log{background:#0b0d10;border:1px solid #23282f;border-radius:10px;padding:10px;font:11px/1.5 ui-monospace,monospace;color:#8a919e;max-height:180px;overflow:auto;margin-top:18px;white-space:pre-wrap}
a{color:#6ea8fe;text-decoration:none}
</style></head><body>
<h1>🪙 免费生图 / 生视频额度工场</h1>
<div class="sub">目录 · 领取 · 检测 · 一键写入团团TV — 数据仅存本机 <a href="#" id="datadir">~/.dsh/free-gen-quota</a></div>
<div class="bar">
  <button class="primary" id="claimAll">🎫 一键领取全部</button>
  <button id="probeAll">🔎 检测全部已配置渠道</button>
  <label style="font-size:12px;color:#8a919e"><input type="checkbox" id="autoClaim" style="min-width:0"/> 自动领取（每日）</label>
</div>
<div id="list"></div>
<div id="log"></div>
<script>
const $=s=>document.querySelector(s);const list=$('#list');const log=$('#log');
function put(t){log.textContent=(t+'\\n'+log.textContent).slice(0,4000)}
async function api(path,body){const r=await fetch('/api/free-gen/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});return r.json()}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function render(d){list.innerHTML='';for(const e of d.catalog){const p=d.providers[e.id]||{};
 const card=document.createElement('div');card.className='card';
 const tags=\`<span class="tag \${e.category}">\${e.category==='both'?'图+视频':e.category==='image'?'生图':'生视频'}</span><span class="tag kind">\${e.kind==='bridge'?'免密钥':e.kind==='key'?'填Key':e.kind==='checkin'?'可自动签到':'引导开通'}</span>\`;
 const keyRow=e.kind==='key'? \`<div class="krow"><input placeholder="API Key" data-k="\${e.id}"/><input placeholder="Account ID（仅 Cloudflare 需要）" data-a="\${e.id}" style="display:none" id="acct-\${e.id}"/><button data-save="\${e.id}">保存密钥</button></div>\`:e.kind==='checkin'? \`<div class="krow"><input placeholder="Cookie / 凭据" data-c="\${e.id}"/><button data-savec="\${e.id}">保存凭据</button></div>\`:'';
 const status=p.lastProbeAt?\`<div class="status \${p.lastProbeOk?'ok':'bad'}">检测：\${p.lastProbeOk?'✅ 可用':'❌ 失败'} \${esc(p.lastNote||'')} \${new Date(p.lastProbeAt).toLocaleString()}</div>\`:p.lastClaimAt?\`<div class="status warn">上次领取：\${new Date(p.lastClaimAt).toLocaleString()} \${esc(p.lastClaimNote||'')}</div>\`:'';
 const claimLabel=e.kind==='bridge'?'内置桥·无需领取':e.kind==='guide'?'复制开通链接':e.kind==='checkin'?'立即签到':'标记已领取';
 const installable=e.kind==='bridge'||(e.channel&&(p.key||'')!=='');
 card.innerHTML=\`<div class="row"><div><div class="name">\${esc(e.name)}\${tags}</div>
 <div class="free">🎁 \${esc(e.freeTier)} · \${esc(e.cost||'')}</div>
 \${e.claimUrl?\`<div class="free">🔗 <a href="\${e.claimUrl}" target="_blank">\${e.claimUrl}</a></div>\`:''}
 \${e.claimSteps?\`<div class="steps">\${e.claimSteps.map(s=>'· '+esc(s)).join('\\n')}</div>\`:''}
 \${keyRow}\${status}
 <div class="actions">
  <button data-claim="\${e.id}">\${claimLabel}</button>
  \${e.probe?\`<button data-probe="\${e.id}">🔎 检测额度</button>\`:''}
  <button data-install="\${e.id}" \${installable?'':'disabled'}>📥 写入团团TV</button>
 </div></div></div>\`;
 list.appendChild(card);
 if(e.id==='cloudflare-ai'){const inp=card.querySelector('input[data-k]');inp&&inp.addEventListener('input',()=>{const a=card.querySelector('#acct-'+e.id);if(a)a.style.display=inp.value.startsWith('')?'inline-block':'inline-block'})}}
 for(const b of document.querySelectorAll('[data-claim]'))b.onclick=async()=>{put('领取 '+b.dataset.claim+' …');const r=await api('claim',{id:b.dataset.claim});put(JSON.stringify(r.result||r).slice(0,400));load()};
 for(const b of document.querySelectorAll('[data-probe]'))b.onclick=async()=>{put('检测 '+b.dataset.probe+' …');const r=await api('probe',{id:b.dataset.probe});put(JSON.stringify(r.result||r).slice(0,400));load()};
 for(const b of document.querySelectorAll('[data-install]'))b.onclick=async()=>{put('写入团团TV '+b.dataset.install+' …');const r=await api('install',{id:b.dataset.install});put(JSON.stringify(r.result||r).slice(0,400))};
 for(const b of document.querySelectorAll('[data-save]'))b.onclick=async()=>{const inp=document.querySelector('input[data-k="'+b.dataset.save+'"]');const acct=document.querySelector('input[data-a="'+b.dataset.save+'"]');const r=await api('save',{id:b.dataset.save,key:inp.value,accountId:acct?acct.value:''});put(JSON.stringify(r.result||r).slice(0,300));load()};
 for(const b of document.querySelectorAll('[data-savec]'))b.onclick=async()=>{const inp=document.querySelector('input[data-c="'+b.dataset.savec+'"]');const r=await api('save',{id:b.dataset.savec,credential:inp.value});put(JSON.stringify(r.result||r).slice(0,300));load()};
}
async function load(){const d=await api('state');render(d);$('#autoClaim').checked=!!d.autoClaim}
$('#autoClaim').onchange=async(e)=>{await api('save',{autoClaim:e.target.checked});put('自动领取：'+(e.target.checked?'开':'关'))}
$('#claimAll').onclick=async()=>{put('一键领取全部 …');const r=await api('claim',{all:true});put(JSON.stringify(r.result||r).slice(0,900));load()}
$('#probeAll').onclick=async()=>{for(const b of document.querySelectorAll('[data-probe]')){b.click();await new Promise(r=>setTimeout(r,1500))}}
load();
</script></body></html>`;
}

/* ───────────────────────── plugin entry ───────────────────────── */

export const name = PLUGIN_NAME;
export const inject = ['webServer', 'systemPrompt', 'tools'];

let bridgeState = { port: 0, server: null };

export function apply(ctx, config) {
  const log = (message) => { try { ctx.logger?.warn?.(`[${PLUGIN_NAME}] ${message}`); } catch {} };
  const state = loadState();
  if (config?.autoClaim === false) state.autoClaim = false;

  /* 1. Pollinations 本地桥（固定回环端口，失败则顺延） */
  const pollinationsEntry = CATALOG.find((entry) => entry.id === 'pollinations');
  ctx.effect(() => {
    let disposed = false;
    let handle = null;
    startBridgeServer(pollinationsEntry.bridge, Number(config?.bridgePort ?? 18973), log).then((result) => {
      if (disposed) { result?.server?.close?.(); return; }
      if (result) {
        bridgeState = result;
        state.bridgePort = result.port;
        saveState(state);
        log(`bridge listening on 127.0.0.1:${result.port}`);
      }
    });
    return () => {
      disposed = true;
      try { bridgeState.server?.close?.(); } catch {}
    };
  }, 'free-gen-quota: bridge server');

  /* 2. 领取 / 检测 / 写入 的核心动作 */
  async function doClaim(entry, state) {
    const provider = providerState(state, entry.id);
    const at = Date.now();
    if (entry.kind === 'bridge') {
      provider.lastClaimAt = at; provider.lastClaimNote = '免密钥渠道，无需领取';
      appendLog({ type: 'claim', id: entry.id, ok: true, note: 'bridge' });
      return { id: entry.id, ok: true, note: '免密钥渠道已内置，直接「写入团团TV」即可' };
    }
    if (entry.kind === 'key') {
      const hasKey = (provider.key ?? '') !== '';
      provider.lastClaimAt = at;
      provider.lastClaimNote = hasKey ? '密钥已保存，可检测额度' : '等待注册并保存 API Key';
      appendLog({ type: 'claim', id: entry.id, ok: hasKey, note: provider.lastClaimNote });
      return { id: entry.id, ok: hasKey, note: hasKey ? '密钥已就绪，点「检测额度」验证' : `请先注册并保存 Key：${entry.claimUrl ?? ''}` };
    }
    if (entry.kind === 'checkin') {
      const credential = provider.credential ?? '';
      if (credential === '') {
        provider.lastClaimAt = at; provider.lastClaimNote = '缺少 Cookie/凭据，未签到';
        return { id: entry.id, ok: false, note: `请先保存凭据：${entry.claimUrl ?? ''}` };
      }
      const result = await runCheckin(entry, credential, log);
      provider.lastClaimAt = at;
      provider.lastClaimNote = result.ok ? `签到成功（HTTP ${result.status}）` : `签到未确认：${result.excerpt}`;
      provider.lastClaimOk = result.ok;
      appendLog({ type: 'claim', id: entry.id, ok: result.ok, status: result.status, excerpt: result.excerpt });
      return { id: entry.id, ok: result.ok, note: provider.lastClaimNote, excerpt: result.excerpt };
    }
    provider.lastClaimAt = at;
    provider.lastClaimNote = '引导领取';
    appendLog({ type: 'claim', id: entry.id, ok: true, note: 'guide' });
    return { id: entry.id, ok: true, note: '请在浏览器打开控制台完成开通/注册', url: entry.claimUrl ?? '', steps: entry.claimSteps ?? [] };
  }

  async function doProbe(entry, state) {
    const result = await probeProvider(entry, state, log);
    const provider = providerState(state, entry.id);
    provider.lastProbeAt = Date.now();
    provider.lastProbeOk = result.ok === true;
    provider.lastNote = result.note ?? result.excerpt ?? '';
    appendLog({ type: 'probe', id: entry.id, ...result });
    return { id: entry.id, ...result };
  }

  async function doInstall(entry, state, settings, setDefault) {
    const channel = buildChannel(entry, state, bridgeState.port ?? Number(config?.bridgePort ?? 18973));
    if (channel === null) {
      return { id: entry.id, ok: false, note: entry.id === 'pollinations' ? '本地桥未就绪' : '该渠道需要先保存 API Key，或为纯引导型渠道' };
    }
    const descriptor = settings.describe({ redactSecrets: true }).find((candidate) => String(candidate.ns) === IMAGEGEN_NS);
    if (descriptor === undefined) return { id: entry.id, ok: false, note: '未找到团团TV 的设置命名空间（插件未加载？）' };
    const current = descriptor.value ?? {};
    const channels = Array.isArray(current.channels) ? current.channels : [];
    const merged = [...channels.filter((existing) => existing.id !== channel.id), channel];
    const ops = [
      { op: 'set', path: ['channels'], value: merged },
      { op: 'set', path: ['channelSecrets', channel.id], value: secretKeyFor(entry, state, bridgeState.port) }
    ];
    if (setDefault === true) {
      ops.push({ op: 'set', path: ['defaultChannelId'], value: channel.id });
      const firstModel = (channel.models ?? [])[0]?.alias ?? '';
      const firstVideo = (channel.videoModels ?? [])[0]?.alias ?? '';
      if (firstModel !== '') ops.push({ op: 'set', path: ['defaultModel'], value: firstModel });
      if (firstVideo !== '') ops.push({ op: 'set', path: ['defaultVideoModel'], value: firstVideo });
    }
    await settings.mutate(IMAGEGEN_NS, ops, descriptor.revision);
    providerState(state, entry.id).installedAt = Date.now();
    saveState(state);
    appendLog({ type: 'install', id: entry.id, channelId: channel.id });
    return { id: entry.id, ok: true, note: `已写入团团TV：渠道 ${channel.id}`, channelId: channel.id };
  }

  /* 3. 同源 HTTP 路由 + 面板 */
  ctx.inject(['webServer', 'settings'], (sctx) => {
    const settings = sctx.get('settings');
    const readBody = async (req) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
    };
    const json = (res, code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };

    const stateView = () => ({
      catalog: CATALOG.map((entry) => ({ ...entry, checkin: entry.checkin ? { ...entry.checkin, headers: Object.keys(entry.checkin.headers ?? {}) } : undefined })),
      providers: Object.fromEntries(Object.entries(state.providers).map(([id, value]) => [id, { ...value, key: maskKey(value.key), credential: value.credential ? '***已存***' : '' }])),
      autoClaim: state.autoClaim !== false,
      lastAutoRun: state.lastAutoRun ?? 0,
      bridgePort: bridgeState.port ?? state.bridgePort ?? 0
    });

    const dispose1 = sctx.webServer.register({
      kind: 'exact', path: '/api/free-gen/state',
      handler: async (req, res) => { if (req.method !== 'POST') { res.writeHead(405).end(); return; } json(res, 200, { ok: true, result: stateView() }); }
    });
    const dispose2 = sctx.webServer.register({
      kind: 'exact', path: '/api/free-gen/claim',
      handler: async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        const body = await readBody(req);
        const targets = body.all === true ? CATALOG : CATALOG.filter((entry) => entry.id === body.id);
        const results = [];
        for (const entry of targets) { try { results.push(await doClaim(entry, state)); } catch (error) { results.push({ id: entry.id, ok: false, note: String(error?.message ?? error) }); } }
        saveState(state);
        json(res, 200, { ok: true, result: { results } });
      }
    });
    const dispose3 = sctx.webServer.register({
      kind: 'exact', path: '/api/free-gen/probe',
      handler: async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        const body = await readBody(req);
        const targets = body.all === true ? CATALOG.filter((entry) => entry.probe) : CATALOG.filter((entry) => entry.id === body.id);
        const results = [];
        for (const entry of targets) { try { results.push(await doProbe(entry, state)); } catch (error) { results.push({ id: entry.id, ok: false, note: String(error?.message ?? error) }); } }
        saveState(state);
        json(res, 200, { ok: true, result: { results } });
      }
    });
    const dispose4 = sctx.webServer.register({
      kind: 'exact', path: '/api/free-gen/save',
      handler: async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        const body = await readBody(req);
        const entry = CATALOG.find((candidate) => candidate.id === body.id);
        if (entry === undefined) { json(res, 200, { ok: false, note: 'unknown provider' }); return; }
        const provider = providerState(state, body.id);
        if (typeof body.key === 'string' && body.key.trim() !== '') provider.key = body.key.trim();
        if (typeof body.credential === 'string' && body.credential.trim() !== '') provider.credential = body.credential.trim();
        if (typeof body.accountId === 'string' && body.accountId.trim() !== '') provider.accountId = body.accountId.trim();
        if (typeof body.autoClaim === 'boolean') state.autoClaim = body.autoClaim;
        saveState(state);
        json(res, 200, { ok: true, note: 'saved' });
      }
    });
    const dispose5 = sctx.webServer.register({
      kind: 'exact', path: '/api/free-gen/install',
      handler: async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return; }
        const body = await readBody(req);
        const targets = body.all === true ? CATALOG : CATALOG.filter((entry) => entry.id === body.id);
        const results = [];
        for (const entry of targets) {
          try { results.push(await doInstall(entry, state, settings, body.setDefault === true)); }
          catch (error) { results.push({ id: entry.id, ok: false, note: String(error?.message ?? error) }); }
        }
        saveState(state);
        json(res, 200, { ok: true, result: { results } });
      }
    });
    const dispose6 = sctx.webServer.register({
      kind: 'exact', path: '/api/free-gen/panel',
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(panelHtml('/api/free-gen/'));
      }
    });
    return () => { for (const dispose of [dispose1, dispose2, dispose3, dispose4, dispose5, dispose6]) dispose?.(); };
  }, 'free-gen-quota: routes');

  /* 4. Agent 工具 */
  ctx.inject(['tools'], (tctx) => {
    const define = (definition) => definition;
    const toolOutput = (properties, requiredList = []) => ({
      schema: { type: 'object', properties, ...(requiredList.length > 0 ? { required: requiredList } : {}) },
      render: (_args, value) => JSON.stringify(value, null, 1)
    });
    const disposeCatalog = tctx.tools.register(define({
      name: 'freegen_catalog',
      description: 'List free-tier image/video generation providers in the Free Gen Quota catalog, with claim kind, free-tier notes, saved-key status and probe state. Call before claiming or installing.',
      parameters: { detail: { type: 'string', description: 'Optional filter: image | video | both | all. Defaults to all.' } },
      output: toolOutput({ catalog: { type: 'array', items: { type: 'object' } } }),
      async execute(args) {
        const wanted = String(args?.detail ?? 'all');
        const items = CATALOG.filter((entry) => wanted === 'all' || entry.category === wanted || entry.category === 'both')
          .map((entry) => {
            const provider = state.providers[entry.id] ?? {};
            return {
              id: entry.id, name: entry.name, category: entry.category, kind: entry.kind,
              freeTier: entry.freeTier, claimUrl: entry.claimUrl ?? '',
              keySaved: (provider.key ?? '') !== '', credentialSaved: (provider.credential ?? '') !== '',
              lastProbeOk: provider.lastProbeOk ?? null, lastNote: provider.lastNote ?? '',
              installedAt: provider.installedAt ?? 0
            };
          });
        return { catalog: items, bridgePort: bridgeState.port ?? state.bridgePort ?? 0 };
      }
    }));
    const disposeClaim = tctx.tools.register(define({
      name: 'freegen_claim',
      description: 'Claim free generation quota. kind=bridge: nothing to claim (built-in); kind=key: marks key workflow; kind=checkin: runs the HTTP check-in with the stored credential; kind=guide: returns the console URL and steps. Pass {all:true} for one-click claim of everything.',
      parameters: {
        id: { type: 'string', description: 'Provider id from freegen_catalog. Omit together with all:true for one-click claim.' },
        all: { type: 'boolean', description: 'Claim every provider in the catalog.' }
      },
      output: toolOutput({ results: { type: 'array', items: { type: 'object' } } }),
      async execute(args) {
        const targets = args?.all === true ? CATALOG : CATALOG.filter((entry) => entry.id === String(args?.id ?? ''));
        if (targets.length === 0) return { results: [{ ok: false, note: 'unknown provider id' }] };
        const results = [];
        for (const entry of targets) { try { results.push(await doClaim(entry, state)); } catch (error) { results.push({ id: entry.id, ok: false, note: String(error?.message ?? error) }); } }
        saveState(state);
        return { results };
      }
    }));
    const disposeProbe = tctx.tools.register(define({
      name: 'freegen_probe',
      description: 'Probe one provider: submit one minimal test generation to verify key/quota/access. Pollinations probes the local bridge health instead (costs nothing).',
      parameters: { id: { type: 'string', description: 'Provider id from freegen_catalog.', required: true } },
      output: toolOutput({ ok: { type: 'boolean' }, note: { type: 'string' }, status: { type: 'number' }, excerpt: { type: 'string' } }, ['ok']),
      async execute(args) {
        const entry = CATALOG.find((candidate) => candidate.id === String(args?.id ?? ''));
        if (entry === undefined) return { ok: false, note: 'unknown provider id' };
        const result = await doProbe(entry, state);
        saveState(state);
        return result;
      }
    }));
    const disposeInstall = tctx.tools.register(define({
      name: 'freegen_install',
      description: 'Install a catalog provider as a channel inside 团团TV (dsh-imagegen settings). Preserves the user\'s existing channels; upserts this plugin\'s channel and its stored key. Requires a saved key except for the keyless Pollinations bridge.',
      parameters: {
        id: { type: 'string', description: 'Provider id from freegen_catalog.', required: true },
        set_default: { type: 'boolean', description: 'Also set it as the default channel/model in 团团TV.' }
      },
      output: toolOutput({ ok: { type: 'boolean' }, note: { type: 'string' }, channelId: { type: 'string' } }, ['ok']),
      async execute(args) {
        const entry = CATALOG.find((candidate) => candidate.id === String(args?.id ?? ''));
        if (entry === undefined) return { ok: false, note: 'unknown provider id' };
        const result = await doInstall(entry, state, ctx.get('settings'), args?.set_default === true);
        saveState(state);
        return result;
      }
    }));
    return () => { for (const dispose of [disposeCatalog, disposeClaim, disposeProbe, disposeInstall]) dispose?.(); };
  }, 'free-gen-quota: tools');

  /* 5. 自动领取调度（每 6 小时醒一次，按 24h 周期签到） */
  ctx.effect(() => {
    const timer = setInterval(async () => {
      try {
        if (state.autoClaim === false) return;
        const now = Date.now();
        if (now - (state.lastAutoRun ?? 0) < (Number(config?.claimIntervalHours ?? 24) - 0.5) * 3600_000) return;
        state.lastAutoRun = now;
        const results = [];
        for (const entry of CATALOG) {
          if (entry.kind !== 'checkin') continue;
          if ((state.providers[entry.id]?.credential ?? '') === '') continue;
          try { results.push(await doClaim(entry, state)); } catch (error) { results.push({ id: entry.id, ok: false, note: String(error?.message ?? error) }); }
        }
        saveState(state);
        appendLog({ type: 'auto', results });
      } catch {}
    }, 6 * 3600_000);
    return () => clearInterval(timer);
  }, 'free-gen-quota: auto claim scheduler');

  /* 6. Agent 指导 */
  ctx.inject(['systemPrompt'], (spctx) => {
    spctx.systemPrompt.section({
      name: 'plugin:free-gen-quota',
      order: AGENT_SECTION_ORDER,
      text: '本机装有「免费生图/生视频额度工场」（dsh-free-gen-quota）：维护市面免费渠道目录（Pollinations 免密钥桥、SiliconFlow/ModelScope/OpenRouter/智谱/百炼/MiniMax/火山方舟/Cloudflare/算力萌）。可用工具：freegen_catalog（查目录与状态）、freegen_claim（{id} 或 {all:true} 一键领取）、freegen_probe（检测额度可用性，会提交一次极小测试请求）、freegen_install（把渠道合并写进团团TV，保留用户已有渠道）。用户提到「免费额度/白嫖/签到/领取/免费生图渠道」时用它；写入团团TV 前先 catalog 确认 kind 与密钥状态，不要替用户注册账号；guide 型渠道要把 claimUrl 给用户。本地桥端口写在 freegen_catalog 返回的 bridgePort。'
    });
  }, 'free-gen-quota: agent guidance');

  return () => {};
}

export default apply;
