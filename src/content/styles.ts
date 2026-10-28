import type { FetchCssResult } from "../shared/messages";
import type { PageIssue, Rule } from "../shared/types";

export type CssSource = { url: string; ruleId: string; ruleName: string };

let injectedCss = "";

export function collectCssSources(rules: Rule[]): CssSource[] {
  const sources: CssSource[] = [];
  for (const rule of rules) {
    for (const url of rule.cssUrls) {
      sources.push({ url, ruleId: rule.id, ruleName: rule.name });
    }
  }
  return sources;
}

async function sendCssMessage(message: {
  type: "insertCss" | "removeCss";
  css: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = (await chrome.runtime.sendMessage(message)) as
      | { ok: boolean; error?: string }
      | undefined;
    return result ?? { ok: false, error: "service worker 无响应" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchCss(url: string): Promise<FetchCssResult> {
  try {
    const result = (await chrome.runtime.sendMessage({ type: "fetchCss", url })) as
      | FetchCssResult
      | undefined;
    return result ?? { ok: false, error: "service worker 无响应" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 拉取并注入规则里的自定义 CSS；isCurrent 为假时中途放弃（配置已变化）。
 * 返回 CSS 相关的 issue。
 */
export async function syncStyles(
  sources: CssSource[],
  isCurrent: () => boolean,
): Promise<PageIssue[]> {
  const urls: string[] = [];
  for (const source of sources) if (!urls.includes(source.url)) urls.push(source.url);

  const results = await Promise.all(urls.map((url) => fetchCss(url)));
  if (!isCurrent()) return [];

  const issues: PageIssue[] = [];
  const parts: string[] = [];
  const failures = new Map<string, string>();
  urls.forEach((url, index) => {
    const result = results[index];
    if (result?.ok) parts.push(result.css);
    else failures.set(url, result?.error ?? "未知错误");
  });

  const recorded = new Set<string>();
  for (const source of sources) {
    const error = failures.get(source.url);
    if (error === undefined) continue;
    const key = `${source.ruleId}|${source.url}`;
    if (recorded.has(key)) continue;
    recorded.add(key);
    issues.push({
      kind: "css-failed",
      ruleId: source.ruleId,
      ruleName: source.ruleName,
      url: source.url,
      message: error,
    });
  }

  const next = parts.join("\n");
  if (next !== injectedCss) {
    const previous = injectedCss;
    injectedCss = "";
    if (previous !== "") await sendCssMessage({ type: "removeCss", css: previous });
    if (!isCurrent()) return issues;
    if (next !== "") {
      const result = await sendCssMessage({ type: "insertCss", css: next });
      if (result.ok) injectedCss = next;
      else issues.push({ kind: "css-inject-failed", message: result.error ?? "注入样式失败" });
    }
  }

  return issues;
}
