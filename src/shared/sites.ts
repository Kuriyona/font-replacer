import type { SiteRule } from "./types";

/**
 * 接受 hostname 或完整 URL，返回规范化后的主机名（小写、punycode）；非法输入返回 null。
 */
export function normalizeHostname(input: string): string | null {
  const text = input.trim();
  if (text === "") return null;
  const candidate = text.includes("://") ? text : `http://${text}`;
  try {
    const hostname = new URL(candidate).hostname.toLowerCase();
    return hostname === "" ? null : hostname;
  } catch {
    return null;
  }
}

export function matchesSite(site: SiteRule, hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (site.match === "host") return site.pattern === host;
  return host === site.pattern || host.endsWith(`.${site.pattern}`);
}

/**
 * 取对该主机名生效的唯一站点条目：host 优先；多个 domain 取 pattern 最长者，长度相同取字典序靠前。
 */
export function findEffectiveSite(hostname: string, sites: SiteRule[]): SiteRule | null {
  const host = hostname.toLowerCase();
  const hostMatch = sites.find((site) => site.match === "host" && site.pattern === host);
  if (hostMatch) return hostMatch;

  let best: SiteRule | null = null;
  for (const site of sites) {
    if (site.match !== "domain") continue;
    if (!(host === site.pattern || host.endsWith(`.${site.pattern}`))) continue;
    if (
      best === null ||
      site.pattern.length > best.pattern.length ||
      (site.pattern.length === best.pattern.length && site.pattern < best.pattern)
    ) {
      best = site;
    }
  }
  return best;
}

export function normalizeSite(raw: unknown): SiteRule | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (source.match !== "host" && source.match !== "domain") return null;
  if (typeof source.pattern !== "string") return null;
  const pattern = normalizeHostname(source.pattern);
  if (!pattern) return null;

  const ruleIds: string[] = [];
  if (Array.isArray(source.ruleIds)) {
    for (const item of source.ruleIds) {
      if (typeof item !== "string" || item.trim() === "") continue;
      ruleIds.push(item);
    }
  }

  const timestamp = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return {
    pattern,
    match: source.match,
    ruleIds: [...new Set(ruleIds)],
    createdAt: timestamp(source.createdAt),
    updatedAt: timestamp(source.updatedAt),
  };
}

export function validateSiteDraft(
  draft: { pattern: string; match: "host" | "domain" },
  toRegistrableDomain: (hostname: string) => string | null,
): string[] {
  const pattern = normalizeHostname(draft.pattern);
  if (!pattern) return ["请输入有效的主机名或域名"];
  if (draft.match === "host") return [];
  const registrable = toRegistrableDomain(pattern);
  if (registrable !== pattern) return ["请输入可注册域名（如 example.com）"];
  return [];
}
