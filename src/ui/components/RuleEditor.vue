<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { FontCache, Rule, SelectorMode } from "@/shared/types";
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
}>();
const emit = defineEmits<{ save: []; cancel: []; delete: [] }>();

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const MODES: Array<{ value: SelectorMode; label: string }> = [
  { value: "none", label: "不限制" },
  { value: "blacklist", label: "黑名单" },
  { value: "whitelist", label: "白名单" },
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

const updateFonts = (fonts: Rule["fonts"]): void => {
  rule.value = { ...rule.value, fonts };
};

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
      <div class="mb-2 inline-flex rounded-md border border-border p-0.5">
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
      <label class="label" for="rule-selectors">选择器（每行一个）</label>
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
        title="删除规则"
        :description="usageText"
        confirm-label="删除规则"
        @confirm="emit('delete')"
      >
        <template #trigger>
          <button type="button" class="btn btn-danger">删除</button>
        </template>
      </ConfirmDialog>
      <button type="button" class="btn" @click="emit('cancel')">取消</button>
      <button type="button" class="btn btn-primary" @click="emit('save')">保存</button>
    </div>
  </div>
</template>
