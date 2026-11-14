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
    channel: null,
    probe: { kind: 'image', model: '@cf/black-forest-labs/flux-1-schnell', raw: true, url: 'https://api.cloudflare.com/client/v4/accounts/{{accountId}}/ai/run/@cf/black-forest-labs/flux-1-schnell' },
    notes: '原生 REST 需要 accountId，本面板探测时一并保存；是否写进团团TV 视 AI Gateway 兼容层而定。'
  }
];

export function catalogEntry(id) {
  return CATALOG.find((entry) => entry.id === id) ?? null;
}
