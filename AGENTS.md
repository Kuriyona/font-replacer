# AGENTS.md

Font Refine：Manifest V3 Chromium 扩展，按站点替换网页字体。Vue 3 + Vite+（`vite-plus`）+ Tailwind v4 + dotsharp。

## 命令

| 命令             | 说明                                               |
| ---------------- | -------------------------------------------------- |
| `pnpm build`     | 构建 `dist/`（UI → content IIFE → background ESM） |
| `pnpm watch`     | 监听构建                                           |
| `pnpm test`      | Vitest（经 `vite-plus/test`）                      |
| `pnpm typecheck` | `vue-tsc --noEmit`                                 |
| `pnpm check`     | 格式化 + lint + 类型检查（`--fix` 自动修）         |
| `pnpm icons`     | 由 `public/icons/icon.svg` 生成 PNG                |

改动后至少跑 `pnpm test`、`pnpm typecheck`、`pnpm check`、`pnpm build`。构建会清空 `dist/`；`scripts/build.mjs` 末尾断言 `dist/manifest.json` 存在，并须保证 `dist/content.js` 为单文件 IIFE（不能有 `import`/`export`）、`dist/background.js` 无外部裸导入。

## 工具链约束

- **不要单独安装** `vite`、`vitest`、`oxlint`、`oxfmt`、`eslint`、`prettier`；配置只留 `vite.config.ts` 一份（`test`/`fmt` 块写在其中）。
- `pnpm-workspace.yaml` 里的 `overrides: vite → @voidzero-dev/vite-plus-core@1.4.0` 是必需的：去掉后会多出独立 `vite@8`，与 vite-plus 的 core 类型重复，`tsc` 解析 `plugins: [vue()]` 时内部崩溃。
- **typescript 必须留在 5.x**：TS 7 的 `exports` 不含 `./lib/tsc`，`vue-tsc` 直接启动失败。
- UI 组件库用 `@sharpdotnut/dotsharp`（组件、`showSnackbar`、`--ds-*` 主题令牌，入口 `src/popup/main.ts` / `src/options/main.ts` 各引一次 `style.css`）；图标用 `@iconify/vue` 数据，按 `@iconify-icons/material-symbols/<name>` 逐个引入。工具函数优先 `es-toolkit`（如 `debounce`），域名解析用 `tldts`。
- `vp check` 的 `fmt.ignorePatterns` 只忽略 `dist/**`，不要移除。

## 架构

- `src/shared/`：纯逻辑与存储。`rules.ts`（应用语义：`pickRule`/`buildFontStack`/校验）、`sites.ts`（host/domain 匹配）、`site-domains.ts`（`tldts`，仅供 UI）、`storage.ts`（sync 配置 / local 字体缓存）、`css-urls.ts`（`postcss`，仅 service worker）、`fonts.ts`（`queryLocalFonts` → `fontSettings` 回落）。
- `src/content/`：`index.ts` 负责生命周期与配置订阅，`engine.ts` 负责两阶段采集/应用、Shadow DOM、MutationObserver、inline 恢复，`styles.ts` 注入 CSS，`issues.ts` 探测缺失字体并上报。
- `src/background/index.ts`：`fetchCss`（http/https、2MB 上限、URL 绝对化、内存缓存）、`insertCss/removeCss`、徽标。
- `src/popup`、`src/options`、`src/ui/components`、`src/ui/styles.css`（把 dotsharp 的 `--ds-*` 令牌映射成 Tailwind 颜色 / 圆角 / 阴影，并设置页面底色）。

**bundle 边界**：`content.js` 只能依赖 `sites.ts`/`rules.ts`/`storage.ts` 等浏览器安全模块，禁止引入 `tldts`、`postcss`（只属于 UI / service worker）。

## 不变量

- 同一元素只应用站点规则列表里**第一条命中**的规则；停用规则不参与匹配、CSS 注入与缺失检测。
- 站点匹配取**唯一**最具体条目：host 优先于 domain，多个 domain 取最长 pattern，不合并。
- 最终字体栈 = 规则字体（有序去重）+ 元素原始 computed 栈，规则字体缺失时自然回退。
- `buildFontStack` 空字体返回 `''`，调用方不得应用；写 inline 一律 `!important`，恢复时按原 value/priority 还原。
- 配置写 `chrome.storage.sync`（键 `rule:<uuid>`、`site:<host|domain>:<pattern>`、`schemaVersion`，单键 ≤8KB），字体缓存写 `local`；sync 失败不静默改道 local。
- 删除规则必须同时清理站点里的引用（`deleteRule`）。
- 仅顶层 frame 上报 issue，避免子 frame 互相覆盖徽标；内容脚本对 `getPageIssues` 都要能响应。

## 约定

- 用户可见文案、注释、文档用中文；标识符英文。
- 控件一律用 dotsharp 组件（`Button` / `Input` / `Select` / `Switch` / `Dialog` / `Card` / `Tabs` / `Chip` / `IconButton` 等），布局用 Tailwind 工具类；颜色只用 `styles.css` 映射出的令牌类（`text-ds-fg` / `text-ds-muted` / `border-ds-line` / `bg-ds-surface` / `bg-ds-tonal` / `text-ds-error` 等），不写死色值。需要压过组件内部类时用 `!`（如 `h-8!`），不要复制组件样式。
- 字段标签写在控件自己的 `label` 上（`Input` / `Select` / `Switch` 都支持，`Input` 还用 `description` 出说明文字），不要用 `FormItem` 包一层；`FormItem` 只在需要保留说明文字、而控件本身没有 `description`（`Select` / `Switch`）时承载那段文字。同一字段绝不能同时写两处标签。
- 不要写未分层的全局选择器（如 `:focus-visible`、`*`、裸元素规则）：Tailwind 的工具类都在 `@layer` 里，未分层规则会压过组件的 `outline-none` 等工具类，造成双重边框。组件已自带 focus 样式，自绘元素显式加 `focus-visible:outline-*` 工具类。
- 测试放在 `tests/`，从 `vite-plus/test` 导入；需要 DOM 的校验函数以依赖注入方式传桩（参考 `validateRuleDraft`）。
- 真实浏览器验收（加载 `dist/`、字体替换效果、徽标）由人工完成，自动化验证止于单元测试、类型检查、构建产物检查。
