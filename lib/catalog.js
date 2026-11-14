/**
 * 免费生图/生视频渠道目录（2026-11 核对）。
 *
 * 每个条目描述一个市面上有免费额度的上游：
 *  - kind: bridge     —— 无需任何密钥，本插件内置本地桥接协议后直接可用
 *  - kind: key        —— 注册后拿 API Key，填进面板即可检测并写入团团TV
 *  - kind: checkin    —— 有可 HTTP 化的「签到/领取」接口，存入凭据后可自动领取
 *  - kind: guide      —— 额度在控制台开通/赠送，插件给直达链接 + 步骤
 *
 * channel 字段是写入团团TV 的渠道模板（协议、模型目录）。
 * engine 字段标注团团TV 的协议走向，供面板文案与写入逻辑使用。
 */

export const CATALOG = [
  {
    id: 'pollinations',
    name: 'Pollinations.AI（免密钥生图）',
    category: 'image',
    kind: 'bridge',
    freeTier: '匿名免密钥、无注册，model=sana 永久免费；限速 1 张 / 45 秒 / IP（桥内已自动排队顺延），通过本地桥转成 OpenAI 协议',
    cost: '0 元',
    models: [
      { alias: 'sana', id: 'sana', note: '匿名可用，质量中上，速度快' }
    ],
    videoModels: [],
    bridge: {
      upstreamBase: 'https://image.pollinations.ai/prompt',
      defaultModel: 'sana',
      defaultWidth: 1024,
      defaultHeight: 576
    },
    notes: '本插件内置本地桥：团团TV 直接把 Pollinations 当一个 OpenAI 兼容渠道用。无需 Key，auth 填占位符即可。'
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow（永久免费图模型）',
    category: 'image',
    kind: 'key',
    freeTier: 'Kwai-Kolors/Kolors 与 black-forest-labs/FLUX.1-schnell 标注「永久免费」；注册另送体验金（约 ¥14）',
    cost: '注册免费，手机号即可',
    claimUrl: 'https://cloud.siliconflow.cn/account/ak',
    claimSteps: [
      '注册/登录 cloud.siliconflow.cn（手机号）',
      '「API 密钥」→ 新建密钥并复制',
      '把密钥粘进本面板的输入框点保存',
      '点「检测」验证，然后「写入团团TV」'
    ],
    autoFetch: { mode: 'cookie', note: '粘贴登录 Cookie 尝试自动创建/读取密钥；失败会给出手动步骤' },
    manualSteps: [
      '① 浏览器打开 https://cloud.siliconflow.cn 并登录（手机号+验证码，免费）',
      '② 首次使用需完成实名/绑定手机（页面会引导）',
      '③ 左侧菜单「API 密钥」（直达 cloud.siliconflow.cn/account/ak）',
      '④ 点「新建 API 密钥」→ 弹窗命名（随意）→ 复制 sk- 开头的完整密钥',
      '⑤ 回到本面板把密钥粘进输入框点「保存密钥」→「检测额度」→「写入团团TV」',
      '提示：Kolors 与 FLUX.1-schnell 是永久免费模型，检测通过即可零费用生图'
    ],
    channel: {
      apiUrl: 'https://api.siliconflow.cn/v1',
      protocol: 'images',
      models: [
        { alias: 'Kolors-free', id: 'Kwai-Kolors/Kolors' },
        { alias: 'FLUX.1-schnell-free', id: 'black-forest-labs/FLUX.1-schnell' }
      ],
      videoModels: []
    },
    probe: { kind: 'image', model: 'Kwai-Kolors/Kolors', size: '1024x1024' }
  },
  {
    id: 'modelscope',
    name: '魔搭 ModelScope API-Inference（每日免费额度，图+视频）',
    category: 'both',
    kind: 'key',
    freeTier: '每个模型每日免费额度（约 2000 次/天），含文生图与 Wan 系文生视频；额度每日自动重置，无需签到',
    cost: '注册免费（需实名/绑定），每日额度自动发放',
    claimUrl: 'https://modelscope.cn/my/myaccesstoken',
    claimSteps: [
      '注册/登录 modelscope.cn（免费）',
      '「访问令牌」页创建 SDK 令牌（ms- 开头）并复制',
      '密钥粘进本面板保存 → 检测 → 写入团团TV'
    ],
    autoFetch: { mode: 'cookie', note: '粘贴 modelscope.cn 登录 Cookie 尝试自动读取/创建访问令牌' },
    manualSteps: [
      '① 浏览器打开 https://modelscope.cn 注册/登录（支持手机号/支付宝，免费）',
      '② 右上角头像 → 「访问令牌」（直达 modelscope.cn/my/myaccesstoken）',
      '③ 点「创建令牌」→ 复制 ms- 开头的完整令牌',
      '④ 回到本面板粘贴 →「保存密钥」→「检测额度」→「写入团团TV」',
      '提示：API-Inference 每模型每日免费额度自动重置，无需任何签到'
    ],
    channel: {
      apiUrl: 'https://api-inference.modelscope.cn/v1',
      protocol: 'images',
      models: [
        { alias: 'MUSE-V2-Free', id: 'MUSE-V2' },
        { alias: 'FLUX-schnell-ms', id: 'AI-ModelScope/FLUX.1-schnell' },
        { alias: 'Kolors-ms', id: 'Kwai-Kolors/Kolors' }
      ],
      videoModels: [
        { alias: 'Wan2.2-T2V-ms', id: 'Wan2.2-T2V-A14B' }
      ]
    },
    probe: { kind: 'image', model: 'AI-ModelScope/FLUX.1-schnell', size: '1024x1024' },
    notes: '视频模型走通用 OpenAI 视频端点尽力适配；若上游报协议不符，以魔搭文档为准（额度仍在，手动可用）。'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter（免费生图模型 :free）',
    category: 'image',
    kind: 'key',
    freeTier: 'google/gemini-2.5-flash-image:free（nano banana 免费档，每日限额自动重置）等 :free 模型',
    cost: '注册免费（GitHub/Google 登录），免费档 0 费用',
    claimUrl: 'https://openrouter.ai/keys',
    claimSteps: [
      'openrouter.ai 用 GitHub/Google 登录',
      'Keys → Create Key，复制 sk-or-v1-...',
      '密钥粘进本面板保存 → 检测 → 写入团团TV'
    ],
    autoFetch: { mode: 'oauth', note: '点「登录自动获取」→ 浏览器打开 OpenRouter 授权页 → 登录并点允许 → Key 自动回填' },
    manualSteps: [
      '① 打开 https://openrouter.ai 用 GitHub / Google 账号登录（免费）',
      '② 右上角头像 →「Keys」（直达 openrouter.ai/keys）',
      '③ 「Create Key」→ 命名随意 → 复制 sk-or-v1- 开头的完整密钥',
      '④ 回到本面板粘贴 →「保存密钥」→「检测额度」→「写入团团TV」',
      '提示：免费模型（google/gemini-2.5-flash-image:free 等）有每日次数限制，自动重置'
    ],
    channel: {
      apiUrl: 'https://openrouter.ai/api/v1',
      protocol: 'chat-completions',
      models: [
        { alias: 'nano-banana-free', id: 'google/gemini-2.5-flash-image:free' },
        { alias: 'gemini-flash-image-free', id: 'google/gemini-2.0-flash-exp:free' }
      ],
      videoModels: []
    },
    probe: { kind: 'image', model: 'google/gemini-2.5-flash-image:free', size: '1024x1024' },
    notes: '免费档有每日次数限制，多 key 轮换是社区常态；写入团团TV 走 chat-completions 协议。'
  },
  {
    id: 'zhipu',
    name: '智谱 bigmodel（新户赠礼 + glm-image / CogVideoX）',
    category: 'both',
    kind: 'guide',
    freeTier: '新注册赠送约 2000 万 tokens 资源包（自动到账）；glm-image 生图与 CogVideoX 生视频可用赠额抵扣；清影网页版每日免费',
    cost: '注册免费（手机号），赠额自动发放',
    claimUrl: 'https://open.bigmodel.cn/usercenter/resourcepack',
    claimSteps: [
      '注册/登录 open.bigmodel.cn（自动获得赠送资源包）',
      '「API Keys」创建密钥（形如 id.secret）',
      '密钥粘进本面板保存 → 检测 → 写入团团TV',
      '视频用 CogVideoX-3 系列，赠额不足时网页版清影每日免费'
    ],
    manualSteps: [
      '① 浏览器打开 https://open.bigmodel.cn 注册/登录（手机号，免费）',
      '② 新用户自动到账约 2000 万 tokens 资源包（用户中心 → 资源包可查）',
      '③ 右上角头像 →「API Keys」（open.bigmodel.cn/usercenter/apikeys）→「创建 API Key」',
      '④ 复制完整的「id.secret」格式密钥（点复制按钮，两段都要）',
      '⑤ 回到本面板粘贴 →「保存密钥」→「检测额度」→「写入团团TV」',
      '提示：本机 zcode 插件里的智谱登录态已过期，无法代取；按上面步骤拿正式 Key'
    ],
    channel: {
      apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
      protocol: 'images',
      models: [
        { alias: 'glm-image', id: 'glm-image' }
      ],
      videoModels: []
    },
    probe: { kind: 'image', model: 'glm-image', size: '1024x1024' },
    notes: '智谱 glm-image 仅文生图；视频协议为异步任务（CogVideoX），团团TV 暂按通用端点尽力适配，网页清影兜底。'
  },
  {
    id: 'volc-ark',
    name: '火山方舟 Ark（新户开通即送模型额度；你的 Key 已在本机）',
    category: 'both',
    kind: 'guide',
    freeTier: '开通对应模型即送体验额度（Doubao 系每模型 50 万 tokens；Seedream / Seedance 图像视频各有新户额度）',
    cost: '注册免费，个人认证后可开通；额度自动到账',
    claimUrl: 'https://console.volcengine.com/ark/region:ark-cn-beijing/openModel',
    claimSteps: [
      '登录火山方舟控制台（你面板里那把 Key 所属账号）',
      '「开通管理 → 模型开通」勾选 Doubao-Seedream / Doubao-Seedance / Doubao 对话模型并开通',
      '无需改配置：渠道已在本机，开通后直接「检测」即可出图',
      '也可创建推理接入点（ep-xxx），把 ep ID 填进团团TV 模型目录'
    ],
    manualSteps: [
      '① 打开 https://console.volcengine.com/ark 登录（你面板里那把 Key 的账号）',
      '② 左侧「开通管理 → 模型开通」→ 搜 Seedream → 点「开通」（免费开通，只按量计费）',
      '③ 同页搜 Seedance 开通（视频）；Doubao 对话模型想用也顺手开',
      '④ 开通后无需改配置：本机渠道已有 Key，直接在「免费额度工场」或团团TV 点「检测」',
      '⑤ 进阶：在线推理 → 创建推理接入点得 ep-xxx ID，把它当模型名填进团团TV 渠道目录',
      '此前 404 的原因就是②这步没做——账号一个模型都没开通'
    ],
    channel: null,
    notes: '你已把 ARK Key 存进团团TV；此前 404 是账号未开通任何模型，开通即通。'
  },
  {
    id: 'bailian',
    name: '阿里云百炼（新户免费额度：wanx 生图 + wan2.2 生视频）',
    category: 'both',
    kind: 'guide',
    freeTier: '新用户各模型赠送免费额度（wanx2.1 文生图、wan2.2-t2v 视频等，详见模型列表「限时免费」标）',
    cost: '注册免费（支付宝实名），额度自动发放',
    claimUrl: 'https://bailian.console.aliyun.com/',
    claimSteps: [
      '登录 bailian.console.aliyun.com（阿里云账号）',
      '「API-KEY」创建 sk- 开头密钥',
      '密钥粘进本面板保存 → 检测 → 写入团团TV（DashScope 原生）'
    ],
    manualSteps: [
      '① 浏览器打开 https://bailian.console.aliyun.com 用阿里云账号登录（需实名）',
      '② 首次进入按提示开通「百炼大模型服务」（免费开通，只按量计费）',
      '③ 右上角「API-KEY」→「创建我的 API-KEY」→ 复制 sk- 开头密钥',
      '④ 回到本面板粘贴 →「保存密钥」→「检测额度」→「写入团团TV」',
      '提示：新账号各模型自带免费试用额度（模型广场里标「限时免费」的优先用）'
    ],
    channel: {
      apiUrl: 'https://dashscope.aliyuncs.com/api/v1',
      protocol: 'qwen-draw',
      models: [
        { alias: 'wanx2.1-free', id: 'wanx2.1-t2i-turbo' },
        { alias: 'qwen-image-free', id: 'qwen-image' }
      ],
      videoModels: [
        { alias: 'wan2.2-t2v-free', id: 'wan2.2-t2v-plus' }
      ]
    },
    probe: { kind: 'image', model: 'wanx2.1-t2i-turbo', size: '1024x1024' },
    notes: '百炼走 DashScope 原生异步协议（团团TV 的 qwen-draw / 直连适配），生视频为异步任务轮询。'
  },
  {
    id: 'minimax',
    name: 'MiniMax 开放平台（新户体验金：image-01 / 视频生成）',
    category: 'both',
    kind: 'guide',
    freeTier: '新注册赠送体验金（约 ¥15–25）；image-01 生图、Hailuo 视频生成可用体验金抵扣',
    cost: '注册免费（手机号），体验金自动到账',
    claimUrl: 'https://platform.minimaxi.com/user-center/acquisition',
    claimSteps: [
      '注册/登录 platform.minimaxi.com',
      '「账户管理 → API Keys」创建密钥',
      '密钥粘进本面板保存 → 检测 → 写入团团TV',
      '体验金用完前视频走 minimax-video 系列价格较低'
    ],
    manualSteps: [
      '① 浏览器打开 https://platform.minimaxi.com 注册/登录（手机号）',
      '② 新户体验金自动到账（账户管理 → 财务可查余额）',
      '③ 「账户管理 → API Keys」→「新建密钥」→ 复制 ey 开头完整密钥',
      '④ 回到本面板粘贴 →「保存密钥」→「检测额度」→「写入团团TV」',
      '提示：MiniMax 图片走原生接口（image-01），插件已按原生协议适配'
    ],
    channel: {
      apiUrl: 'https://api.minimaxi.com/v1',
      protocol: 'images',
      models: [
        { alias: 'image-01-free', id: 'image-01' }
      ],
      videoModels: [
        { alias: 'minimax-video-h3-free', id: 'minimax-video-h3' }
      ]
    },
    probe: { kind: 'image', model: 'image-01', size: '1024x1024' },
    notes: 'MiniMax 图片接口为原生协议（团团TV 已适配 image-01 subject_reference）；视频走异步轮询。'
  },
  {
    id: 'comemoe',
    name: '算力萌 comemoe（每日签到送算力：wan2.2 文生视频）',
    category: 'video',
    kind: 'checkin',
    freeTier: '每日签到送算力点，wan2.2-t2v 文生视频免费用；账号注册免费',
    cost: '注册免费，签到送算力',
    claimUrl: 'https://www.comemoe.com',
    checkin: {
      url: 'https://www.comemoe.com/api/user/sign',
      method: 'POST',
      headers: { Cookie: '{{credential}}' },
      body: {},
      successMatch: '签到成功|已签到|success'
    },
    claimSteps: [
      '浏览器登录 comemoe.com 后 F12 → Application → Cookies',
      '复制整串 Cookie 粘进本面板保存（等同于自动签到）',
      '开启「自动领取」后每日自动签到；也可面板一键领取'
    ],
    manualSteps: [
      '① 浏览器打开 https://www.comemoe.com 注册/登录（算力萌，每日签到送算力）',
      '② 签到页手动签一次确认账号有算力',
      '③ 键盘 F12 → 「Application」（应用）标签 → 左侧 Cookies → https://www.comemoe.com',
      '④ 全选右侧 Cookie 行（或只复制整个 Cookie 请求头字符串）粘贴到本面板',
      '⑤ 「保存凭据」→「立即签到」验证成功 → 开「自动领取」每天自动签'
    ],
    channel: {
      apiUrl: 'https://www.comemoe.com',
      protocol: 'images',
      models: [],
      videoModels: [
        { alias: 'wan2.2-t2v-comemoe', id: 'wan2.2-t2v' },
        { alias: 'zhimeng-h3-local-comemoe', id: 'zhimeng-h3-local' }
      ]
    },
    notes: 'checkin 接口若上游调整，面板会报出原始响应；凭据仅存本机。'
  },
  {
    id: 'cloudflare-ai',
    name: 'Cloudflare Workers AI（每日免费 neurons：FLUX schnell）',
    category: 'image',
    kind: 'key',
    freeTier: '每日 10,000 neurons 免费重置；@cf/black-forest-labs/flux-1-schnell 生图免费额度内 0 费用',
    cost: '注册免费（无需绑卡即可用 Workers AI 免费层）',
    claimUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    claimSteps: [
      '注册/登录 Cloudflare，创建/进入任意账户',
      'Workers AI 页拿到 Account ID；「API Tokens」创建令牌（Workers AI Read/Run 权限）',
      '密钥粘进本面板保存（token）',
      '接口为 CF 原生协议（非 OpenAI），暂以面板直测为主，写入团团TV 需 AI Gateway 兼容层'
    ],
    manualSteps: [
      '① 打开 https://dash.cloudflare.com 注册/登录（免费，无需绑卡）',
      '② 左侧「Workers & Pages」→ 随便建一个 Worker 激活账户（或直接用 Workers AI 页）',
      '③ 「Workers AI」页右上角复制 32 位 Account ID',
      '④ 头像 →「My Profile → API Tokens」→「Create Token」→ 用「Workers AI」模板创建并复制',
      '⑤ 本面板：Token 填第一格、Account ID 填第二格 →「保存密钥」→「检测额度」'
    ],
    channel: null,
    probe: { kind: 'image', model: '@cf/black-forest-labs/flux-1-schnell', raw: true, url: 'https://api.cloudflare.com/client/v4/accounts/{{accountId}}/ai/run/@cf/black-forest-labs/flux-1-schnell' },
    notes: '原生 REST 需要 accountId，本面板探测时一并保存；是否写进团团TV 视 AI Gateway 兼容层而定。'
  }
];

export function catalogEntry(id) {
  return CATALOG.find((entry) => entry.id === id) ?? null;
}
