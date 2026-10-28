# Font Refine

按站点替换网页字体的 Chromium 扩展（Manifest V3）。

- 读取本机字体列表，可快速选择，也可以直接输入自定义字体名。
- 创建多条字体替换规则：有序字体栈、可选的自定义 CSS 链接、可选的字重覆盖、可选的黑名单 / 白名单选择器。
- 默认不对任何网站生效；在某个站点手动添加规则并用上 / 下按钮排序后，该站点的文本才会被替换。
- 规则里的字体在本机已不可用、或自定义 CSS 加载失败时给出警告。

## 语义

- **全部文本字体**：规则不区分标准 / 衬线 / 无衬线 / 等宽，命中范围内的所有文本都会被替换。
- **优先级**：同一元素只应用该站点规则列表中**第一条命中**的规则；站点自身按 host / domain 取唯一的最具体条目（host 优先于 domain，多个 domain 取最长 pattern）。
- **回退**：最终字体栈 = 规则字体（按顺序）+ 元素原本的 computed 字体栈。规则字体全部不可用时，浏览器自然回退到网站字体或浏览器默认字体。
- **黑名单**：排除匹配元素及其子树。**白名单**：只作用于匹配元素及其子树。
- **选择器预设**：黑名单 / 白名单模式下可额外挂一个预设——`常规字体黑名单`（常见正文文本元素）或 `等宽字体白名单`（代码 / 等宽元素）。预设选择器以只读文本域展示，与自定义选择器合并后一起生效（预设排在前面）。
- **字重覆盖**：设置为某档字重后，命中范围内的文字统一使用该字重（标题也会被改变）。

## 安装

```bash
pnpm install
pnpm build
```

然后打开 `chrome://extensions`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择本仓库的 `dist/` 目录。

要求 Chrome ≥ 120、Node ≥ 22.12。

## 开发命令

| 命令             | 作用                                                              |
| ---------------- | ----------------------------------------------------------------- |
| `pnpm build`     | 构建 `dist/`（popup / options / content script / service worker） |
| `pnpm watch`     | 监听模式构建                                                      |
| `pnpm test`      | 单元测试（`vite-plus/test`）                                      |
| `pnpm typecheck` | `vue-tsc --noEmit`                                                |
| `pnpm check`     | 格式化 + Lint + 类型检查                                          |
| `pnpm icons`     | 由 `public/icons/icon.svg` 生成 16/32/48/128 PNG                  |

构建会先清空 `dist/`，再依次产出：UI（含 `public/` 拷贝）、`content.js`（单文件 IIFE）、`background.js`（ESM）。

## 存储与权限

- **配置**（规则、站点、schema 版本）存放在 `chrome.storage.sync`，键为 `rule:<uuid>`、`site:<host|domain>:<pattern>`、`schemaVersion`。同步存储单键上限 8KB，超限会提示。
- **本机字体缓存**存放在 `chrome.storage.local`（键 `fontCache`），不会同步。
- 删除规则时，会同步清理引用它的站点条目。

权限说明：

| 权限               | 用途                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| `storage`          | 保存规则与站点（sync）、字体缓存（local）                                           |
| `fontSettings`     | 通过 `chrome.fontSettings.getFontList()` 读取基础字体列表                           |
| `scripting`        | 用 `chrome.scripting.insertCSS/removeCSS` 注入自定义 CSS，绕过页面 `style-src` 限制 |
| `host_permissions` | 内容脚本需在所有 http/https 页面运行                                                |

字体枚举优先使用 `window.queryLocalFonts()`（能拿到字重/样式，首次会弹权限请求）；不可用或被拒绝时回退到 `chrome.fontSettings.getFontList()`（只有 family 名）。扩展不申请 `localFonts` 扩展权限（该键不在扩展权限列表中）。

## 隐私

除用户自己填写的自定义 CSS 链接（由 service worker 抓取）之外，扩展不发起任何网络请求；不收集、不上传任何数据。字体列表只保存在本机。

## 已知边界

- 黑名单只阻止直接命中；子树内没有自己的 `font-family` 声明、纯靠继承的元素仍可能带上替换后的字体。
- 封闭 Shadow DOM 不处理；页面加载之后才 attach 的开放 shadow root 也不会被追溯。
- canvas / WebGL 中绘制的文本不受 CSS 字体替换影响。
- 页面 CSP 仍可能拦截自定义 CSS 里的字体下载与 `@import`。
- 首屏可能有一帧原始字体闪动（内容脚本在 `document_start` 启动，但配置读取与样式注入是异步的）。
- 缺失字体探测在页面加载时进行；页面打开期间安装 / 卸载字体需要刷新页面才会更新徽标与警告。
- 自定义 CSS 只做 `url()` 绝对化，不递归抓取 `@import` 目标。
- 跨域 iframe 由各自 frame 的内容脚本独立匹配 hostname。

## 验收清单（手动）

1. 加载 `dist/`，打开任意站点，popup 显示「仅此主机」/「域名及子域」入口。
2. 新建一条规则（字体 + 可选 CSS），在站点上添加该规则：页面文本立即变化，无需刷新。
3. 在 popup 里调整规则顺序：优先级最高的命中规则生效。
4. 规则中写入一个本机不存在的字体：popup 与扩展图标徽标出现警告。
5. 在 options 删除规则：引用它的站点条目里的引用同时被清理。
