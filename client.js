/**
 * dsh-free-gen-quota — browser half（仿 dsh-our-free-model 的手写 ModuleLoader bundle，零构建）。
 *
 * 贡献：
 *   1. 一个 settings.section 卡片「免费额度工场」——渠道目录、领取/签到、密钥托管、
 *      额度检测、一键写入团团TV、自动领取开关；
 *   2. 没了——所有数据走本插件同源 /api/free-gen/* 路由，颜色全部走宿主主题变量。
 *
 * 依赖：宿主已提供的 react / react-dom（平台种子词），无任何构建步骤。
 */

window.__ModuleLoader__.load({
  id: 'dsh-free-gen-quota',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { createElement: h, useState, useEffect, useCallback, useRef } = React

    const NS = 'settings.freeGenQuota'
    const inject = ['slots', 'locale']
    const name = 'dsh-free-gen-quota'

    const API = (() => {
      try { return new URL('api/free-gen', document.baseURI).pathname } catch { return '/api/free-gen' }
    })()

    // ── copy ────────────────────────────────────────────────────────────────
    const DICT = {
      zh: {
        'meta.title': '免费额度工场',
        'meta.description': '市面免费生图/生视频渠道目录：一键领取、自动签到、额度检测、一键写入团团TV。数据仅存本机。',
        nav: '免费额度工场',
        title: '免费生图 / 生视频额度工场',
        subtitle: 'Pollinations 免密钥桥已内置；其余渠道领取后写入团团TV 即用。',
        claimAll: '一键领取全部',
        probeAll: '检测全部已配置渠道',
        autoClaim: '自动领取（每日签到类）',
        claim: '领取',
        claimBridge: '内置桥 · 无需领取',
        claimGuide: '复制开通链接',
        claimCheckin: '立即签到',
        claimKey: '标记已领取',
        probe: '检测额度',
        install: '写入团团TV',
        installDefault: '写入并设为默认',
        saveKey: '保存密钥',
        saveCredential: '保存凭据',
        keyPlaceholder: 'API Key',
        credentialPlaceholder: 'Cookie / 凭据（登录后 F12 → Application → Cookies 复制）',
        accountIdPlaceholder: 'Account ID（Cloudflare 需要）',
        needKeyFirst: '先保存 API Key 再写入',
        bridgeOn: '本地桥在线',
        bridgeOff: '本地桥未启动',
        lastProbe: '上次检测',
        lastClaim: '上次领取',
        ok: '可用',
        fail: '失败',
        working: '进行中 …',
        catImage: '生图',
        catVideo: '生视频',
        catBoth: '图+视频',
        kindBridge: '免密钥',
        kindKey: '填 Key',
        kindCheckin: '可自动签到',
        kindGuide: '引导开通',
        empty: '目录加载中 …',
        errorPrefix: '操作失败',
        installDone: '已写入团团TV',
      },
      en: {
        'meta.title': 'Free Gen Quota',
        'meta.description': 'Catalog of free-tier image/video generation providers: one-click claim, auto check-in, quota probe, one-click install into TuanTuan TV.',
        nav: 'Free Gen Quota',
        title: 'Free Image / Video Gen Quota Hub',
        subtitle: 'The keyless Pollinations bridge is built in; claim the rest and install them into TuanTuan TV.',
        claimAll: 'Claim all',
        probeAll: 'Probe configured providers',
        autoClaim: 'Auto claim (daily check-ins)',
        claim: 'Claim',
        claimBridge: 'Built-in bridge · nothing to claim',
        claimGuide: 'Copy console link',
        claimCheckin: 'Check in now',
        claimKey: 'Mark claimed',
        probe: 'Probe quota',
        install: 'Install into TuanTuan TV',
        installDefault: 'Install & set default',
        saveKey: 'Save key',
        saveCredential: 'Save credential',
        keyPlaceholder: 'API Key',
        credentialPlaceholder: 'Cookie / credential (F12 → Application → Cookies)',
        accountIdPlaceholder: 'Account ID (Cloudflare)',
        needKeyFirst: 'Save an API key first',
        bridgeOn: 'bridge online',
        bridgeOff: 'bridge offline',
        lastProbe: 'Last probe',
        lastClaim: 'Last claim',
        ok: 'available',
        fail: 'failed',
        working: 'working …',
        catImage: 'image',
        catVideo: 'video',
        catBoth: 'image+video',
        kindBridge: 'keyless',
        kindKey: 'API key',
        kindCheckin: 'auto check-in',
        kindGuide: 'console guide',
        empty: 'loading catalog …',
        errorPrefix: 'action failed',
        installDone: 'installed into TuanTuan TV',
      },
    }

    // ── styles ───────────────────────────────────────────────────────────────
    const CSS = `
.fgq{display:flex;flex-direction:column;gap:12px;max-width:920px}
.fgq-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.fgq-title{font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}
.fgq-sub{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.fgq-pill{font-size:11px;border-radius:999px;padding:2px 10px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.fgq-pill.on{color:#3ecf8e}
.fgq-pill.off{color:#f87171}
.fgq-btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font-size:12.5px;cursor:pointer}
.fgq-btn:hover{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}
.fgq-btn.primary{background:#2f6feb;border-color:#2f6feb;color:#fff}
.fgq-btn:disabled{opacity:.45;cursor:not-allowed}
.fgq-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;background:var(--dsw-alias-bg-card,rgba(255,255,255,.035))}
.fgq-name{font-weight:600;font-size:13.5px;color:var(--dsw-alias-label-primary)}
.fgq-tag{display:inline-block;font-size:10.5px;border-radius:999px;padding:1px 8px;margin-left:6px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);vertical-align:1px}
.fgq-tag.image{color:#4ade80}.fgq-tag.video{color:#fbbf24}.fgq-tag.both{color:#60a5fa}
.fgq-free{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:5px;line-height:1.55}
.fgq-steps{font-size:11.5px;color:var(--dsw-alias-label-tertiary);margin-top:5px;white-space:pre-line;line-height:1.6}
.fgq-link{color:#6ea8fe;text-decoration:none;font-size:12px;word-break:break-all}
.fgq-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}
.fgq-input{background:var(--dsw-alias-bg-input,rgba(255,255,255,.05));border:1px solid var(--dsw-alias-border-l1);border-radius:8px;color:var(--dsw-alias-label-primary);padding:6px 10px;font-size:12px;min-width:250px;flex:1}
.fgq-status{font-size:11.5px;margin-top:8px}
.fgq-ok{color:#3ecf8e}.fgq-bad{color:#f87171}.fgq-warn{color:#fbbf24}.fgq-dim{color:var(--dsw-alias-label-tertiary)}
.fgq-log{font:11px/1.55 ui-monospace,SFMono-Regular,monospace;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-interactive-bg-hover);border-radius:8px;padding:8px 10px;max-height:120px;overflow:auto;white-space:pre-wrap}
.fgq-check{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--dsw-alias-label-secondary)}
.fgq-details{margin-top:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 12px;background:var(--dsw-alias-interactive-bg-hover)}
.fgq-details summary{cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary);user-select:none}
.fgq-details[open] summary{margin-bottom:6px;color:var(--dsw-alias-label-primary)}
.fgq-details.fail{border-color:#f87171}
`

    // ── helpers ──────────────────────────────────────────────────────────────
    async function api(path, body, timeout = 15000) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeout)
      try {
        const response = await fetch(`${API}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
          signal: ctrl.signal,
        })
        const text = await response.text()
        let payload
        try { payload = text === '' ? {} : JSON.parse(text) } catch { payload = { error: text.slice(0, 200) } }
        if (payload && payload.ok === false) throw new Error(payload.message ?? payload.note ?? `HTTP ${response.status}`)
        return payload?.result ?? payload
      } finally { clearTimeout(timer) }
    }

    function formatWhen(ts) {
      if (!ts) return ''
      try { return new Date(ts).toLocaleString() } catch { return String(ts) }
    }

    // ── page ─────────────────────────────────────────────────────────────────
    function FreeGenPage({ t }) {
      const [data, setData] = useState(null)
      const [log, setLog] = useState('')
      const [busy, setBusy] = useState('')
      const [failSteps, setFailSteps] = useState({})
      const keysRef = useRef({})
      const pollRef = useRef(null)

      const put = useCallback((line) => {
        setLog(current => (`${line}\n${current}`).slice(0, 3000))
      }, [])

      const load = useCallback(async () => {
        try { setData(await api('/state', {}, 10000)) } catch (error) { put(`${t('errorPrefix')}: ${error.message}`) }
      }, [t, put])

      useEffect(() => { void load() }, [load])

      const run = useCallback(async (tag, fn) => {
        setBusy(tag)
        try { await fn() } catch (error) { put(`${t('errorPrefix')} [${tag}]: ${error.message}`) }
        setBusy('')
        await load()
      }, [t, put, load])

      if (data === null) return h('div', { className: 'fgq' }, h('div', { className: 'fgq-sub' }, t('empty')))

      const providers = data.providers ?? {}
      const catalog = data.catalog ?? []

      const claimOne = (entry) => run(`claim:${entry.id}`, async () => {
        put(`${t('claim')} ${entry.name} …`)
        const result = await api('/claim', { id: entry.id }, 40000)
        const row = (result.results ?? [])[0] ?? {}
        if (row.url) put(`${row.note ?? ''} → ${row.url}`)
        else put(`${entry.name}: ${row.note ?? (row.ok ? 'ok' : 'failed')}`)
      })
      const probeOne = (entry) => run(`probe:${entry.id}`, async () => {
        put(`${t('probe')} ${entry.name} …（免费渠道会真实提交一次极小请求，可能需要几十秒）`)
        const result = await api('/probe', { id: entry.id }, 150000)
        const row = (result.results ?? [])[0] ?? {}
        put(`${entry.name}: ${row.ok ? '✅' : '❌'} ${row.note ?? row.excerpt ?? ''}`.slice(0, 300))
      })
      const installOne = (entry, setDefault) => run(`install:${entry.id}`, async () => {
        put(`${t('install')} ${entry.name} …`)
        const result = await api('/install', { id: entry.id, setDefault }, 30000)
        const row = (result.results ?? [])[0] ?? {}
        put(`${entry.name}: ${row.ok ? t('installDone') : row.note}`)
      })
      const oauthFetch = (entry) => {
        put(`🔑 ${entry.name}：打开浏览器授权 …`)
        void (async () => {
          try {
            const result = await api('/autofetch', { id: entry.id }, 20000)
            put(result.note ?? '授权页已打开')
            if (result.mode === 'oauth-started') {
              let ticks = 0
              if (pollRef.current) clearInterval(pollRef.current)
              pollRef.current = setInterval(async () => {
                ticks += 1
                if (ticks > 96) { clearInterval(pollRef.current); pollRef.current = null; put('等待授权超时：请重试，或改用手动步骤'); return }
                try {
                  const snapshot = await api('/state', {}, 8000)
                  const provider = (snapshot.providers ?? {})[entry.id]
                  if ((provider?.key ?? '') !== '') {
                    clearInterval(pollRef.current); pollRef.current = null
                    put(`✅ ${entry.name} Key 已自动回填：${provider.key}。可以「检测额度 / 写入团团TV」了`)
                    await load()
                  }
                } catch { /* transient */ }
              }, 2500)
            } else if (result.manualSteps?.length) {
              setFailSteps(current => ({ ...current, [entry.id]: result.manualSteps }))
            }
          } catch (error) { put(`${t('errorPrefix')} [oauth]: ${error.message}`) }
        })()
      }
      const cookieFetch = (entry) => run(`autofetch:${entry.id}`, async () => {
        const value = keysRef.current[entry.id] ?? {}
        put(`🍪 ${entry.name}：用登录 Cookie 尝试自动获取 Key …`)
        const result = await api('/autofetch', { id: entry.id, credential: value.credential }, 60000)
        if (result.ok) {
          put(`✅ ${entry.name}: ${result.note ?? '自动获取成功'}`)
        } else {
          if (result.manualSteps?.length) setFailSteps(current => ({ ...current, [entry.id]: result.manualSteps }))
          put(`❌ ${entry.name}: ${result.note ?? '自动获取失败'}`)
        }
      })
      const claimAll = () => run('claim:all', async () => {
        put(`${t('claimAll')} …`)
        const result = await api('/claim', { all: true }, 60000)
        for (const row of result.results ?? []) put(`${row.id}: ${row.note ?? (row.ok ? 'ok' : 'failed')}${row.url ? ` → ${row.url}` : ''}`)
      })
      const probeAll = () => run('probe:all', async () => {
        for (const entry of catalog.filter(item => item.probe)) await probeOne(entry)
      })
      const saveKey = (entry) => run(`save:${entry.id}`, async () => {
        const value = keysRef.current[entry.id] ?? {}
        await api('/save', { id: entry.id, key: value.key, credential: value.credential, accountId: value.accountId })
        put(`${entry.name}: saved`)
      })
      const setAuto = (value) => run('auto', async () => {
        await api('/save', { autoClaim: value })
        put(`${t('autoClaim')}: ${value ? 'on' : 'off'}`)
      })

      return h('div', { className: 'fgq' },
        h('div', { className: 'fgq-head' },
          h('div', { style: { flex: '1 1 auto' } },
            h('div', { className: 'fgq-title' }, t('title')),
            h('div', { className: 'fgq-sub' }, t('subtitle'))),
          h('div', { className: `fgq-pill ${data.bridgePort ? 'on' : 'off'}` },
            data.bridgePort ? `${t('bridgeOn')} :${data.bridgePort}` : t('bridgeOff')),
          h('button', { className: 'fgq-btn primary', disabled: busy !== '', onClick: claimAll }, t('claimAll')),
          h('button', { className: 'fgq-btn', disabled: busy !== '', onClick: probeAll }, t('probeAll')),
          h('label', { className: 'fgq-check' },
            h('input', { type: 'checkbox', checked: data.autoClaim === true, onChange: event => setAuto(event.target.checked) }),
            t('autoClaim'))),
        catalog.map(entry => {
          const provider = providers[entry.id] ?? {}
          const hasKey = (provider.key ?? '') !== ''
          const installable = entry.kind === 'bridge' || (entry.channel && hasKey)
          const categoryLabel = entry.category === 'both' ? t('catBoth') : entry.category === 'image' ? t('catImage') : t('catVideo')
          const kindLabel = entry.kind === 'bridge' ? t('kindBridge') : entry.kind === 'key' ? t('kindKey') : entry.kind === 'checkin' ? t('kindCheckin') : t('kindGuide')
          const claimLabel = entry.kind === 'bridge' ? t('claimBridge') : entry.kind === 'guide' ? t('claimGuide') : entry.kind === 'checkin' ? t('claimCheckin') : t('claimKey')
          const statusLine = provider.lastProbeAt
            ? `${t('lastProbe')}: ${provider.lastProbeOk ? '✅ ' + t('ok') : '❌ ' + t('fail')} ${provider.lastNote ?? ''} · ${formatWhen(provider.lastProbeAt)}`
            : provider.lastClaimAt
              ? `${t('lastClaim')}: ${formatWhen(provider.lastClaimAt)} ${provider.lastClaimNote ?? ''}`
              : ''
          return h('div', { className: 'fgq-card', key: entry.id },
            h('div', { className: 'fgq-name' }, entry.name,
              h('span', { className: `fgq-tag ${entry.category}` }, categoryLabel),
              h('span', { className: 'fgq-tag' }, kindLabel)),
            h('div', { className: 'fgq-free' }, `🎁 ${entry.freeTier ?? ''}${entry.cost ? ` · ${entry.cost}` : ''}`),
            entry.claimUrl ? h('div', { className: 'fgq-free' }, h('a', { className: 'fgq-link', href: entry.claimUrl, target: '_blank', rel: 'noreferrer' }, entry.claimUrl)) : null,
            entry.claimSteps ? h('div', { className: 'fgq-steps' }, entry.claimSteps.map(step => `· ${step}`).join('\n')) : null,
            entry.autoFetch?.mode === 'oauth'
              ? h('div', { className: 'fgq-row' },
                  h('button', { className: 'fgq-btn primary', disabled: busy !== '', onClick: () => oauthFetch(entry) }, '🔑 登录自动获取 Key'),
                  h('span', { className: 'fgq-sub' }, entry.autoFetch.note ?? ''))
              : null,
            (failSteps[entry.id] ?? entry.manualSteps) && (failSteps[entry.id] ?? entry.manualSteps).length > 0
              ? h('details', { className: `fgq-details ${failSteps[entry.id] ? 'fail' : ''}`, open: !!failSteps[entry.id], key: `steps-${entry.id}-${failSteps[entry.id] ? 'open' : 'shut'}` },
                  h('summary', null, '📖 手动获取方法（自动获取失败时，按这个来）'),
                  h('div', { className: 'fgq-steps' }, (failSteps[entry.id] ?? entry.manualSteps).map(step => step).join('\n')))
              : null,
            entry.kind === 'key' || entry.kind === 'checkin'
              ? h('div', { className: 'fgq-row' },
                  entry.kind === 'key'
                    ? h('input', {
                        className: 'fgq-input', type: 'password', placeholder: t('keyPlaceholder'),
                        onChange: event => { keysRef.current[entry.id] = { ...keysRef.current[entry.id], key: event.target.value } },
                      })
                    : h('input', {
                        className: 'fgq-input', type: 'password', placeholder: t('credentialPlaceholder'),
                        onChange: event => { keysRef.current[entry.id] = { ...keysRef.current[entry.id], credential: event.target.value } },
                      }),
                  entry.id === 'cloudflare-ai'
                    ? h('input', {
                        className: 'fgq-input', placeholder: t('accountIdPlaceholder'), style: { maxWidth: '220px' },
                        onChange: event => { keysRef.current[entry.id] = { ...keysRef.current[entry.id], accountId: event.target.value } },
                      })
                    : null,
                  h('button', { className: 'fgq-btn', onClick: () => saveKey(entry) }, entry.kind === 'key' ? t('saveKey') : t('saveCredential')),
                  entry.autoFetch?.mode === 'cookie'
                    ? h('button', { className: 'fgq-btn', disabled: busy !== '', onClick: () => cookieFetch(entry) }, '🍪 从登录会话自动获取')
                    : null)
              : null,
            statusLine ? h('div', { className: `fgq-status ${provider.lastProbeAt ? (provider.lastProbeOk ? 'fgq-ok' : 'fgq-bad') : 'fgq-dim'}` }, statusLine) : null,
            h('div', { className: 'fgq-row' },
              h('button', { className: 'fgq-btn', disabled: busy !== '', onClick: () => claimOne(entry) }, claimLabel),
              entry.probe ? h('button', { className: 'fgq-btn', disabled: busy !== '', onClick: () => probeOne(entry) }, t('probe')) : null,
              h('button', { className: 'fgq-btn', disabled: busy !== '' || !installable, title: installable ? '' : t('needKeyFirst'), onClick: () => installOne(entry, false) }, t('install')),
              h('button', { className: 'fgq-btn', disabled: busy !== '' || !installable, onClick: () => installOne(entry, true) }, t('installDefault'))))
        }),
        h('div', { className: 'fgq-log' }, log || '…'))
    }

    // ── apply ────────────────────────────────────────────────────────────────
    function localeTag(ctx) {
      try {
        const snapshot = typeof ctx.locale?.getLocale === 'function' ? ctx.locale.getLocale() : ctx.locale?.getSnapshot?.()
        const value = snapshot?.active ?? ctx.locale?.locale
        return typeof value === 'string' ? value : document.documentElement.lang || 'zh'
      } catch { return 'zh' }
    }

    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }), 'free-gen-quota: dictionaries')

      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'dsh-free-gen-quota')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'free-gen-quota: styles')

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'free-gen-quota',
        order: 36,
        label: () => t('nav'),
        locale: NS,
      }, props => h(FreeGenPage, { ...props, t: Object.assign(x => t(x), { locale: localeTag(ctx) }) })))
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = name
    return module.exports
  },
})
