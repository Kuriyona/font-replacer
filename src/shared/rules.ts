import type { Rule, RuleFont, SelectorMode, SiteRule } from "./types";

const FONT_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const timestamp = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** 默认选择器校验：只有作用域内能构造出查询器才算合法 */
export const defaultSelectorValidator = (selector: string): boolean => {
  if (typeof document === "undefined") return true;
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
};

/**
 * 校验并规范化一条存储中的规则。任何结构性问题返回 null，由调用方丢弃。
 */
export function normalizeRule(raw: unknown): Rule | null {
  if (!isObject(raw)) return null;
  if (!nonEmptyString(raw.id) || !nonEmptyString(raw.name)) return null;

  const fonts: RuleFont[] = [];
  const seenFamilies = new Set<string>();
  if (Array.isArray(raw.fonts)) {
    for (const item of raw.fonts) {
      if (!isObject(item) || !nonEmptyString(item.family)) continue;
      const family = item.family.trim();
      const key = family.toLowerCase();
      if (seenFamilies.has(key)) continue;
      seenFamilies.add(key);
      fonts.push({ family, source: item.source === "custom" ? "custom" : "system" });
    }
  }

  const fontWeight =
    typeof raw.fontWeight === "number" && FONT_WEIGHTS.has(raw.fontWeight)
      ? raw.fontWeight
      : undefined;

  const cssUrls: string[] = [];
  if (Array.isArray(raw.cssUrls)) {
    for (const item of raw.cssUrls) {
      if (!nonEmptyString(item)) continue;
      cssUrls.push(item.trim());
    }
  }

  const rawSelectors = isObject(raw.selectors) ? raw.selectors : {};
  const rawMode = rawSelectors.mode;
  const mode: SelectorMode = rawMode === "blacklist" || rawMode === "whitelist" ? rawMode : "none";
  const list: string[] = [];
  if (Array.isArray(rawSelectors.list)) {
    for (const item of rawSelectors.list) {
      if (!nonEmptyString(item)) continue;
      list.push(item.trim());
    }
  }

  return {
    id: raw.id.trim(),
    name: raw.name.trim(),
    enabled: raw.enabled !== false,
    fonts,
    fontWeight,
    cssUrls: [...new Set(cssUrls)],
    selectors: { mode: list.length === 0 ? "none" : mode, list: [...new Set(list)] },
    createdAt: timestamp(raw.createdAt),
    updatedAt: timestamp(raw.updatedAt),
  };
}

/** 按站点顺序取出规则；跳过已删除与停用的规则 */
export function resolveSiteRules(site: SiteRule, rules: Rule[]): Rule[] {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const result: Rule[] = [];
  for (const id of site.ruleIds) {
    const rule = byId.get(id);
    if (rule && rule.enabled) result.push(rule);
  }
  return result;
}

export type RuleDraftDeps = {
  validateSelector?: (selector: string) => boolean;
};

/**
 * 校验规则草稿，返回中文错误列表（空数组表示通过）。
 */
export function validateRuleDraft(rule: Rule, deps: RuleDraftDeps = {}): string[] {
  const errors: string[] = [];
  const validateSelector = deps.validateSelector ?? defaultSelectorValidator;

  const name = rule.name.trim();
  if (name === "") errors.push("规则名称不能为空");
  else if (name.length > 80) errors.push("规则名称不能超过 80 个字符");

  if (rule.fonts.length === 0) errors.push("至少需要添加一个字体");
  for (const font of rule.fonts) {
    if (font.family.trim() === "") errors.push("字体名称不能为空");
    else if (font.family.length > 200) errors.push(`字体名称过长：${font.family.slice(0, 20)}…`);
  }

  if (rule.fontWeight !== undefined && !FONT_WEIGHTS.has(rule.fontWeight)) {
    errors.push("字重必须是 100 到 900 之间的百位整数");
  }

  for (const url of rule.cssUrls) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      errors.push(`CSS 链接无效（需要 http/https 绝对地址）：${url}`);
    }
  }

  if (rule.selectors.mode !== "none") {
    if (rule.selectors.list.length === 0)
      errors.push("选择器模式不为“不限制”时必须填写至少一条选择器");
    for (const selector of rule.selectors.list) {
      if (!validateSelector(selector)) errors.push(`选择器无效：${selector}`);
    }
  }

  return [...new Set(errors)];
}

/** 把字体名写成 CSS 字符串字面量 */
export function cssQuote(family: string): string {
  return `"${family.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ")}"`;
}

/**
 * 规则字体栈 + 元素原始字体栈；字体为空时返回空串（调用方不应用）。
 */
export function buildFontStack(rule: Rule, originalChain: string): string {
  const seen = new Set<string>();
  const families: string[] = [];
  for (const font of rule.fonts) {
    const family = font.family.trim();
    if (family === "") continue;
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    families.push(cssQuote(family));
  }
  if (families.length === 0) return "";

  const original = originalChain.trim();
  if (original === "") return families.join(", ");
  return [...families, original].join(", ");
}

export type CompiledFilter = { mode: "none" } | { mode: "blacklist" | "whitelist"; text: string };

/** 选择器列表编译为一条逗号分隔的选择器 */
export function compileFilter(rule: Rule): CompiledFilter {
  const { mode, list } = rule.selectors;
  if (mode === "none" || list.length === 0) return { mode: "none" };
  return { mode, text: list.join(",") };
}

export type PickedRule = { rule: Rule; filterText?: string };

/**
 * 同一元素只应用优先级最高的一条命中规则。无 DOM 依赖（只调用 element.closest）。
 */
export function pickRule(rules: Rule[], element: Element): PickedRule | null {
  for (const rule of rules) {
    if (!rule.enabled || rule.fonts.length === 0) continue;
    const filter = compileFilter(rule);
    if (filter.mode === "none") return { rule };

    let hit: boolean;
    try {
      hit = element.closest(filter.text) !== null;
    } catch {
      // 运行期非法选择器：跳过该规则
      continue;
    }
    if (filter.mode === "blacklist" ? !hit : hit) return { rule, filterText: filter.text };
  }
  return null;
}
