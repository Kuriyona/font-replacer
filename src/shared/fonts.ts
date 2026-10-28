import { loadFontCache, saveFontCache } from "./storage";
import type { FontCache, FontFamilyInfo } from "./types";

export { clearProbeCache } from "../content/issues";

type LocalFontData = { family: string; style: string };
type QueryLocalFonts = () => Promise<LocalFontData[]>;

const getQueryLocalFonts = (): QueryLocalFonts | null => {
  if (!("queryLocalFonts" in window)) return null;
  const candidate = window.queryLocalFonts;
  // Chrome 的本地字体 API 未进入 lib.dom 类型，函数形状已知
  return typeof candidate === "function" ? (candidate as QueryLocalFonts) : null;
};

const sortByFamily = (a: FontFamilyInfo, b: FontFamilyInfo): number =>
  a.family.localeCompare(b.family);

async function fromLocalFonts(): Promise<FontCache> {
  const queryLocalFonts = getQueryLocalFonts();
  if (!queryLocalFonts) throw new Error("当前浏览器不支持读取本地字体详细信息");
  const fonts = await queryLocalFonts();
  const grouped = new Map<string, { family: string; styles: Set<string> }>();
  for (const font of fonts) {
    const family = font.family.trim();
    if (family === "") continue;
    let entry = grouped.get(family);
    if (!entry) {
      entry = { family, styles: new Set() };
      grouped.set(family, entry);
    }
    if (typeof font.style === "string") entry.styles.add(font.style);
  }
  const families = [...grouped.values()]
    .map((entry) => ({ family: entry.family, styles: [...entry.styles] }))
    .sort(sortByFamily);
  return { families, source: "local-fonts", updatedAt: Date.now() };
}

async function fromFontSettings(): Promise<FontCache> {
  const list = await chrome.fontSettings.getFontList();
  const names = new Set<string>();
  for (const font of list) {
    const family = font.displayName?.trim();
    if (family) names.add(family);
  }
  const families = [...names].map((family) => ({ family, styles: [] })).sort(sortByFamily);
  return { families, source: "font-settings", updatedAt: Date.now() };
}

/**
 * 重新枚举本机字体并写入 local 缓存。rich 失败时回落到基础列表。
 */
export async function refreshFontCache(mode: "rich" | "basic"): Promise<FontCache> {
  let cache: FontCache;
  if (mode === "rich") {
    try {
      cache = await fromLocalFonts();
    } catch {
      cache = await fromFontSettings();
    }
  } else {
    cache = await fromFontSettings();
  }
  await saveFontCache(cache);
  return cache;
}

/** 读取缓存；缺失时用基础列表建立（不触发权限弹窗） */
export async function ensureFontCache(): Promise<FontCache> {
  const cached = await loadFontCache();
  if (cached) return cached;
  return refreshFontCache("basic");
}

export function fontIsSystem(family: string, cache: FontCache | null): boolean {
  if (!cache) return false;
  const target = family.trim().toLowerCase();
  return cache.families.some((item) => item.family.toLowerCase() === target);
}
