import { cssQuote } from "../shared/rules";
import type { PageIssue, Rule } from "../shared/types";

const probeCache = new Map<string, Promise<boolean>>();

export function clearProbeCache(): void {
  probeCache.clear();
}

/**
 * 用只含 local() 的 FontFace 探测本机字体是否存在。
 * 不支持 FontFace 的环境返回 true，避免误报。
 */
export function probeLocalFont(family: string): Promise<boolean> {
  const key = family.trim().toLowerCase();
  const cached = probeCache.get(key);
  if (cached) return cached;

  const probe = (async () => {
    if (typeof FontFace !== "function") return true;
    try {
      const face = new FontFace("__font_refine_probe__", `local(${cssQuote(family)})`);
      await face.load();
      return true;
    } catch {
      return false;
    }
  })();

  probeCache.set(key, probe);
  return probe;
}

export async function missingFontIssues(
  rules: Rule[],
  probe: (family: string) => Promise<boolean>,
): Promise<PageIssue[]> {
  const families: string[] = [];
  const owners = new Map<string, Array<{ ruleId: string; ruleName: string; family: string }>>();
  const seen = new Set<string>();

  for (const rule of rules) {
    for (const font of rule.fonts) {
      if (font.source !== "system") continue;
      const key = font.family.toLowerCase();
      const owner = { ruleId: rule.id, ruleName: rule.name, family: font.family };
      const existing = owners.get(key);
      if (existing) {
        existing.push(owner);
        continue;
      }
      owners.set(key, [owner]);
      if (!seen.has(key)) {
        seen.add(key);
        families.push(font.family);
      }
    }
  }

  const results = await Promise.all(families.map((family) => probe(family)));
  const issues: PageIssue[] = [];
  families.forEach((family, index) => {
    if (results[index]) return;
    for (const owner of owners.get(family.toLowerCase()) ?? []) {
      issues.push({ kind: "font-missing", ...owner });
    }
  });
  return issues;
}

export async function collectIssues(
  rules: Rule[],
  cssIssues: PageIssue[],
  probe: (family: string) => Promise<boolean> = probeLocalFont,
): Promise<PageIssue[]> {
  const fontIssues = await missingFontIssues(rules, probe);
  const merged = [...fontIssues, ...cssIssues];
  const seen = new Set<string>();
  return merged.filter((issue) => {
    const key =
      issue.kind === "font-missing"
        ? `${issue.kind}|${issue.ruleId}|${issue.family.toLowerCase()}`
        : issue.kind === "css-failed"
          ? `${issue.kind}|${issue.ruleId}|${issue.url}`
          : `${issue.kind}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 只有顶层 frame 上报，避免子 frame 互相覆盖徽标 */
export function reportIssues(issues: PageIssue[]): void {
  if (window !== window.top) return;
  chrome.runtime.sendMessage({ type: "reportIssues", issues }).catch(() => {
    // service worker 可能已休眠，忽略
  });
}
