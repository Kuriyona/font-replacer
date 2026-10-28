import { absolutizeCssUrls } from "../shared/css-urls";
import type { CssOpResult, FetchCssResult } from "../shared/messages";
import { ensureBuiltinRules, ensureSchemaVersion } from "../shared/storage";

const cssCache = new Map<string, string>();
const MAX_CSS_LENGTH = 2_000_000;

async function handleFetchCss(url: unknown): Promise<FetchCssResult> {
  if (typeof url !== "string") return { ok: false, error: "缺少 CSS 链接" };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "链接格式无效" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "只允许 http/https 链接" };
  }

  const cached = cssCache.get(parsed.href);
  if (cached !== undefined) return { ok: true, css: cached };

  try {
    const response = await fetch(parsed.href, {
      credentials: "omit",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const text = await response.text();
    if (text.length > MAX_CSS_LENGTH) {
      return { ok: false, error: "CSS 文件过大（超过 2,000,000 字符）" };
    }
    const css = absolutizeCssUrls(text, response.url || parsed.href);
    cssCache.set(parsed.href, css);
    return { ok: true, css };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleCssOp(
  css: unknown,
  sender: chrome.runtime.MessageSender,
  mode: "insert" | "remove",
): Promise<CssOpResult> {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return { ok: false, error: "缺少标签页上下文" };
  if (typeof css !== "string" || css === "") return { ok: false, error: "缺少 CSS 内容" };

  const target = { tabId, frameIds: [sender.frameId ?? 0] };
  try {
    if (mode === "insert") await chrome.scripting.insertCSS({ target, css, origin: "AUTHOR" });
    else await chrome.scripting.removeCSS({ target, css, origin: "AUTHOR" });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function handleReportIssues(
  issues: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<CssOpResult> {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return { ok: false, error: "缺少标签页上下文" };
  const count = Array.isArray(issues) ? issues.length : 0;

  try {
    await chrome.action.setBadgeText({ tabId, text: count > 0 ? "!" : "" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b91c1c" });
    await chrome.action.setTitle({
      tabId,
      title: count > 0 ? `Font Refine：${count} 个警告` : "Font Refine",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: { type?: string; url?: unknown; css?: unknown; issues?: unknown } | undefined,
    sender,
    sendResponse,
  ) => {
    if (sender.id !== chrome.runtime.id) return false;

    switch (message?.type) {
      case "fetchCss":
        void handleFetchCss(message.url).then(sendResponse);
        return true;
      case "insertCss":
        void handleCssOp(message.css, sender, "insert").then(sendResponse);
        return true;
      case "removeCss":
        void handleCssOp(message.css, sender, "remove").then(sendResponse);
        return true;
      case "reportIssues":
        void handleReportIssues(message.issues, sender).then(sendResponse);
        return true;
      default:
        return false;
    }
  },
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  void chrome.action.setBadgeText({ tabId, text: "" });
  void chrome.action.setTitle({ tabId, title: "Font Refine" });
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureSchemaVersion();
  void ensureBuiltinRules();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureBuiltinRules();
});
