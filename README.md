# dsh-free-gen-quota · 免费生图/生视频额度工场

仿照 Our Free Model 的思路做的一个 DSH 插件：把市面上**有免费额度的生图/生视频渠道**收进一张目录，支持**一键领取 / 自动领取 / 额度检测 / 一键写入团团TV**。

> macOS（Apple Silicon）适配版。已实测：Pollinations 免密钥生图链路（团团TV → 本地桥 → 出图）端到端可用。

## 安装（macOS）

方式一 · 克隆到插件目录（推荐，与本机当前安装一致）：

```bash
git clone https://github.com/gunanxiang20-oss/dsh-free-gen-quota-Mac.git ~/.dsh/plugins/dsh-free-gen-quota
```

然后在 desktop profile 里接线（`~/.dsh/profiles/desktop`）：

1. `package.json` 的 `dependencies` 加一行：
   `"dsh-free-gen-quota": "link:/Users/<你>/\.dsh/plugins/dsh-free-gen-quota"`
   （用户名按本机实际路径替换）
2. `package.json` 的 `dsh.profile.bundles` 数组加 `"dsh-free-gen-quota"`
3. `cordis.patch.yml` 加 insert：

```yaml
- insert:
    - id: free-gen-quota
      name: dsh-free-gen-quota
      config:
        bridgePort: 18973
        autoClaim: true
        claimIntervalHours: 24
```

4. 在 profile 目录跑 `pnpm install`，重启 DSH。

面板：`http://127.0.0.1:<宿主端口>/api/free-gen/panel`；Agent 工具 `freegen_catalog` / `freegen_claim` / `freegen_probe` / `freegen_install` 自动注入。

## 能力

| 能力 | 说明 |
| --- | --- |
| 渠道目录 | 10 个免费渠道（Pollinations / SiliconFlow / ModelScope / OpenRouter / 智谱 / 火山方舟 / 百炼 / MiniMax / 算力萌 / Cloudflare），标注免费额度与领取方式 |
| 免密钥桥 | 内置本地回环桥（默认 `127.0.0.1:18973`），把 Pollinations 的免密钥 GET 翻译成 OpenAI 兼容 `/v1/images/generations`，团团TV 直接当渠道用，0 密钥 0 费用 |
| 领取引擎 | `bridge`（无需领取）· `key`（密钥托管）· `checkin`（HTTP 自动签到，如算力萌每日签到）· `guide`（控制台开通引导，给直达链接与步骤） |
| 自动领取 | 每日按周期自动跑 checkin 型渠道；面板可开关 |
| 额度检测 | 每渠道一键提交一次极小测试请求，验证密钥/开通/额度是否可用 |
| 一键写入团团TV | 通过宿主 settings 服务把渠道**合并**进 `dsh-imagegen` 命名空间，绝不覆盖用户已有渠道；密钥一并写入 |
| Agent 工具 | `freegen_catalog` / `freegen_claim`（支持 `all:true` 一键全领）/ `freegen_probe` / `freegen_install` |
| 设置入口 | **DSH「设置」侧栏「免费额度工场」卡片**（仿 Our Free Model 的 `settings.section` 槽位，手写 ModuleLoader 客户端，零构建；中英双语、跟随宿主主题变量） |
| 独立面板 | `GET /api/free-gen/panel`（宿主同源 HTML 面板，与设置卡片共用同一套路由） |

## 目录数据

见 `lib/catalog.js`。免费额度以 2026-11 各家官网口径为准，上游随时会调整，以控制台为准。

## 数据

- 状态：`~/.dsh/free-gen-quota/state.json`（0600，密钥明文仅存本机）
- 领取/检测日志：`~/.dsh/free-gen-quota/claims.jsonl`

## 注意

- guide 型渠道（火山方舟开通、智谱赠礼等）需要你在控制台操作，插件只负责给直达链接与状态跟踪。
- checkin 型渠道的接口可能随上游改版失效，面板会展示原始响应便于核对。
- 视频类免费额度（魔搭 Wan、百炼 wan2.2、算力萌）以各自文档为准；团团TV 侧按协议族尽力适配。
