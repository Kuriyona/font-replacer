import type { Rule } from "./types";

/**
 * 内置规则的固定 id（同步存储键为 `rule:<id>`）。
 * 规则缺失时会被重新写回，删除入口在 UI 与 storage 两侧都被拦下。
 */
export const BUILTIN_RULE_IDS = ["builtin-default", "builtin-default-mono"] as const;

export type BuiltinRuleId = (typeof BUILTIN_RULE_IDS)[number];

type BuiltinSeed = {
  id: BuiltinRuleId;
  name: string;
  families: string[];
  selectors: Rule["selectors"];
};

/**
 * 内置字体栈只按"好看"排序，不关心本机是否安装：缺失时由浏览器回退到元素原本的字体栈。
 * 因此这些字体一律标记为 custom，避免被本机字体探测误报为"未安装"。
 * 选择器过滤默认各带一个预设：默认规则挂黑名单预设，等宽规则挂白名单预设。
 */
const SEEDS: BuiltinSeed[] = [
  {
    id: "builtin-default",
    name: "默认",
    selectors: { mode: "blacklist", list: [], preset: "regular-blacklist" },
    families: [
      "Inter",
      "SF Pro Text",
      "Roboto",
      "Segoe UI Variable Text",
      "Helvetica Neue",
      "IBM Plex Sans",
      "Source Sans 3",
      "Segoe UI",
      "PingFang SC",
      "Hiragino Sans GB",
      "Source Han Sans SC",
      "Noto Sans SC",
      "HarmonyOS Sans SC",
      "MiSans",
      "Microsoft YaHei",
      "Arial",
    ],
  },
  {
    id: "builtin-default-mono",
    name: "默认（等宽）",
    selectors: { mode: "whitelist", list: [], preset: "mono-whitelist" },
    families: [
      "Maple Mono",
      "Maple Mono NF",
      "JetBrains Mono",
      "Fira Code",
      "Cascadia Code",
      "SF Mono",
      "Menlo",
      "Consolas",
      "Source Code Pro",
      "IBM Plex Mono",
      "Roboto Mono",
      "Hack",
    ],
  },
];

export const isBuiltinRuleId = (id: string): id is BuiltinRuleId =>
  (BUILTIN_RULE_IDS as readonly string[]).includes(id);

/** 生成内置规则（时间戳用于 createdAt/updatedAt） */
export function makeBuiltinRules(now = Date.now()): Rule[] {
  return SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    enabled: true,
    fonts: seed.families.map((family) => ({ family, source: "custom" as const })),
    cssUrls: [],
    selectors: { ...seed.selectors, list: [...seed.selectors.list] },
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * 取内置规则的默认草稿：字体栈、名称、选择器过滤恢复为出厂值，
 * createdAt 沿用原规则以保持列表顺序稳定。非内置规则返回 null。
 */
export function resetBuiltinRule(rule: Rule, now = Date.now()): Rule | null {
  if (!isBuiltinRuleId(rule.id)) return null;
  const seed = makeBuiltinRules(now).find((item) => item.id === rule.id);
  return seed ? { ...seed, createdAt: rule.createdAt } : null;
}

/**
 * 需要写回存储的内置规则：
 * - 缺失的；
 * - 从未被保存过（createdAt === updatedAt）但选择器仍是旧默认值的，补上新的 mode 与预设。
 * 用户保存过的规则一律不覆盖。
 */
export function pendingBuiltinRules(existing: Rule[], now = Date.now()): Rule[] {
  const byId = new Map(existing.map((rule) => [rule.id, rule]));
  const pending: Rule[] = [];
  for (const seed of makeBuiltinRules(now)) {
    const current = byId.get(seed.id);
    if (!current) {
      pending.push(seed);
      continue;
    }
    const untouched = current.createdAt === current.updatedAt;
    const sameSelectors = JSON.stringify(current.selectors) === JSON.stringify(seed.selectors);
    if (untouched && !sameSelectors) {
      pending.push({ ...seed, createdAt: current.createdAt });
    }
  }
  return pending;
}
