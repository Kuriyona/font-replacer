<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { resetBuiltinRule } from "@/shared/builtin-rules";
import { SELECTOR_PRESETS, presetSelectors } from "@/shared/selector-presets";
import type { FontCache, Rule, SelectorMode, SelectorPresetId } from "@/shared/types";
import ConfirmDialog from "./ConfirmDialog.vue";
import FontStackEditor from "./FontStackEditor.vue";
import SectionCard from "./SectionCard.vue";
import ToggleSwitch from "./ToggleSwitch.vue";
import WarningIcon from "./WarningIcon.vue";

const rule = defineModel<Rule>({ required: true });
const props = defineProps<{
  fontCache: FontCache | null;
  missing: string[];
  usageCount: number;
  builtin: boolean;
}>();
const emit = defineEmits<{ save: []; cancel: []; delete: []; reset: [] }>();

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const MODES: Array<{ value: SelectorMode; label: string }> = [
  { value: "blacklist", label: "黑名单（推荐）" },
  { value: "whitelist", label: "白名单" },
  { value: "none", label: "不限制" },
];

const cssText = ref(rule.value.cssUrls.join("\n"));
const selectorText = ref(rule.value.selectors.list.join("\n"));

watch(
  () => rule.value.id,
  () => {
    cssText.value = rule.value.cssUrls.join("\n");
    selectorText.value = rule.value.selectors.list.join("\n");
  },
);

const enabled = computed({
  get: () => rule.value.enabled,
  set: (value: boolean) => {
    rule.value = { ...rule.value, enabled: value };
  },
});

const weight = computed({
  get: () => (rule.value.fontWeight === undefined ? "" : String(rule.value.fontWeight)),
  set: (value: string) => {
    rule.value = { ...rule.value, fontWeight: value === "" ? undefined : Number(value) };
  },
});

