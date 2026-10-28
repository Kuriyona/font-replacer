import { parse } from "postcss";
import valueParser, { type Node } from "postcss-value-parser";

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const skipTarget = (raw: string): boolean => {
  const value = raw.trim();
  if (value === "") return true;
  if (value.startsWith("#")) return true;
  if (/^(data|blob|javascript):/i.test(value)) return true;
  return HAS_SCHEME.test(value);
};

/** 重写一段值里所有 url()，相对地址按 baseUrl 绝对化 */
function rewriteValue(value: string, baseUrl: string): string {
  if (value === "") return value;
  const parsed = valueParser(value);
  parsed.walk((node: Node) => {
    if (node.type !== "function" || node.value.toLowerCase() !== "url") return undefined;
    const first = node.nodes[0];
    if (!first) return undefined;
    const raw = first.type === "string" || first.type === "word" ? first.value : "";
    if (raw === "" || skipTarget(raw)) return false;

    let resolved: URL;
    try {
      resolved = new URL(raw.trim(), baseUrl);
    } catch {
      return false;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return false;

    if (first.type === "string") {
      first.value = resolved.href;
    } else if (/[\s()'"\\]/.test(resolved.href)) {
      node.nodes = [
        {
          type: "string",
          quote: '"',
          value: resolved.href,
          sourceIndex: first.sourceIndex,
          sourceEndIndex: first.sourceIndex + raw.length,
        },
      ];
    } else {
      first.value = resolved.href;
    }
    return false;
  });
  return parsed.toString();
}

/**
 * 把 CSS 中的相对 url() 与 @import 目标按 baseUrl 绝对化。
 * 解析失败直接抛出，避免把未处理的 CSS 注入页面。
 */
export function absolutizeCssUrls(cssText: string, baseUrl: string): string {
  const root = parse(cssText, { from: undefined });
  root.walk((node) => {
    if (node.type === "decl") node.value = rewriteValue(node.value, baseUrl);
    else if (node.type === "atrule" && node.name.toLowerCase() === "import") {
      node.params = rewriteValue(node.params, baseUrl);
    }
  });
  return root.toString();
}
