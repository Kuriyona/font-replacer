<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Plus, RefreshCw } from "@lucide/vue";
import { probeLocalFont } from "@/content/issues";
import { clearProbeCache, ensureFontCache, refreshFontCache } from "@/shared/fonts";
import { normalizeHostname, validateSiteDraft } from "@/shared/sites";
import { toRegistrableDomain } from "@/shared/site-domains";
import {
  deleteRule,
  deleteSite,
  loadConfig,
  loadFontCache,
  saveRule,
  saveSite,
  siteKey,
  subscribeConfig,
  subscribeFontCache,
} from "@/shared/storage";
import { validateRuleDraft } from "@/shared/rules";
import type { FontCache, Rule, SiteRule } from "@/shared/types";
import RuleEditor from "@/ui/components/RuleEditor.vue";
import SiteEditor from "@/ui/components/SiteEditor.vue";
import SectionCard from "@/ui/components/SectionCard.vue";
import WarningIcon from "@/ui/components/WarningIcon.vue";

type Tab = "rules" | "sites" | "fonts";

const rules = ref<Rule[]>([]);
const sites = ref<SiteRule[]>([]);
const fontCache = ref<FontCache | null>(null);
const tab = ref<Tab>("rules");
const error = ref("");
const notice = ref("");
const loading = ref(true);

const ruleDraft = ref<Rule | null>(null);
const ruleDraftIsNew = ref(false);
const siteDraft = ref<SiteRule | null>(null);
const siteDraftPrevious = ref<SiteRule | null>(null);
const missingByRule = ref<Map<string, string[]>>(new Map());

const newSitePattern = ref("");
const newSiteMatch = ref<"host" | "domain">("host");

let unsubscribeConfig: (() => void) | null = null;
let unsubscribeCache: (() => void) | null = null;

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * 规则/站点是纯 JSON 数据（字符串/数字/布尔/数组）。
 * 经 JSON 往返可剥掉响应式 Proxy：structuredClone 与 chrome.storage 都不接受 Proxy。
 */
const clonePlain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const sortedRules = computed(() =>
  [...rules.value].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
);
const sortedSites = computed(() =>
  [...sites.value].sort(
    (a, b) => a.pattern.localeCompare(b.pattern) || a.match.localeCompare(b.match),
  ),
);

const siteMissing = (site: SiteRule): string[] => {
  const families = new Set<string>();
  for (const id of site.ruleIds) {
    for (const family of missingByRule.value.get(id) ?? []) families.add(family);
  }
  return [...families];
};

const ruleUsage = (id: string): number =>
  sites.value.filter((site) => site.ruleIds.includes(id)).length;

async function recheckMissing(): Promise<void> {
  clearProbeCache();
  const next = new Map<string, string[]>();
  for (const rule of rules.value) {
    const families = [
      ...new Set(rule.fonts.filter((font) => font.source === "system").map((font) => font.family)),
    ];
    const results = await Promise.all(families.map((family) => probeLocalFont(family)));
    next.set(
      rule.id,
      families.filter((_, index) => !results[index]),
    );
  }
  missingByRule.value = next;
}

async function loadAll(): Promise<void> {
  const config = await loadConfig();
  rules.value = config.rules;
  sites.value = config.sites;
  await recheckMissing();
}

function setHash(value: string): void {
  history.replaceState(null, "", value === "" ? location.pathname : `#${value}`);
}

function makeNewRule(): Rule {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: "",
    enabled: true,
    fonts: [],
    cssUrls: [],
    selectors: { mode: "none", list: [] },
    createdAt: now,
    updatedAt: now,
  };
}

function openRule(id: string): void {
  const rule = rules.value.find((item) => item.id === id);
  if (!rule) return;
  ruleDraft.value = clonePlain(rule);
  ruleDraftIsNew.value = false;
  tab.value = "rules";
  setHash(`rule=${encodeURIComponent(id)}`);
}

function startNewRule(): void {
  ruleDraft.value = makeNewRule();
  ruleDraftIsNew.value = true;
  error.value = "";
  tab.value = "rules";
  setHash("new-rule");
}

function closeRule(): void {
  ruleDraft.value = null;
  ruleDraftIsNew.value = false;
  setHash("");
}