const updateCssUrls = (text: string): void => {
  cssText.value = text;
  rule.value = {
    ...rule.value,
    cssUrls: text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
};

const updateSelectorList = (text: string): void => {
  selectorText.value = text;
  rule.value = {
    ...rule.value,
    selectors: {
      ...rule.value.selectors,
      list: text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    },
  };
};

const setMode = (mode: SelectorMode): void => {
  rule.value = { ...rule.value, selectors: { ...rule.value.selectors, mode } };
};

/** 挂上 / 摘掉预设；预设选择器与自定义选择器合并生效 */
const setPreset = (id: SelectorPresetId | null): void => {
  const selectors = { ...rule.value.selectors };
  if (id) selectors.preset = id;
  else delete selectors.preset;
  rule.value = { ...rule.value, selectors };
};

const presetId = computed<SelectorPresetId | null>(() => rule.value.selectors.preset ?? null);
const presetText = computed(() => presetSelectors(presetId.value ?? undefined).join("\n"));

const updateFonts = (fonts: Rule["fonts"]): void => {
  rule.value = { ...rule.value, fonts };
};

/** 恢复内置默认值（仅改草稿，保存后生效） */
const resetToBuiltin = (): void => {
  const seed = resetBuiltinRule(rule.value);
  if (!seed) return;
  rule.value = seed;
  cssText.value = seed.cssUrls.join("\n");
  selectorText.value = seed.selectors.list.join("\n");
  emit("reset");
};

/** 与出厂值逐项比对（不比较时间戳，也不依赖对象键顺序） */
const snapshotRule = (value: Rule): string =>
  JSON.stringify([
    value.name,
    value.enabled,
    value.fonts.map((font) => [font.family, font.source]),
    value.fontWeight ?? null,
    value.cssUrls,
    value.selectors.mode,
    value.selectors.list,
    value.selectors.preset ?? null,
  ]);

const canReset = computed(() => {
  if (!props.builtin) return false;
  const seed = resetBuiltinRule(rule.value);
  return seed !== null && snapshotRule(rule.value) !== snapshotRule(seed);
});

const usageText = computed(() =>
  props.usageCount > 0
    ? `该规则正被 ${props.usageCount} 个站点使用，删除后会从这些站点移除。`
    : "删除后无法恢复。",
);
</script>

<template>
  <div class="space-y-4">
    <SectionCard title="基本信息">
      <div class="space-y-3">
        <div>
          <label class="label" for="rule-name">名称</label>
          <input id="rule-name" v-model="rule.name" class="input" maxlength="80" />
        </div>
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm">启用</p>
            <p class="hint">停用的规则不会应用到任何站点，但仍保留站点里的排序位置。</p>
          </div>
          <ToggleSwitch v-model="enabled" />
        </div>
      </div>
    </SectionCard>

    <SectionCard title="字体栈">
      <FontStackEditor
        :fonts="rule.fonts"
        :missing="props.missing"
        :cache="props.fontCache"
        @update="updateFonts"
      />
      <div v-if="props.missing.length" class="mt-2 flex items-center gap-1.5 text-xs text-danger">
        <WarningIcon :message="`${props.missing.length} 个字体在本机未找到`" />
        本机未找到：{{ props.missing.join("、") }}
      </div>
    </SectionCard>

    <SectionCard title="字重与自定义样式">
      <div class="space-y-4">
        <div>
          <label class="label" for="rule-weight">字重覆盖</label>
          <select id="rule-weight" v-model="weight" class="input">
            <option value="">不覆盖</option>
            <option v-for="value in WEIGHTS" :key="value" :value="String(value)">
              {{ value }}
            </option>
          </select>
          <p class="hint">选中后命中范围内的文字统一使用该字重（标题也会被改变）。</p>
        </div>
        <div>
          <label class="label" for="rule-css">自定义 CSS 链接（每行一个）</label>
          <textarea
            id="rule-css"
            class="input font-mono"
            rows="3"
            :value="cssText"
            placeholder="https://example.com/fonts.css"
            @input="updateCssUrls(($event.target as HTMLTextAreaElement).value)"
          />
          <p class="hint">相对字体地址会按 CSS 文件地址重写。</p>
        </div>
      </div>
    </SectionCard>

    <SectionCard title="选择器过滤">
      <div class="mb-3 inline-flex rounded-md border border-border p-0.5">
        <button
          v-for="mode in MODES"
          :key="mode.value"
          type="button"
          class="rounded px-2 py-1 text-xs"
          :class="rule.selectors.mode === mode.value ? 'bg-accent text-white' : 'text-muted'"
          :aria-pressed="rule.selectors.mode === mode.value"
          @click="setMode(mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>

      <div v-if="rule.selectors.mode !== 'none'" class="mb-3">
        <span class="label">预设（可选）</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="rounded border px-2 py-1 text-xs"
            :class="presetId === null ? 'border-accent text-fg' : 'border-border text-muted'"
            :aria-pressed="presetId === null"
            @click="setPreset(null)"
          >
            不使用预设
          </button>
          <button
            v-for="preset in SELECTOR_PRESETS"
            :key="preset.id"
            type="button"
            class="rounded border px-2 py-1 text-xs"
            :class="presetId === preset.id ? 'border-accent text-fg' : 'border-border text-muted'"
            :aria-pressed="presetId === preset.id"
            :title="preset.description"
            @click="setPreset(preset.id)"
          >
            {{ preset.label }}
          </button>
        </div>
        <template v-if="presetText !== ''">
          <label class="label mt-2" for="rule-preset"
            >预设选择器（只读，{{ presetText.split("\n").length }} 条）</label
          >
          <textarea
            id="rule-preset"
            class="input font-mono"
            rows="4"
            readonly
            :value="presetText"
          />
          <p class="hint">预设会与下面的自定义选择器合并后一起生效。</p>
        </template>
      </div>

      <label class="label" for="rule-selectors">自定义选择器（每行一个）</label>
      <textarea
        id="rule-selectors"
        class="input font-mono"
        rows="4"
        :value="selectorText"
        :disabled="rule.selectors.mode === 'none'"
        placeholder="article .content"
        @input="updateSelectorList(($event.target as HTMLTextAreaElement).value)"
      />
      <p class="hint">
        黑名单：排除匹配元素及其子树；白名单：只作用于匹配元素及其子树。选择器只在元素所在 DOM
        树内匹配（Shadow DOM 不跨边界）。
      </p>
    </SectionCard>

    <div class="flex items-center justify-end gap-2">
      <ConfirmDialog
        v-if="!builtin"
        title="删除规则"
        :description="usageText"
        confirm-label="删除规则"
        @confirm="emit('delete')"
      >
        <template #trigger>
          <button type="button" class="btn btn-danger">删除</button>
        </template>
      </ConfirmDialog>
      <button
        v-else
        type="button"
        class="btn btn-danger"
        disabled
        title="内置规则不可删除；字体栈可以改，缺失时会自动重新生成"
      >
        删除
      </button>
      <button
        v-if="builtin"
        type="button"
        class="btn mr-auto"
        :disabled="!canReset"
        title="恢复内置的字体栈与选择器过滤（保存后生效）"
        @click="resetToBuiltin"
      >
        重置为默认
      </button>
      <button type="button" class="btn" @click="emit('cancel')">取消</button>
      <button type="button" class="btn btn-primary" @click="emit('save')">保存</button>
    </div>
  </div>
</template>
