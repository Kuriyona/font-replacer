import type { SelectorMode, SelectorPresetId } from "./types";

/** 选择器过滤预设：可叠加在规则上，与用户自定义选择器合并生效 */
export type SelectorPreset = {
  id: SelectorPresetId;
  label: string;
  description: string;
  /** 预设适用的过滤模式（仅供参考展示） */
  mode: Exclude<SelectorMode, "none">;
  list: string[];
};

/**
 * 常规字体黑名单：常见正文文本元素。
 * 黑名单命中即排除该元素及其子树，所以这里只列承载正文的叶子级标签——
 * 不能列 body/div/span 这类容器，否则 `closest()` 让整页都被排除。
 * `i` 故意不列：它通常被图标字体（Font Awesome 等）占用。
 */
const REGULAR_BLACKLIST: SelectorPreset = {
  id: "regular-blacklist",
  label: "常规字体黑名单",
  description:
    "把常见正文文本元素（段落、标题、列表、表格、表单控件等）排除在替换之外，规则只作用于其余元素。",
  mode: "blacklist",
  list: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "td",
    "th",
    "caption",
    "dd",
    "dt",
    "blockquote",
    "figcaption",
    "summary",
    "legend",
    "a",
    "label",
    "button",
    "input",
    "select",
    "small",
    "strong",
    "em",
    "b",
    "u",
    "s",
    "sub",
    "sup",
    "mark",
    "cite",
    "q",
  ],
};

/**
 * 等宽字体白名单：标签 + 行内样式 + 常见类名/代码高亮框架三类线索。
 * 白名单只在命中元素（或其子树）内生效，列表里可以放心写宽泛的类名片段。
 */
const MONO_WHITELIST: SelectorPreset = {
  id: "mono-whitelist",
  label: "等宽字体白名单",
  description:
    "只替换代码与等宽字体元素：code/pre/kbd/textarea、行内 monospace 声明、mono/code 类名与常见代码高亮类。",
  mode: "whitelist",
  list: [
    "pre",
    "code",
    "kbd",
    "samp",
    "tt",
    "textarea",
    '[style*="monospace" i]',
    '[style*="Consolas" i]',
    '[style*="Menlo" i]',
    '[style*="Monaco" i]',
    '[style*="Courier" i]',
    '[style*="SFMono" i]',
    '[style*="Fira Code" i]',
    '[style*="JetBrains" i]',
    '[style*="Source Code" i]',
    '[style*="Cascadia" i]',
    '[class*="mono" i]',
    '[class*="code" i]',
    '[class*="console" i]',
    '[class*="terminal" i]',
    '[class*="hljs" i]',
    '[class*="language-" i]',
    '[class*="prism" i]',
    '[class*="prettyprint" i]',
    '[class*="shiki" i]',
  ],
};

export const SELECTOR_PRESETS: SelectorPreset[] = [REGULAR_BLACKLIST, MONO_WHITELIST];

const PRESETS_BY_ID = new Map(SELECTOR_PRESETS.map((preset) => [preset.id, preset]));

export const isSelectorPresetId = (value: unknown): value is SelectorPresetId =>
  typeof value === "string" && PRESETS_BY_ID.has(value as SelectorPresetId);

export const presetById = (id: SelectorPresetId): SelectorPreset | undefined =>
  PRESETS_BY_ID.get(id);

/** 预设自带的选择器；id 无效时返回空数组 */
export const presetSelectors = (id: SelectorPresetId | undefined): string[] =>
  (id ? PRESETS_BY_ID.get(id)?.list : undefined) ?? [];
