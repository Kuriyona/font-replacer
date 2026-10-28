<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "@lucide/vue";
import { missingFontIssues, probeLocalFont } from "@/content/issues";
import { resolveSiteRules } from "@/shared/rules";
import { findEffectiveSite } from "@/shared/sites";
import { toRegistrableDomain } from "@/shared/site-domains";
import { loadConfig, saveSite, subscribeConfig } from "@/shared/storage";
import type { PageIssue, Rule, SiteRule } from "@/shared/types";
import ConfirmDialog from "@/ui/components/ConfirmDialog.vue";
import IssueBanner from "@/ui/components/IssueBanner.vue";

const rules = ref<Rule[]>([]);
const sites = ref<SiteRule[]>([]);
const hostname = ref("");
const tabId = ref<number | null>(null);
const supported = ref(false);
const error = ref("");
const loading = ref(true);
const issues = ref<PageIssue[]>([]);
const adding = ref(false);

let unsubscribe: (() => void) | null = null;

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const site = computed<SiteRule | null>(() =>
  supported.value ? findEffectiveSite(hostname.value, sites.value) : null,
);
const byId = computed(() => new Map(rules.value.map((rule) => [rule.id, rule])));
type AssignedEntry = { id: string; index: number; rule: Rule };
/** 保留 ruleIds 中的原始下标，用于上/下移与移除 */
const assignedEntries = computed<AssignedEntry[]>(() => {
  const current = site.value;
  if (!current) return [];
  const entries: AssignedEntry[] = [];
  current.ruleIds.forEach((id, index) => {
    const rule = byId.value.get(id);
    if (rule) entries.push({ id, index, rule });
  });
  return entries;
});
const activeRules = computed(() => (site.value ? resolveSiteRules(site.value, rules.value) : []));
const availableRules = computed(() =>
  rules.value.filter((rule) => rule.enabled && !(site.value?.ruleIds.includes(rule.id) ?? false)),
);
const hostSite = computed(() =>
  sites.value.find((item) => item.match === "host" && item.pattern === hostname.value),
);
const registrableDomain = computed(() => toRegistrableDomain(hostname.value));
const domainOverridesHost = computed(
  () => site.value?.match === "domain" && hostname.value !== site.value.pattern,
);

