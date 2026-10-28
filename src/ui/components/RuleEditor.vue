<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Button,
  Chip,
  FormItem,
  Input,
  Option,
  SegmentedButton,
  SegmentedButtons,
  Select,
  Switch,
} from "@sharpdotnut/dotsharp";
import { resetBuiltinRule } from "@/shared/builtin-rules";
import { SELECTOR_PRESETS, presetSelectors } from "@/shared/selector-presets";
import type { FontCache, Rule, SelectorMode, SelectorPresetId } from "@/shared/types";
import ConfirmDialog from "./ConfirmDialog.vue";
import FontStackEditor from "./FontStackEditor.vue";
import SectionCard from "./SectionCard.vue";
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
  get: () => rule.value.fontWeight ?? 0,
  set: (value: string | number) => {
    const numeric = Number(value);
    rule.value = { ...rule.value, fontWeight: numeric === 0 ? undefined : numeric };
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

const setMode = (value: string | number | (string | number)[] | undefined): void => {
  if (typeof value !== "string") return;
  rule.value = {
    ...rule.value,
    selectors: { ...rule.value.selectors, mode: value as SelectorMode },
  };
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
        <Input v-model="rule.name" label="名称" :maxlength="80" />
        <FormItem description="停用的规则不会应用到任何站点，但仍保留站点里的排序位置。">
          <Switch v-model="enabled" label="启用" />
        </FormItem>
      </div>
    </SectionCard>

    <SectionCard title="字体栈">
      <FontStackEditor
        :fonts="rule.fonts"
        :missing="props.missing"
        :cache="props.fontCache"
        @update="updateFonts"
      />
      <div
        v-if="props.missing.length"
        class="mt-2 flex items-center gap-1.5 text-xs text-ds-error!"
      >
        <WarningIcon :message="`${props.missing.length} 个字体在本机未找到`" />
        本机未找到：{{ props.missing.join("、") }}
      </div>
    </SectionCard>

    <SectionCard title="字重与自定义样式">
      <div class="space-y-4">
        <FormItem description="选中后命中范围内的文字统一使用该字重（标题也会被改变）。">
          <Select label="字重覆盖" :value="weight" @update:value="weight = $event">
            <Option label="不覆盖" :value="0" />
            <Option v-for="value in WEIGHTS" :key="value" :label="String(value)" :value="value" />
          </Select>
        </FormItem>
        <Input
          textarea
          :rows="3"
          label="自定义 CSS 链接（每行一个）"
          description="相对字体地址会按 CSS 文件地址重写。"
          :model-value="cssText"
          placeholder="https://example.com/fonts.css"
          @update:model-value="updateCssUrls(String($event))"
        />
      </div>
    </SectionCard>

    <SectionCard title="选择器过滤">
      <SegmentedButtons :value="rule.selectors.mode" @update:value="setMode">
        <SegmentedButton
          v-for="mode in MODES"
          :key="mode.value"
          :label="mode.label"
          :value="mode.value"
        />
      </SegmentedButtons>

      <div v-if="rule.selectors.mode !== 'none'" class="mt-3">
        <p class="mb-1 text-xs font-medium text-ds-muted">预设（可选）</p>
        <div class="flex flex-wrap gap-1.5">
          <Chip
            label="不使用预设"
            :selected="presetId === null"
            @update:selected="setPreset(null)"
          />
          <Chip
            v-for="preset in SELECTOR_PRESETS"
            :key="preset.id"
            :label="preset.label"
            :selected="presetId === preset.id"
            :title="preset.description"
            @update:selected="(selected) => setPreset(selected ? preset.id : null)"
          />
        </div>
        <template v-if="presetText !== ''">
          <Input
            textarea
            :rows="4"
            readonly
            class="mt-2"
            :label="`预设选择器（只读，${presetText.split('\n').length} 条）`"
            description="预设会与下面的自定义选择器合并后一起生效。"
            :model-value="presetText"
          />
        </template>
      </div>

      <div class="mt-3">
        <Input
          textarea
          :rows="4"
          label="自定义选择器（每行一个）"
          description="黑名单：排除匹配元素及其子树；白名单：只作用于匹配元素及其子树。选择器只在元素所在 DOM 树内匹配（Shadow DOM 不跨边界）。"
          :disabled="rule.selectors.mode === 'none'"
          :model-value="selectorText"
          placeholder="article .content"
          @update:model-value="updateSelectorList(String($event))"
        />
      </div>
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
          <Button variant="text" size="sm" class="text-ds-error!">删除</Button>
        </template>
      </ConfirmDialog>
      <Button
        v-else
        variant="text"
        size="sm"
        class="text-ds-error!"
        disabled
        title="内置规则不可删除；字体栈可以改，缺失时会自动重新生成"
      >
        删除
      </Button>
      <Button
        v-if="builtin"
        variant="text"
        size="sm"
        class="mr-auto"
        :disabled="!canReset"
        title="恢复内置的字体栈与选择器过滤（保存后生效）"
        @click="resetToBuiltin"
      >
        重置为默认
      </Button>
      <Button variant="text" size="sm" @click="emit('cancel')">取消</Button>
      <Button size="sm" @click="emit('save')">保存</Button>
    </div>
  </div>
</template>
