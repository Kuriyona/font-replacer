import { describe, expect, it } from "vite-plus/test";
import { collectIssues, missingFontIssues } from "../src/content/issues";
import type { Rule } from "../src/shared/types";

const rule = (
  id: string,
  families: Array<{ family: string; source: "system" | "custom" }>,
): Rule => ({
  id,
  name: `规则 ${id}`,
  enabled: true,
  fonts: families,
  cssUrls: [],
  selectors: { mode: "none", list: [] },
  createdAt: 0,
  updatedAt: 0,
});

describe("missingFontIssues", () => {
  it("只对本机字体报缺失，并按 family 去重", async () => {
    const rules = [
      rule("a", [
        { family: "Inter", source: "system" },
        { family: "inter", source: "system" },
        { family: "Missing Font", source: "system" },
        { family: "Custom Only", source: "custom" },
      ]),
      rule("b", [{ family: "Missing Font", source: "system" }]),
    ];

    const probed: string[] = [];
    const issues = await missingFontIssues(rules, async (family) => {
      probed.push(family);
      return family.toLowerCase() !== "missing font";
    });

    expect(probed).toEqual(["Inter", "Missing Font"]);
    expect(issues).toEqual([
      { kind: "font-missing", ruleId: "a", ruleName: "规则 a", family: "Missing Font" },
      { kind: "font-missing", ruleId: "b", ruleName: "规则 b", family: "Missing Font" },
    ]);
  });

  it("页面级字体问题与 CSS 问题合并去重", async () => {
    const rules = [rule("a", [{ family: "Nope", source: "system" }])];
    const cssIssues = [
      {
        kind: "css-failed" as const,
        ruleId: "a",
        ruleName: "规则 a",
        url: "https://example.com/a.css",
        message: "HTTP 404",
      },
      {
        kind: "css-failed" as const,
        ruleId: "a",
        ruleName: "规则 a",
        url: "https://example.com/a.css",
        message: "HTTP 404",
      },
    ];
    const issues = await collectIssues(rules, cssIssues, async () => false);
    expect(issues).toHaveLength(2);
  });
});
