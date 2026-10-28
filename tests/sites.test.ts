import { describe, expect, it } from "vite-plus/test";
import {
  findEffectiveSite,
  matchesSite,
  normalizeHostname,
  normalizeSite,
  validateSiteDraft,
} from "../src/shared/sites";
import { toRegistrableDomain } from "../src/shared/site-domains";
import type { SiteRule } from "../src/shared/types";

const site = (pattern: string, match: "host" | "domain", ruleIds: string[] = []): SiteRule => ({
  pattern,
  match,
  ruleIds,
  createdAt: 0,
  updatedAt: 0,
});

describe("normalizeHostname", () => {
  it("接受完整 URL 并取主机名", () => {
    expect(normalizeHostname("https://www.example.com/a?b")).toBe("www.example.com");
    expect(normalizeHostname("  EXAMPLE.com  ")).toBe("example.com");
    expect(normalizeHostname("example.com:8080/path")).toBe("example.com");
  });

  it("非法输入返回 null", () => {
    expect(normalizeHostname("")).toBeNull();
    expect(normalizeHostname("http://")).toBeNull();
  });
});

describe("matchesSite", () => {
  it("host 精确匹配，domain 匹配自身与子域", () => {
    expect(matchesSite(site("www.example.com", "host"), "www.example.com")).toBe(true);
    expect(matchesSite(site("www.example.com", "host"), "example.com")).toBe(false);
    expect(matchesSite(site("example.com", "domain"), "example.com")).toBe(true);
    expect(matchesSite(site("example.com", "domain"), "a.b.example.com")).toBe(true);
    expect(matchesSite(site("example.com", "domain"), "notexample.com")).toBe(false);
  });
});

describe("findEffectiveSite", () => {
  const host = site("www.example.com", "host", ["host-rule"]);
  const wide = site("example.com", "domain", ["wide"]);
  const narrow = site("co.uk", "domain", ["narrow"]);

  it("host 优先于 domain", () => {
    expect(findEffectiveSite("www.example.com", [wide, host])).toEqual(host);
  });

  it("多个 domain 取最长 pattern", () => {
    expect(findEffectiveSite("a.example.co.uk", [wide, narrow])).toEqual(narrow);
  });

  it("不匹配返回 null，且只返回单一条目", () => {
    expect(findEffectiveSite("other.org", [wide, host])).toBeNull();
    expect(
      findEffectiveSite("example.com", [wide, site("example.com", "domain", ["x"])])?.ruleIds,
    ).toEqual(["wide"]);
  });
});

describe("normalizeSite", () => {
  it("规范化 pattern 与 ruleIds", () => {
    const result = normalizeSite({
      pattern: "https://Example.com/path",
      match: "domain",
      ruleIds: ["a", "a", 3],
    });
    expect(result).toEqual({
      pattern: "example.com",
      match: "domain",
      ruleIds: ["a"],
      createdAt: 0,
      updatedAt: 0,
    });
    expect(normalizeSite({ pattern: "example.com", match: "weird" })).toBeNull();
  });
});

describe("toRegistrableDomain", () => {
  it("取 eTLD+1", () => {
    expect(toRegistrableDomain("www.example.co.uk")).toBe("example.co.uk");
    expect(toRegistrableDomain("a.b.example.com")).toBe("example.com");
  });

  it("localhost 与 IP 返回 null", () => {
    expect(toRegistrableDomain("localhost")).toBeNull();
    expect(toRegistrableDomain("127.0.0.1")).toBeNull();
    expect(toRegistrableDomain("[::1]")).toBeNull();
  });
});

describe("validateSiteDraft", () => {
  it("domain 模式要求可注册域名", () => {
    expect(
      validateSiteDraft({ pattern: "www.example.com", match: "domain" }, toRegistrableDomain),
    ).toEqual(["请输入可注册域名（如 example.com）"]);
    expect(
      validateSiteDraft({ pattern: "example.com", match: "domain" }, toRegistrableDomain),
    ).toEqual([]);
    expect(
      validateSiteDraft({ pattern: "www.example.com", match: "host" }, toRegistrableDomain),
    ).toEqual([]);
  });
});
