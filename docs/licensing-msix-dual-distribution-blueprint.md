# 授权码 + MSIX + 双分发复用蓝图

## 1. 目标与边界
- 目标：同一套代码库支持两条发行渠道。
- 渠道 A：Microsoft Store（MSIX）上架分发。
- 渠道 B：官网 Portable（授权码买断 + 7 天试用）。
- 边界：Store 渠道不走自建授权码激活；Portable 渠道走自建授权服务。

## 2. 总体架构
- 单仓库、单代码基线。
- 运行时用 `LICENSE_MODE` 区分授权策略。
- 构建时产出两种包：`.appx/.msix` 和 `-Portable.exe`。
- CI 同一流水线可并行构建双渠道产物。

## 3. 授权模式设计（核心）

### 3.1 模式开关
- `LICENSE_MODE=store`：跳过授权码激活 UI，不调用自建授权云函数。
- `LICENSE_MODE=portable`：启用试用、激活、校验、解绑/换机逻辑。

### 3.2 渠道行为矩阵
- Store/MSIX：
  - 不显示授权码输入。
  - 不做硬件绑定、解绑。
  - 购买与授权由 Store 体系处理（或你在应用外完成权益控制）。
- Portable：
  - 首次安装可试用 7 天。
  - 购买后输入授权码激活。
  - 设备绑定采用“硬件指纹 + 容错键”。
  - 支持用户主动解绑并在新机器重绑。

## 4. Portable 授权码机制（推荐实现）

### 4.1 客户端本地字段
- `deviceId`：稳定设备标识（哈希后）。
- `hardwareProfile`：CPU/内存/网卡等硬件画像。
- `toleranceKeys`：若干容错哈希键，用于轻微硬件变动判定。
- `distributionChannel`：固定传 `portable`。

### 4.2 服务端最小 API
- `POST /startTrial`
- `POST /activate`
- `POST /verify`
- `POST /rebind`
- `POST /unbind`（建议新增，便于用户换机自助）

### 4.3 绑定规则
- 每个订单仅允许 1 台活跃设备。
- `deviceId` 完全匹配：直接通过。
- 不完全匹配但 `toleranceKeys` 重合度达阈值：视为同设备。
- 不满足阈值：进入重绑流程。

### 4.4 安全建议
- 激活码仅一次性明文使用，服务端换发 `licenseToken`。
- 所有请求加时间戳与签名，防重放。
- 本地仅存 token，不存可逆密钥。
- 关键接口限流与风控（IP、设备、订单维度）。

## 5. MSIX/Store 逻辑要点

### 5.1 Store 包原则
- MSIX 包只承载应用本体与品牌资产。
- 发行版不依赖自定义安装器。
- `publisher` 必须与 Partner Center 一致。

### 5.2 Manifest 关键字段
- `Identity Name`
- `Publisher`
- `DisplayName`
- `PublisherDisplayName`
- `Application Id`
- `BackgroundColor`
- `assets` 图标资源

### 5.3 资源目录约定（electron-builder）
- Appx 资源应放在 `build/appx/`。
- 常用文件：
  - `StoreLogo.png`
  - `Square44x44Logo.png`
  - `Square150x150Logo.png`
  - `Wide310x150Logo.png`
  - `Square310x310Logo.png`（可选但建议）

## 6. 双分发目录与配置模板

### 6.1 建议目录
```text
project/
  build/
    icon.png
    appx/
      StoreLogo.png
      Square44x44Logo.png
      Square150x150Logo.png
      Wide310x150Logo.png
      Square310x310Logo.png
  docs/
  electron/
  src/
```

### 6.2 package.json 关键片段（示意）
```json
{
  "build": {
    "appId": "com.company.product",
    "productName": "DraftOne",
    "win": {
      "icon": "build/icon.png",
      "target": ["appx", "portable"]
    },
    "appx": {
      "identityName": "com.company.product",
      "publisher": "CN=Foundry",
      "publisherDisplayName": "Foundry",
      "applicationId": "DraftOne",
      "displayName": "DraftOne",
      "backgroundColor": "#1E90FF"
    }
  }
}
```

## 7. CI/CD 参考流程
- 触发：Tag（例如 `v1.0.1`）。
- Job 1：构建 Store 包（`npm run package:win:appx:store`）。
- Job 2：构建 Portable 包（`npm run package:win:portable`）。
- 上传：Artifacts。
- 发布：GitHub Release（需要 `contents: write`）。
- 可选：同步到腾讯 OSS/COS 作为中国下载镜像。

## 8. 回滚与版本策略
- 不覆盖旧包，只发布更高补丁版本回滚。
- 渠道分层：`stable` 和 `beta`。
- 紧急回滚步骤：
  - 下线异常版本入口。
  - 发布 hotfix 新版本。
  - 在更新元数据里屏蔽坏版本。

## 9. 迁移到另一个项目的落地清单
- 复制本文件与 API 合同模板。
- 替换品牌字段（Name/Publisher/Icon/Logo）。
- 落地 `LICENSE_MODE` 分支逻辑。
- 对接云函数并完成 5 个接口联调。
- 在目标仓库配置 Actions 权限与 Secrets。
- 本地验证：
  - `appx/msix` 打包成功。
  - `portable` 打包成功。
  - 解包检查 Manifest 字段与图标。
- 上架前完成 Store 隐私政策、截图、描述与年龄分级。

## 10. 你现在这套方案可直接复用的关键点
- 单仓库双分发，不拆项目。
- Store 与 Portable 授权逻辑彻底隔离。
- Portable 支持“硬件容错 + 解绑重绑”。
- Appx 资源目录使用 `build/appx/`，避免图标被默认模板覆盖。
