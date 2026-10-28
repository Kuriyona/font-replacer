import { describe, expect, it } from "vite-plus/test";
import {
  SELECTOR_PRESETS,
  isSelectorPresetId,
  presetSelectors,
} from "../src/shared/selector-presets";
import {
  compileFilter,
  normalizeRule,
  selectorCount,
  validateRuleDraft,
} from "../src/shared/rules";
import type { Rule } from "../src/shared/types";

const baseRule: Rule = {
  id: "r1",
  name: "预设",
  enabled: true,
  fonts: [{ family: "Noto Sans", source: "system" }],
  cssUrls: [],
  selectors: { mode: "none", list: [] },
  createdAt: 0,
  updatedAt: 0,
};

describe("选择器预设数据", () => {
  it("选择器条目干净：去空白、无重复、一行一个", () => {
    for (const preset of SELECTOR_PRESETS) {
      expect(preset.list.length).toBeGreaterThan(0);
      expect(new Set(preset.list).size).toBe(preset.list.length);
      for (const selector of preset.list) {
        expect(selector).toBe(selector.trim());
        expect(selector).not.toBe("");
        expect(selector).not.toContain("\n");
      }
    }
  });

  it("黑名单不含容器级标签（closest 会把整页排除掉）", () => {
    const regular = SELECTOR_PRESETS.find((preset) => preset.id === "regular-blacklist");
    const forbidden = new Set(["*", "html", "body", "div", "span", "main", "section", "article"]);
    for (const selector of regular?.list ?? []) {
      expect(forbidden.has(selector)).toBe(false);
    }
  });

  it("等宽白名单覆盖代码标签、monospace 声明与 mono 类名", () => {
    const list = presetSelectors("mono-whitelist");
    for (const selector of ["pre", "code", "kbd", "textarea", '[style*="monospace" i]']) {
      expect(list).toContain(selector);
    }
    expect(list.some((selector) => selector.toLowerCase().startsWith('[class*="mono"'))).toBe(true);
  });

  it("按 id 查找预设，非法 id 返回空", () => {
    expect(isSelectorPresetId("mono-whitelist")).toBe(true);
    expect(isSelectorPresetId("unknown")).toBe(false);
    expect(isSelectorPresetId(42)).toBe(false);
    expect(presetSelectors("regular-blacklist").length).toBeGreaterThan(0);
    expect(presetSelectors(undefined)).toEqual([]);
  });
});

describe("预设与自定义选择器合并", () => {
  it("预设选择器排在自定义选择器之前，并计入条数", () => {
    const rule: Rule = {
      ...baseRule,
      selectors: { mode: "blacklist", list: [".keep", ".notice"], preset: "regular-blacklist" },
    };
    const filter = compileFilter(rule);
    expect(filter).toEqual({
      mode: "blacklist",
      text: `${presetSelectors("regular-blacklist").join(",")},.keep,.notice`,
    });
    expect(selectorCount(rule)).toBe(presetSelectors("regular-blacklist").length + 2);
  });

  it("只有预设、没有自定义选择器时也算已配置过滤", () => {
    const rule: Rule = {
      ...baseRule,
      selectors: { mode: "whitelist", list: [], preset: "mono-whitelist" },
    };
    expect(validateRuleDraft(rule)).toEqual([]);
    expect(compileFilter(rule).mode).toBe("whitelist");
  });

  it("模式为不限制时预设不生效", () => {
    const rule: Rule = {
      ...baseRule,
      selectors: { mode: "none", list: [], preset: "mono-whitelist" },
    };
    expect(compileFilter(rule)).toEqual({ mode: "none" });
    expect(selectorCount(rule)).toBe(presetSelectors("mono-whitelist").length);
  });
});

describe("normalizeRule 处理预设", () => {
  it("保留合法预设", () => {
    const rule = normalizeRule({
      id: "r",
      name: "x",
      selectors: { mode: "blacklist", list: [], preset: "mono-whitelist" },
    });
    expect(rule?.selectors).toEqual({ mode: "blacklist", list: [], preset: "mono-whitelist" });
  });

  it("非法预设被丢弃，且不再让空列表的模式成立", () => {
    const rule = normalizeRule({
      id: "r",
      name: "x",
      selectors: { mode: "blacklist", list: [], preset: "nope" },
    });
    expect(rule?.selectors).toEqual({ mode: "none", list: [] });
    expect(rule?.selectors.preset).toBeUndefined();
  });
});