function openSite(key: string): void {
  const site = sites.value.find((item) => siteKey(item) === key);
  if (!site) return;
  siteDraft.value = clonePlain(site);
  siteDraftPrevious.value = clonePlain(site);
  tab.value = "sites";
  setHash(`site=${encodeURIComponent(key)}`);
}

function closeSite(): void {
  siteDraft.value = null;
  siteDraftPrevious.value = null;
  setHash("");
}

async function saveRuleDraft(): Promise<void> {
  const draft = ruleDraft.value;
  if (!draft) return;
  const errors = validateRuleDraft(draft);
  if (errors.length > 0) {
    error.value = errors.join("；");
    return;
  }
  const next = clonePlain<Rule>({ ...draft, name: draft.name.trim(), updatedAt: Date.now() });
  try {
    await saveRule(next);
    await loadAll();
    ruleDraft.value = clonePlain(next);
    ruleDraftIsNew.value = false;
    error.value = "";
    notice.value = "规则已保存";
    setHash(`rule=${encodeURIComponent(next.id)}`);
  } catch (err) {
    error.value = messageOf(err);
  }
}

async function removeRule(): Promise<void> {
  const draft = ruleDraft.value;
  if (!draft) return;
  try {
    await deleteRule(draft.id);
    await loadAll();
    closeRule();
    notice.value = "规则已删除";
  } catch (err) {
    error.value = messageOf(err);
  }
}

async function saveSiteDraft(): Promise<void> {
  const draft = siteDraft.value;
  const previous = siteDraftPrevious.value;
  if (!draft) return;
  const pattern = normalizeHostname(draft.pattern);
  if (!pattern) {
    error.value = "请输入有效的主机名或域名";
    return;
  }
  const errors = validateSiteDraft({ pattern, match: draft.match }, toRegistrableDomain);
  if (errors.length > 0) {
    error.value = errors.join("；");
    return;
  }
  const next = clonePlain<SiteRule>({ ...draft, pattern, updatedAt: Date.now() });
  try {
    await saveSite(next, previous ? clonePlain(previous) : undefined);
    await loadAll();
    siteDraft.value = clonePlain(next);
    siteDraftPrevious.value = clonePlain(next);
    error.value = "";
    notice.value = "站点已保存";
    setHash(`site=${encodeURIComponent(siteKey(next))}`);
  } catch (err) {
    error.value = messageOf(err);
  }
}

async function removeSite(): Promise<void> {
  const draft = siteDraft.value;
  if (!draft) return;
  try {
    await deleteSite(draft);
    await loadAll();
    closeSite();
    notice.value = "站点已删除";
  } catch (err) {
    error.value = messageOf(err);
  }
}

async function createSite(): Promise<void> {
  const pattern = normalizeHostname(newSitePattern.value);
  if (!pattern) {
    error.value = "请输入有效的主机名或域名";
    return;
  }
  const errors = validateSiteDraft({ pattern, match: newSiteMatch.value }, toRegistrableDomain);
  if (errors.length > 0) {
    error.value = errors.join("；");
    return;
  }
  const now = Date.now();
  const site: SiteRule = {
    pattern,
    match: newSiteMatch.value,
    ruleIds: [],
    createdAt: now,
    updatedAt: now,
  };
  try {
    await saveSite(site);
    newSitePattern.value = "";
    await loadAll();
    error.value = "";
    openSite(siteKey(site));
  } catch (err) {
    error.value = messageOf(err);
  }
}

async function removeSiteFromList(site: SiteRule): Promise<void> {
  try {
    await deleteSite(site);
    await loadAll();
    if (siteDraft.value && siteKey(siteDraft.value) === siteKey(site)) closeSite();
    notice.value = "站点已删除";
  } catch (err) {
    error.value = messageOf(err);
  }
}

async function refreshFonts(): Promise<void> {
  error.value = "";
  notice.value = "";
  try {
    const hasRichApi = "queryLocalFonts" in window;
    const cache = await refreshFontCache("rich");
    fontCache.value = cache;
    if (cache.source === "font-settings" && hasRichApi) {
      notice.value = "未获得本地字体详细访问权限，已使用基础字体列表";
    } else {
      notice.value = `已读取 ${cache.families.length} 个字体`;
    }
    await recheckMissing();
  } catch (err) {
    error.value = messageOf(err);
  }
}