const openOptions = (hash?: string): void => {
  const url = chrome.runtime.getURL(`options.html${hash ? `#${hash}` : ""}`);
  void chrome.tabs.create({ url });
};

const issueHash = (issue: PageIssue): string | undefined => {
  if (issue.kind === "css-inject-failed") return undefined;
  return `rule=${encodeURIComponent(issue.ruleId)}`;
};

async function fetchContentIssues(): Promise<PageIssue[]> {
  if (tabId.value === null) return [];
  try {
    const response = (await chrome.tabs.sendMessage(
      tabId.value,
      { type: "getPageIssues" },
      { frameId: 0 },
    )) as { issues?: PageIssue[] } | undefined;
    return response?.issues ?? [];
  } catch {
    return [];
  }
}

async function refreshIssues(): Promise<void> {
  const contentIssues = await fetchContentIssues();
  const fontIssues = await missingFontIssues(activeRules.value, probeLocalFont);
  const seen = new Set<string>();
  issues.value = [...fontIssues, ...contentIssues].filter((issue) => {
    const key =
      issue.kind === "font-missing"
        ? `font|${issue.ruleId}|${issue.family.toLowerCase()}`
        : issue.kind === "css-failed"
          ? `css|${issue.ruleId}|${issue.url}`
          : `inject|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function reload(): Promise<void> {
  const config = await loadConfig();
  rules.value = config.rules;
  sites.value = config.sites;
  await refreshIssues();
}

async function persistSite(next: SiteRule): Promise<void> {
  const previous = site.value;
  try {
    await saveSite({ ...next, updatedAt: Date.now() }, previous ?? undefined);
    error.value = "";
    await reload();
  } catch (err) {
    error.value = messageOf(err);
  }
}

async function createSite(match: "host" | "domain"): Promise<void> {
  const pattern = match === "host" ? hostname.value : registrableDomain.value;
  if (!pattern) return;
  const now = Date.now();
  try {
    await saveSite({ pattern, match, ruleIds: [], createdAt: now, updatedAt: now });
    await reload();
  } catch (err) {
    error.value = messageOf(err);
  }
}

async function splitHostFromDomain(): Promise<void> {
  const current = site.value;
  if (!current || current.match !== "domain") return;
  const now = Date.now();
  try {
    await saveSite({
      pattern: hostname.value,
      match: "host",
      ruleIds: [...current.ruleIds],
      createdAt: now,
      updatedAt: now,
    });
    await reload();
  } catch (err) {
    error.value = messageOf(err);
  }
}

function moveRule(index: number, delta: number): void {
  const current = site.value;
  if (!current) return;
  const target = index + delta;
  if (target < 0 || target >= current.ruleIds.length) return;
  const ruleIds = [...current.ruleIds];
  const [item] = ruleIds.splice(index, 1);
  if (!item) return;
  ruleIds.splice(target, 0, item);
  void persistSite({ ...current, ruleIds });
}

function removeRule(index: number): void {
  const current = site.value;
  if (!current) return;
  void persistSite({
    ...current,
    ruleIds: current.ruleIds.filter((_, position) => position !== index),
  });
}

function addRule(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const id = select.value;
  select.value = "";
  adding.value = false;
  const current = site.value;
  if (!current || id === "") return;
  void persistSite({ ...current, ruleIds: [...current.ruleIds, id] });
}

const summary = (rule: Rule): string => {
  const families = rule.fonts.map((font) => font.family);
  const fontText =
    families.length > 2 ? `${families.slice(0, 2).join(" → ")} → …` : families.join(" → ");
  return fontText || "未配置字体";
};

const disabledLabel = (rule: Rule): string => (rule.enabled ? "" : "已停用");

onMounted(async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const current = tabs[0];
    tabId.value = current?.id ?? null;
    if (current?.url) {
      const url = new URL(current.url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        hostname.value = url.hostname;
        supported.value = true;
      }
    }
    await reload();
  } catch (err) {
    error.value = messageOf(err);
  }
  loading.value = false;
  unsubscribe = subscribeConfig(() => {
    void reload();
  });
});

onUnmounted(() => {
  unsubscribe?.();
});
</script>

<template>
  <div class="w-[380px] p-3 text-sm">
    <header class="mb-2 flex items-center justify-between gap-2">
      <h1 class="text-sm font-semibold">Font Refine</h1>
      <span class="truncate text-xs text-muted">{{ hostname }}</span>
    </header>

    <p
      v-if="error"
      class="mb-2 rounded border border-danger bg-danger-soft px-2 py-1 text-xs text-danger"
    >
      {{ error }}
    </p>

    <p v-if="loading" class="text-xs text-muted">加载中…</p>

    <div v-else-if="!supported" class="space-y-2">
      <p class="text-xs text-muted">此页面不支持字体替换（仅支持 http/https 页面）。</p>
      <button type="button" class="btn" @click="openOptions()">
        <ExternalLink class="size-3.5" aria-hidden="true" />
        管理规则与站点
      </button>
    </div>

    <div v-else class="space-y-3">
      <IssueBanner :issues="issues" @select="(issue) => openOptions(issueHash(issue))" />

      <div v-if="site" class="space-y-2">
        <p class="text-xs text-muted">
          作用范围：{{ site.pattern }}（{{ site.match === "host" ? "主机" : "域名及子域" }}）
        </p>

        <ol v-if="assignedEntries.length" class="space-y-1">
          <li
            v-for="entry in assignedEntries"
            :key="entry.id"
            class="flex items-center gap-1.5 rounded border border-border px-2 py-1.5"
          >
            <span class="w-4 text-center text-xs text-muted">{{ entry.index + 1 }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate">{{ entry.rule.name }}</p>
              <p class="truncate text-xs text-muted">
                {{ disabledLabel(entry.rule) }}{{ disabledLabel(entry.rule) ? " · " : ""
                }}{{ summary(entry.rule) }}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-icon"
              aria-label="上移"
              :disabled="entry.index === 0"
              @click="moveRule(entry.index, -1)"
            >
              <ArrowUp class="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="btn btn-icon"
              aria-label="下移"
              :disabled="entry.index === site.ruleIds.length - 1"
              @click="moveRule(entry.index, 1)"
            >
              <ArrowDown class="size-3.5" aria-hidden="true" />
            </button>
            <ConfirmDialog
              title="移除规则"
              description="只解除该站点对这条规则的应用，规则本身仍然保留。"
              confirm-label="移除"
              @confirm="removeRule(entry.index)"
            >
              <template #trigger>
                <button type="button" class="btn btn-icon btn-danger" aria-label="移除">
                  <Trash2 class="size-3.5" aria-hidden="true" />
                </button>
              </template>
            </ConfirmDialog>
          </li>
        </ol>
        <p v-else class="text-xs text-muted">该站点暂不应用任何规则。</p>

        <div v-if="adding">
          <select class="input" :disabled="availableRules.length === 0" @change="addRule">
            <option value="">{{ availableRules.length ? "选择规则…" : "没有可添加的规则" }}</option>
            <option v-for="rule in availableRules" :key="rule.id" :value="rule.id">
              {{ rule.name }}
            </option>
          </select>
        </div>
        <div v-else class="flex flex-wrap gap-1.5">
          <button type="button" class="btn" @click="adding = true">
            <Plus class="size-3.5" aria-hidden="true" />
            添加规则
          </button>
          <button
            v-if="domainOverridesHost && !hostSite"
            type="button"
            class="btn"
            @click="splitHostFromDomain()"
          >
            为当前主机单独配置
          </button>
        </div>
        <p v-if="rules.length === 0" class="text-xs text-muted">
          还没有规则 ·
          <button type="button" class="underline" @click="openOptions('new-rule')">新建规则</button>
        </p>
      </div>

      <div v-else class="space-y-1.5">
        <p class="text-xs text-muted">该站点还没有配置。选择一个作用范围开始：</p>
        <button type="button" class="btn w-full justify-start" @click="createSite('host')">
          仅此主机：{{ hostname }}
        </button>
        <button
          v-if="registrableDomain"
          type="button"
          class="btn w-full justify-start"
          @click="createSite('domain')"
        >
          域名及子域：{{ registrableDomain }}
        </button>
        <p v-if="rules.length === 0" class="text-xs text-muted">
          还没有规则 ·
          <button type="button" class="underline" @click="openOptions('new-rule')">新建规则</button>
        </p>
      </div>

      <button type="button" class="btn w-full justify-center" @click="openOptions()">
        <ExternalLink class="size-3.5" aria-hidden="true" />
        管理规则与站点
      </button>
    </div>
  </div>
</template>
