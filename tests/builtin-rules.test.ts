import { describe, expect, it } from "vite-plus/test";
import {
  BUILTIN_RULE_IDS,
  type BuiltinRuleId,
  isBuiltinRuleId,
  makeBuiltinRules,
  pendingBuiltinRules,
  resetBuiltinRule,
} from "../src/shared/builtin-rules";
import { buildFontStack, compileFilter, validateRuleDraft } from "../src/shared/rules";
import { presetSelectors } from "../src/shared/selector-presets";
import type { Rule } from "../src/shared/types";

const builtin = (id: BuiltinRuleId): Rule => {
  const rule = makeBuiltinRules(0).find((item) => item.id === id);
  if (!rule) throw new Error(`缺少内置规则 ${id}`);
  return rule;
};

describe("内置规则", () => {
  it("两条规则对应固定 id，字体栈无空项且忽略大小写去重", () => {
    const rules = makeBuiltinRules(0);
    expect(rules.map((rule) => rule.id)).toEqual([...BUILTIN_RULE_IDS]);

    for (const rule of rules) {
      expect(rule.fonts.length).toBeGreaterThan(5);
      const keys = rule.fonts.map((font) => font.family.trim().toLowerCase());
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).not.toContain("");
    }
  });

  it("默认规则覆盖常见无衬线 / 中文黑体，等宽规则覆盖 Maple Mono 系列", () => {
    const regularFamilies = builtin("builtin-default").fonts.map((font) => font.family);
    for (const family of ["Inter", "Roboto", "PingFang SC", "Source Han Sans SC"]) {
      expect(regularFamilies).toContain(family);
    }
    const monoFamilies = builtin("builtin-default-mono").fonts.map((font) => font.family);
    for (const family of ["Maple Mono", "Maple Mono NF", "JetBrains Mono"]) {
      expect(monoFamilies).toContain(family);
    }
  });

  it("字体一律标记为 custom，避免本机缺失告警", () => {
    for (const rule of makeBuiltinRules(0)) {
      for (const font of rule.fonts) expect(font.source).toBe("custom");
    }
  });

  it("字体栈能直接用于替换，且带空格的族名被正确引用", () => {
    const stack = buildFontStack(builtin("builtin-default"), "serif");
    expect(stack.startsWith('"Inter", ')).toBe(true);
    expect(stack).toContain('"Source Han Sans SC"');
    expect(stack.endsWith("serif")).toBe(true);
  });

  it("默认规则挂黑名单预设，等宽规则挂白名单预设", () => {
    const regular = builtin("builtin-default");
    expect(regular.selectors).toEqual({
      mode: "blacklist",
      list: [],
      preset: "regular-blacklist",
    });
    const mono = builtin("builtin-default-mono");
    expect(mono.selectors).toEqual({
      mode: "whitelist",
      list: [],
      preset: "mono-whitelist",
    });

    expect(compileFilter(regular)).toEqual({
      mode: "blacklist",
      text: presetSelectors("regular-blacklist").join(","),
    });
    expect(compileFilter(mono)).toEqual({
      mode: "whitelist",
      text: presetSelectors("mono-whitelist").join(","),
    });
    expect(validateRuleDraft(regular)).toEqual([]);
    expect(validateRuleDraft(mono)).toEqual([]);
  });

  it("缺的规则补上，用户保存过的不覆盖", () => {
    const edited: Rule = {
      ...builtin("builtin-default"),
      name: "我的默认",
      fonts: [{ family: "Inter", source: "custom" }],
      updatedAt: 7,
    };
    const pending = pendingBuiltinRules([edited]);
    expect(pending.map((rule) => rule.id)).toEqual(["builtin-default-mono"]);
    expect(pendingBuiltinRules(makeBuiltinRules(0))).toEqual([]);
  });

  it("从未保存过的旧默认值（不限制 / 无预设）会被升级成黑名单或白名单", () => {
    const legacy = makeBuiltinRules(0).map((rule) => ({
      ...rule,
      selectors: { mode: "none" as const, list: [] },
    }));
    const pending = pendingBuiltinRules(legacy);
    expect(pending.map((rule) => rule.id)).toEqual(["builtin-default", "builtin-default-mono"]);
    expect(pending[0]?.selectors).toEqual({
      mode: "blacklist",
      list: [],
      preset: "regular-blacklist",
    });
    expect(pending[0]?.createdAt).toBe(0);
  });

  it("重置恢复出厂字体栈与选择器，保留 createdAt", () => {
    const edited: Rule = {
      ...builtin("builtin-default"),
      name: "改过的名字",
      createdAt: 100,
      updatedAt: 200,
      fonts: [{ family: "Comic Sans MS", source: "custom" }],
      selectors: { mode: "none", list: [".x"] },
    };
    const reset = resetBuiltinRule(edited, 0);
    const seed = builtin("builtin-default");
    expect(reset).not.toBeNull();
    expect(reset?.name).toBe("默认");
    expect(reset?.fonts).toEqual(seed.fonts);
    expect(reset?.selectors).toEqual({
      mode: "blacklist",
      list: [],
      preset: "regular-blacklist",
    });
    expect(reset?.createdAt).toBe(100);
    expect(reset?.updatedAt).toBe(0);
  });

  it("非内置规则不能重置", () => {
    expect(resetBuiltinRule({ ...builtin("builtin-default"), id: "custom-id" }, 0)).toBeNull();
  });

  it("id 判定", () => {
    expect(isBuiltinRuleId("builtin-default")).toBe(true);
    expect(isBuiltinRuleId("builtin-default-mono")).toBe(true);
    expect(isBuiltinRuleId("3f0c0f7e-0000-4000-8000-000000000000")).toBe(false);
  });
});
