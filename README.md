# GitHub 中文化插件 · 扩展版

把 GitHub 界面翻译成中文的浏览器扩展（Chrome / Edge，Manifest V3）。

**本扩展是 [`maboloshi/github-chinese`](https://github.com/maboloshi/github-chinese)（GPL-3.0）的本地移植版**，原作者 [楼教主](http://www.52cik.com/) / [沙漠之子](https://github.com/maboloshi)。翻译词库为原项目成果，本仓库仅做打包形式的适配。

---

## 为什么不用油猴脚本

原项目提供的油猴脚本依赖这一行：

```javascript
// @require https://raw.githubusercontent.com/maboloshi/github-chinese/gh-pages/locals.js
```

它在运行时从 `raw.githubusercontent.com` 下载约 2 MB 的翻译词库。**该域名在部分网络环境下不可达**（例如本机：`github.com` 与 `api.github.com` 正常，唯独该域名超时）。

结果是脚本虽能安装，但**拿不到词库**，运行时报：

```
GitHub 汉化插件：词库文件 locals.js 未加载，脚本无法运行！
```

本移植版解决方式：**把词库直接内嵌为扩展资源**，零外部依赖，安装后即可用。

---

## 与油猴版的差异

| 项目 | 油猴脚本 | 本扩展 |
|---|---|---|
| 词库获取 | 运行时远程下载 | **内嵌，无网络依赖** |
| 安装方式 | 需装 Tampermonkey | 直接装载扩展 |
| 脚本菜单 | 有（开关/导出/统计） | **无**（扩展没有菜单宿主） |
| 未命中词条的远程翻译 | 支持 | 支持（`GM_xmlhttpRequest` 用 fetch 实现） |
| 更新 | 自动检查版本 | 手动替换文件 |

脚本菜单里的四个开关（未命中词条记录、远程翻译引擎等）默认关闭，**不影响主翻译功能**。它们在扩展版中改读 `localStorage`（前缀 `ghcn:`）。

---

## 安装

### 方式一：命令行装载（推荐，不需确认弹窗）

```bat
msedge.exe --load-extension="D:\github-chinese-extension"
```

注意：`--load-extension` **只在浏览器启动时读取**。若浏览器已在运行，参数会被忽略。

### 方式二：开发者模式加载

1. 打开 `edge://extensions/`
2. 打开左下角「开发人员模式」
3. 点「加载解压缩的扩展」→ 选择本目录

扩展 ID（本机路径推导，仅供识别）：`eablnckbgkleopphbmmmfhpinjfhcknh`

---

## 文件说明

| 文件 | 说明 |
|---|---|
| `manifest.json` | MV3 清单，声明匹配站点与注入时机 |
| `00-i18n.js` | 翻译词库（19,000+ 条），提供全局 `I18N` |
| `01-gm-shim.js` | 油猴 API 垫片：`GM_getValue` / `GM_setValue` / `GM_addStyle` / `GM_xmlhttpRequest` / `GM_notification` / 菜单类空实现 |
| `02-main.js` | 主逻辑（翻译引擎、DOM 监听、页面类型判定） |

**加载顺序不可更改**：词库必须先于主逻辑，否则主脚本的 `typeof I18N === 'undefined'` 检查会直接抛错。

---

## 验证

```bash
npm i jsdom          # 唯一的开发依赖
node verify-github-cn.js
```

用 jsdom 构造仿 GitHub 仓库页，按 manifest 顺序加载三个脚本，断言：

- 三个脚本无异常加载、垫片接口全部就位
- 词库能被主脚本访问（作用域互通）
- **真实翻译生效**：`Pull requests` → `拉取请求`、`Issues` → `议题`、`Sign in` → `登录` 等
- DOM 未被破坏、无致命运行时错误

反证（确认测试不是恒真）：把词库换成空对象后，测试报 7 项失败。

---

## 已知限制

- **不会自动更新**。原项目的词库每周更新，需要手动重新拉取。
- 测试中判定页面类型依赖 `<meta name="analytics-location">`，这是 GitHub 真实页面上的标签；构造测试页时必须补上，否则脚本会认为"路径未匹配任何页面规则"而跳过翻译。
- 词库期望值必须从 `00-i18n.js` 实际核对，例如 `Marketplace` 的译法是「市场」而非「应用市场」。

---

## 许可

翻译词库与主逻辑来自 [`maboloshi/github-chinese`](https://github.com/maboloshi/github-chinese)，遵循 **GPL-3.0**。本移植版同样以 GPL-3.0 发布。
