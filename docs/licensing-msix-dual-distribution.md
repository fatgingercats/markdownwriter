# 授权码 + Store(AppX/MSIX) + 双分发说明（可复用）

这份文档用于复用到其它 Electron 项目：同一套代码同时支持

- 渠道 A：Microsoft Store（AppX/MSIX）
- 渠道 B：官网 Portable（-Portable.exe，授权码买断 + 7 天试用，后续再接云函数）

当前阶段策略：先把 Store 流程跑通上线；Portable 的云函数/解绑换机后续再补。

## 1. 代码里的授权模式（License Mode）

用构建时环境变量区分渠道授权策略：

- `VITE_LICENSE_MODE=store`
  - 视为已授权（Store 渠道）
  - 不显示授权码 UI
  - 不调用自建授权云函数

- `VITE_LICENSE_MODE=portable`
  - 走自建授权/试用/激活流程（后续完善）

对应脚本（本仓库）：

- Store 构建：`npm run build:electron:store`
- 默认构建：`npm run build:electron`

## 2. Store 渠道（AppX/MSIX）

### 2.1 Store 渠道是否需要云函数/解绑/绑定？

一般不需要。

- Store 的购买/权益由 Microsoft Store 体系管理。
- App 内不需要授权码、也不需要“解绑/重绑”。

我们在应用里仅做：`store` 模式直接视为 `allowed=true`。

### 2.2 Partner Center 校验的关键字段（必须完全匹配）

Partner Center 会校验你上传的 AppX/MSIX 包的身份信息，以下字段必须和你在 Partner Center 里保留/创建的应用一致：

- Package Identity Name
- Publisher (CN=...)
- PublisherDisplayName

在 electron-builder（`package.json` 的 `build.appx`）里配置：

- `build.appx.identityName`
- `build.appx.publisher`
- `build.appx.publisherDisplayName`
- `build.appx.displayName`
- `build.appx.applicationId`

DraftOne 这次对应的值是（示例，复用到其它项目请替换）：

- `identityName`: `Foundry.DraftOne`
- `publisher`: `CN=516A634D-D66F-4204-B449-B424BA2DC1C9`
- `publisherDisplayName`: `Foundry`

如果不匹配，会出现类似报错：

- `Invalid package identity name ... (expected: Foundry.DraftOne)`
- `Invalid package publisher name ... (expected: CN=...)`

### 2.3 `runFullTrust` 警告

AppX/MSIX 的 Electron 桌面应用通常会带 `runFullTrust`（受限 capability），Partner Center 可能提示：

- `restricted capabilities require approval: runFullTrust`

这通常是“警告”而不是“立刻拒绝”，但可能触发额外审核。

### 2.4 本地自检：解包看 `AppxManifest.xml`

本地打包后（例如 `release/DraftOne-1.0.0-x64.appx`），可以解包检查：

- `Identity Name=...`
- `Identity Publisher=...`
- `PublisherDisplayName=...`

确保和 Partner Center 期望值一致再上传。

## 3. 官网 Portable 渠道（后续完善）

目标（后续实现）：

- 买断制授权码
- 7 天免费试用
- 设备识别：硬件指纹（带容错），避免使用 Windows SystemId
- 允许用户“解绑当前设备”，在新电脑“重新绑定”

实现落点（后续）：

- 云函数提供：激活/校验/解绑/重绑 API
- 客户端本地缓存授权状态 + 定期校验

## 4. 单仓库双分发（是否要拆两个项目？）

不需要拆。

推荐：同一个仓库/目录，通过

- `VITE_LICENSE_MODE`（构建开关）
- AppX 打包配置（Store）
- Portable 打包配置（官网）

来产出两个渠道的包。

## 5. GitHub Actions / Release / Tag 的发布路线

### 5.1 Store Tag 触发构建

仓库里有工作流：`.github/workflows/windows-store-release.yml`

触发条件：push 一个 tag，匹配

- `v*-store.*`

工作流会执行：

1. `npm ci`
2. `npm run prepare:win-icon`（把 `build/icon.png` 生成 `build/icon.ico`）
3. `npm run build:electron:store`
4. `npx electron-builder --win appx --x64`
5. 上传 GitHub Actions Artifacts，并尝试附加到 GitHub Release

### 5.2 一个完整的 “创建并 push tag” 命令长什么样

推荐用“注释 tag”（便于以后查）：

```bash
git tag -a v1.0.0-store.6 -m "store build v1.0.0-store.6"
git push origin v1.0.0-store.6
```

如果你已经本地有 tag 了，也可以只 push：

```bash
git push origin v1.0.0-store.6
```

不建议 `git push --tags`（会把所有本地 tag 一次性推上去）。