function readHash(): void {
  const raw = location.hash.slice(1);
  if (raw === "new-rule") {
    startNewRule();
    return;
  }
  if (raw === "sites") {
    tab.value = "sites";
    return;
  }
  if (raw === "fonts") {
    tab.value = "fonts";
    return;
  }
  const params = new URLSearchParams(raw);
  const ruleId = params.get("rule");
  if (ruleId) {
    openRule(ruleId);
    return;
  }
  const siteParam = params.get("site");
  if (siteParam) {
    openSite(siteParam);
    return;
  }
  tab.value = "rules";
}

const formatTime = (value: number): string => new Date(value).toLocaleString("zh-CN");

onMounted(async () => {
  try {
    await loadAll();
    fontCache.value = await ensureFontCache();
  } catch (err) {
    error.value = messageOf(err);
  }
  loading.value = false;
  readHash();
  unsubscribeConfig = subscribeConfig(() => {
    void loadAll();
  });
  unsubscribeCache = subscribeFontCache(() => {
    void (async () => {
      fontCache.value = await loadFontCache();
      await recheckMissing();
    })();
  });
});

onUnmounted(() => {
  unsubscribeConfig?.();
  unsubscribeCache?.();
});
</script>

<template>
  <div class="mx-auto max-w-[1100px] p-6">
    <header class="mb-4 flex items-center justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold">Font Refine</h1>
        <p class="text-xs text-muted">
          按站点替换网页字体：读取本机字体、规则排序、自定义 CSS 与选择器过滤。
        </p>
      </div>
      <nav class="inline-flex rounded-md border border-border bg-surface p-0.5 text-sm">
        <button
          v-for="item in [
            { value: 'rules', label: '规则' },
            { value: 'sites', label: '站点' },
            { value: 'fonts', label: '字体' },
          ] as const"
          :key="item.value"
          type="button"
          class="rounded px-3 py-1"
          :class="tab === item.value ? 'bg-accent text-white' : 'text-muted'"
          @click="tab = item.value"
        >
          {{ item.label }}
        </button>
      </nav>
    </header>

    <p
      v-if="error"
      class="mb-3 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {{ error }}
    </p>
    <p
      v-if="notice"
      class="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted"
    >
      {{ notice }}
    </p>

    <p v-if="loading" class="text-sm text-muted">加载中…</p>

    <div v-else-if="tab === 'rules'" class="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <SectionCard title="规则列表">
        <template #actions>
          <button type="button" class="btn" @click="startNewRule">
            <Plus class="size-3.5" aria-hidden="true" />
            新建规则
          </button>
        </template>
        <ul class="space-y-1">
          <li v-for="rule in sortedRules" :key="rule.id">
            <button
              type="button"
              class="w-full rounded-md border border-transparent px-2 py-1.5 text-left hover:bg-accent-soft"
              :class="{ 'border-border bg-accent-soft': ruleDraft?.id === rule.id }"
              @click="openRule(rule.id)"
            >
              <span class="flex items-center gap-1.5">
                <span class="truncate text-sm">{{ rule.name }}</span>
                <span v-if="!rule.enabled" class="rounded bg-bg px-1 text-[10px] text-muted"
                  >停用</span
                >
                <WarningIcon
                  v-if="(missingByRule.get(rule.id)?.length ?? 0) > 0"
                  :message="`${missingByRule.get(rule.id)?.length} 个字体未安装`"
                />
              </span>
              <span class="mt-0.5 block truncate text-xs text-muted">
                {{ rule.fonts.length }} 字体 ·
                {{
                  rule.selectors.mode === "none"
                    ? "不限制"
                    : `${rule.selectors.mode === "blacklist" ? "黑名单" : "白名单"} ${rule.selectors.list.length}`
                }}
              </span>
            </button>
          </li>
        </ul>
        <p v-if="sortedRules.length === 0" class="text-xs text-muted">还没有规则。</p>
      </SectionCard>

      <div>
        <RuleEditor
          v-if="ruleDraft"
          :key="ruleDraft.id"
          v-model="ruleDraft"
          :font-cache="fontCache"
          :missing="missingByRule.get(ruleDraft.id) ?? []"
          :usage-count="ruleUsage(ruleDraft.id)"
          @save="saveRuleDraft"
          @cancel="closeRule"
          @delete="removeRule"
        />
        <SectionCard v-else>
          <p class="text-sm text-muted">从左侧选择一条规则，或新建规则。</p>
          <p v-if="ruleDraftIsNew" class="hint">新规则在点击保存后才会写入存储。</p>
        </SectionCard>
      </div>
    </div>

    <div v-else-if="tab === 'sites'" class="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <SectionCard title="站点列表">
        <ul class="space-y-1">
          <li v-for="site in sortedSites" :key="siteKey(site)">
            <div class="flex items-start gap-1 rounded-md px-1 py-1 hover:bg-accent-soft">
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="openSite(siteKey(site))"
              >
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm">{{ site.pattern }}</span>
                  <WarningIcon
                    v-if="siteMissing(site).length > 0"
                    :message="`${siteMissing(site).length} 个字体未安装`"
                  />
                </span>
                <span class="mt-0.5 block truncate text-xs text-muted">
                  {{ site.match === "host" ? "主机" : "域名及子域" }} ·
                  {{ site.ruleIds.length }} 条规则
                </span>
              </button>
              <button
                type="button"
                class="btn btn-icon btn-danger"
                aria-label="删除站点"
                @click="removeSiteFromList(site)"
              >
                ✕
              </button>
            </div>
          </li>
        </ul>
        <p v-if="sortedSites.length === 0" class="text-xs text-muted">还没有站点配置。</p>
      </SectionCard>

      <div class="space-y-4">
        <SectionCard title="添加站点">
          <div class="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
            <input
              v-model="newSitePattern"
              class="input"
              placeholder="example.com 或 https://example.com/a"
            />
            <select v-model="newSiteMatch" class="input">
              <option value="host">主机（精确）</option>
              <option value="domain">域名及子域</option>
            </select>
            <button type="button" class="btn btn-primary" @click="createSite">添加</button>
          </div>
          <p class="hint">“域名及子域”需要可注册域名（如 example.com）。</p>
        </SectionCard>

        <SiteEditor
          v-if="siteDraft"
          :key="siteDraftPrevious ? siteKey(siteDraftPrevious) : 'new-site'"
          v-model="siteDraft"
          :rules="rules"
          :missing-by-rule="missingByRule"
          @save="saveSiteDraft"
          @cancel="closeSite"
          @delete="removeSite"
        />
        <SectionCard v-else>
          <p class="text-sm text-muted">从左侧选择一个站点，或在上方添加站点。</p>
        </SectionCard>
      </div>
    </div>

    <div v-else class="space-y-4">
      <SectionCard title="本机字体">
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="btn btn-primary" @click="refreshFonts">
            <RefreshCw class="size-3.5" aria-hidden="true" />
            读取系统字体
          </button>
          <span class="text-sm text-muted">
            {{ fontCache ? `${fontCache.families.length} 个字体` : "尚无字体列表" }}
          </span>
          <span v-if="fontCache" class="text-sm text-muted">
            来源：{{ fontCache.source === "local-fonts" ? "本地字体详细列表" : "系统字体基础列表" }}
            ·
            {{ formatTime(fontCache.updatedAt) }}
          </span>
        </div>
        <ul class="mt-3 grid max-h-80 gap-1 overflow-auto text-sm sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="font in fontCache?.families ?? []"
            :key="font.family"
            class="truncate rounded border border-border px-2 py-1"
            :style="{ fontFamily: `'${font.family}'` }"
            :title="font.family"
          >
            {{ font.family }}
          </li>
        </ul>
      </SectionCard>
      <SectionCard title="说明">
        <ul class="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>字体列表只保存在本机（chrome.storage.local），不会同步或上传。</li>
          <li>读取详细列表可能弹出浏览器权限请求；拒绝后回落到基础字体列表。</li>
          <li>规则里的“本机”字体会用本地字体探测检查是否仍然存在，缺失时显示警告。</li>
        </ul>
      </SectionCard>
    </div>
  </div>
</template>
