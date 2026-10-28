import type { FontCache, Rule, SiteRule } from "./types";
import { normalizeRule } from "./rules";
import { normalizeSite } from "./sites";

export const RULE_PREFIX = "rule:";
export const SITE_PREFIX = "site:";
export const SCHEMA_VERSION_KEY = "schemaVersion";
export const FONT_CACHE_KEY = "fontCache";
const SCHEMA_VERSION = 1;
/** chrome.storage.sync 单键上限 8192 字节 */
const ITEM_QUOTA_BYTES = 8192;

export const siteKey = (site: SiteRule): string => `${SITE_PREFIX}${site.match}:${site.pattern}`;

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function writeSync(values: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (JSON.stringify(value).length > ITEM_QUOTA_BYTES) {
      throw new Error(`规则过大，超出单条 8KB 同步上限（${key}）`);
    }
  }
  try {
    await chrome.storage.sync.set(values);
  } catch (err) {
    throw new Error(`保存到浏览器同步存储失败：${messageOf(err)}`);
  }
}

async function writeLocal(values: Record<string, unknown>): Promise<void> {
  try {
    await chrome.storage.local.set(values);
  } catch (err) {
    throw new Error(`保存到本机存储失败：${messageOf(err)}`);
  }
}

export async function loadConfig(): Promise<{ rules: Rule[]; sites: SiteRule[] }> {
  let all: Record<string, unknown>;
  try {
    all = await chrome.storage.sync.get(null);
  } catch (err) {
    throw new Error(`读取配置失败：${messageOf(err)}`);
  }

  const rules: Rule[] = [];
  const sites: SiteRule[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(RULE_PREFIX)) {
      const rule = normalizeRule(value);
      if (rule) rules.push(rule);
    } else if (key.startsWith(SITE_PREFIX)) {
      const site = normalizeSite(value);
      if (site) sites.push(site);
    }
  }
  rules.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  sites.sort((a, b) => a.createdAt - b.createdAt || siteKey(a).localeCompare(siteKey(b)));
  return { rules, sites };
}

export async function saveRule(rule: Rule): Promise<void> {
  if (JSON.stringify(rule).length > ITEM_QUOTA_BYTES) {
    throw new Error("规则过大，超出单条 8KB 同步上限");
  }
  await writeSync({ [RULE_PREFIX + rule.id]: rule });
}

/** 删除规则，并把引用它的站点条目里的引用一并去掉 */
export async function deleteRule(id: string): Promise<void> {
  const { sites } = await loadConfig();
  const updates: Record<string, SiteRule> = {};

  for (const site of sites) {
    if (!site.ruleIds.includes(id)) continue;
    updates[siteKey(site)] = {
      ...site,
      ruleIds: site.ruleIds.filter((item) => item !== id),
      updatedAt: Date.now(),
    };
  }

  try {
    await chrome.storage.sync.remove(RULE_PREFIX + id);
  } catch (err) {
    throw new Error(`删除规则失败：${messageOf(err)}`);
  }
  if (Object.keys(updates).length > 0) await writeSync(updates);
}

/**
 * 写入站点条目。键发生变化（pattern/match 改了）时清除旧键；新键已存在则报错。
 */
export async function saveSite(site: SiteRule, previous?: SiteRule): Promise<void> {
  const nextKey = siteKey(site);
  const previousKey = previous ? siteKey(previous) : null;

  if (previousKey !== nextKey) {
    const existing = await chrome.storage.sync.get(nextKey);
    if (existing[nextKey] !== undefined) throw new Error("该作用范围已存在");
  }

  await writeSync({ [nextKey]: site });
  if (previousKey && previousKey !== nextKey) {
    try {
      await chrome.storage.sync.remove(previousKey);
    } catch (err) {
      throw new Error(`清理旧站点条目失败：${messageOf(err)}`);
    }
  }
}

export async function deleteSite(site: SiteRule): Promise<void> {
  try {
    await chrome.storage.sync.remove(siteKey(site));
  } catch (err) {
    throw new Error(`删除站点失败：${messageOf(err)}`);
  }
}

export async function loadFontCache(): Promise<FontCache | null> {
  const stored = await chrome.storage.local.get(FONT_CACHE_KEY);
  const raw = stored[FONT_CACHE_KEY] as FontCache | undefined;
  if (!raw || !Array.isArray(raw.families)) return null;
  return raw;
}

export async function saveFontCache(cache: FontCache): Promise<void> {
  await writeLocal({ [FONT_CACHE_KEY]: cache });
}

/** 配置发生变化时回调；返回取消订阅函数 */
export function subscribeConfig(callback: () => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== "sync") return;
    const relevant = Object.keys(changes).some(
      (key) =>
        key.startsWith(RULE_PREFIX) || key.startsWith(SITE_PREFIX) || key === SCHEMA_VERSION_KEY,
    );
    if (relevant) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function subscribeFontCache(callback: () => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName === "local" && FONT_CACHE_KEY in changes) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function ensureSchemaVersion(): Promise<void> {
  const stored = await chrome.storage.sync.get(SCHEMA_VERSION_KEY);
  if (stored[SCHEMA_VERSION_KEY] === undefined) {
    await writeSync({ [SCHEMA_VERSION_KEY]: SCHEMA_VERSION });
  }
}
