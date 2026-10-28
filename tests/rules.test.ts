import { describe, expect, it } from "vite-plus/test";
import {
  buildFontStack,
  compileFilter,
  cssQuote,
  normalizeRule,
  pickRule,
  resolveSiteRules,
  validateRuleDraft,
} from "../src/shared/rules";
import type { Rule, SiteRule } from "../src/shared/types";

const makeRule = (patch: Partial<Rule> = {}): Rule => ({
  id: "rule-1",
  name: "测试规则",
  enabled: true,
  fonts: [{ family: "Inter", source: "system" }],
  cssUrls: [],
  selectors: { mode: "none", list: [] },
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

const makeElement = (closest: (selector: string) => boolean): Element =>
  ({ closest: (selector: string) => (closest(selector) ? {} : null) }) as unknown as Element;

describe("buildFontStack", () => {
  it("拼接规则字体与原始字体栈", () => {
    const rule = makeRule({
      fonts: [
        { family: "Inter", source: "system" },
        { family: "Noto Sans SC", source: "custom" },
      ],
    });
    expect(buildFontStack(rule, '"Segoe UI", sans-serif')).toBe(
      '"Inter", "Noto Sans SC", "Segoe UI", sans-serif',
    );
  });

  it("转义引号与反斜杠", () => {
    const rule = makeRule({ fonts: [{ family: 'My "Font" \\ A', source: "custom" }] });
    expect(buildFontStack(rule, "")).toBe('"My \\"Font\\" \\\\ A"');
  });

  it("按小写去重字体并跳过空白原栈", () => {
    const rule = makeRule({
      fonts: [
        { family: "Inter", source: "system" },
        { family: "inter", source: "custom" },
      ],
    });
    expect(buildFontStack(rule, "   ")).toBe('"Inter"');
  });

  it("没有字体时返回空串", () => {
    expect(buildFontStack(makeRule({ fonts: [] }), "sans-serif")).toBe("");
  });
});

describe("cssQuote", () => {
  it("换行写成 CSS 转义", () => {
    expect(cssQuote("a\nb")).toBe('"a\\a b"');
  });
});

describe("pickRule", () => {
  it("返回首条命中规则并跳过停用/无字体/抛错的规则", () => {
    const disabled = makeRule({ id: "disabled", enabled: false });
    const noFonts = makeRule({ id: "no-fonts", fonts: [] });
    const broken = makeRule({
      id: "broken",
      selectors: { mode: "blacklist", list: ["[bad"] },
    });
    const hit = makeRule({ id: "hit" });
    const element = makeElement((selector) => {
      if (selector === "[bad") throw new Error("invalid selector");
      return false;
    });

    expect(pickRule([disabled, noFonts, broken, hit], element)?.rule.id).toBe("hit");
  });

  it("黑名单排除匹配元素", () => {
    const rule = makeRule({ selectors: { mode: "blacklist", list: [".article"] } });
    expect(
      pickRule(
        [rule],
        makeElement(() => true),
      ),
    ).toBeNull();
    expect(
      pickRule(
        [rule],
        makeElement(() => false),
      )?.rule.id,
    ).toBe("rule-1");
  });

  it("白名单只作用于匹配元素", () => {
    const rule = makeRule({ selectors: { mode: "whitelist", list: ["main", ".article"] } });
    expect(
      pickRule(
        [rule],
        makeElement(() => false),
      ),
    ).toBeNull();
    const picked = pickRule(
      [rule],
      makeElement(() => true),
    );
    expect(picked?.rule.id).toBe("rule-1");
    expect(picked?.filterText).toBe("main,.article");
  });

  it("无过滤规则命中所有元素", () => {
    const rule = makeRule();
    expect(
      pickRule(
        [rule],
        makeElement(() => false),
      )?.rule.id,
    ).toBe("rule-1");
    expect(compileFilter(rule)).toEqual({ mode: "none" });
  });
});

describe("resolveSiteRules", () => {
  it("按站点顺序返回并跳过缺失与停用规则", () => {
    const first = makeRule({ id: "a" });
    const second = makeRule({ id: "b" });
    const third = makeRule({ id: "c", enabled: false });
    const site: SiteRule = {
      pattern: "example.com",
      match: "domain",
      ruleIds: ["c", "b", "missing", "a"],
      createdAt: 0,
      updatedAt: 0,
    };
    expect(resolveSiteRules(site, [first, second, third]).map((rule) => rule.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("normalizeRule", () => {
  it("规范化字段并丢弃无效项", () => {
    const rule = normalizeRule({
      id: "x",
      name: " 名称 ",
      fonts: [{ family: "Inter", source: "custom" }, { family: "inter" }, { family: "  " }],
      cssUrls: ["https://a/b.css", "https://a/b.css", " "],
      selectors: { mode: "blacklist", list: [] },
    });
    expect(rule).not.toBeNull();
    expect(rule?.name).toBe("名称");
    expect(rule?.enabled).toBe(true);
    expect(rule?.fonts).toEqual([{ family: "Inter", source: "custom" }]);
    expect(rule?.cssUrls).toEqual(["https://a/b.css"]);
    expect(rule?.selectors).toEqual({ mode: "none", list: [] });
    expect(normalizeRule({ id: "", name: "x" })).toBeNull();
    expect(normalizeRule({ id: "x", name: "" })).toBeNull();
  });
});

describe("validateRuleDraft", () => {
  const validateSelector = (selector: string): boolean => selector !== "[bad";

  it("空名称与空字体报错", () => {
    const errors = validateRuleDraft(makeRule({ name: "  ", fonts: [] }), { validateSelector });
    expect(errors.some((item) => item.includes("名称"))).toBe(true);
    expect(errors.some((item) => item.includes("字体"))).toBe(true);
  });

  it("非法 URL、非法字重、非法选择器报错", () => {
    const errors = validateRuleDraft(
      makeRule({
        cssUrls: ["ftp://example.com/a.css", "not a url"],
        fontWeight: 450,
        selectors: { mode: "whitelist", list: ["[bad"] },
      }),
      { validateSelector },
    );
    expect(errors.filter((item) => item.includes("CSS 链接无效"))).toHaveLength(2);
    expect(errors.some((item) => item.includes("字重"))).toBe(true);
    expect(errors.some((item) => item.includes("选择器无效"))).toBe(true);
  });

  it("合法草稿无错误", () => {
    const errors = validateRuleDraft(
      makeRule({
        cssUrls: ["https://example.com/fonts.css"],
        fontWeight: 500,
        selectors: { mode: "blacklist", list: [".ignore"] },
      }),
      { validateSelector },
    );
    expect(errors).toEqual([]);
  });
});
