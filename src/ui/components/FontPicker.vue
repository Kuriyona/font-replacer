<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button, Dialog, Input } from "@sharpdotnut/dotsharp";
import type { FontCache, RuleFont } from "@/shared/types";

const props = defineProps<{ cache: FontCache | null }>();
const emit = defineEmits<{ select: [font: RuleFont]; cancel: [] }>();

const MAX_RENDER = 200;
const MAX_SUMMARY_STYLES = 3;

const open = defineModel<boolean>("open", { required: true });
const search = ref("");

watch(open, (value) => {
  if (value) search.value = "";
});

const summarizeStyles = (styles: string[]): string => {
  if (styles.length <= MAX_SUMMARY_STYLES) return styles.join(" / ");
  const shown = styles.slice(0, MAX_SUMMARY_STYLES).join(" / ");
  return `${shown} +${styles.length - MAX_SUMMARY_STYLES}`;
};

const matches = computed(() => {
  const query = search.value.trim().toLowerCase();
  const families = props.cache?.families ?? [];
  if (query === "") return families;
  return families.filter(
    (item) =>
      item.family.toLowerCase().includes(query) ||
      item.styles.some((style) => style.toLowerCase().includes(query)),
  );
});

const visible = computed(() => matches.value.slice(0, MAX_RENDER));
const truncated = computed(() => matches.value.length > MAX_RENDER);
const customName = computed(() => search.value.trim());
const exactFamily = computed(() => {
  const query = customName.value.toLowerCase();
  if (query === "") return null;
  const hit = props.cache?.families.find((item) => item.family.toLowerCase() === query);
  return hit?.family ?? null;
});

const pick = (family: string): void => {
  if (family === "") return;
  open.value = false;
  emit("select", { family, source: "system" });
};

const pickCustom = (): void => {
  const family = exactFamily.value ?? customName.value;
  if (family === "") return;
  open.value = false;
  emit("select", { family, source: exactFamily.value ? "system" : "custom" });
};

const cancel = (): void => {
  open.value = false;
  emit("cancel");
};

const actionLabel = computed(() => {
  if (exactFamily.value) return `添加 ${exactFamily.value}`;
  if (customName.value) return `使用自定义：${customName.value}`;
  return "选择字体";
});
</script>

<template>
  <Dialog v-model:open="open" title="选择字体">
    <Input v-model="search" placeholder="搜索字体，或直接输入字体名" clearable autofocus />
    <ul class="mt-3 max-h-72 overflow-auto rounded-ds-sm border border-ds-line">
      <li v-for="item in visible" :key="item.family">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-ds-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ds-focus"
          @click="pick(item.family)"
        >
          <span class="min-w-0 truncate text-ds-fg" :style="{ fontFamily: `'${item.family}'` }">
            {{ item.family }}
          </span>
          <span
            v-if="item.styles.length"
            class="max-w-[60%] shrink-0 truncate text-right text-xs text-ds-muted"
            :title="item.styles.join(' / ')"
          >
            {{ summarizeStyles(item.styles) }}
          </span>
        </button>
      </li>
    </ul>
    <p v-if="visible.length === 0" class="text-xs text-ds-muted">没有匹配的本机字体</p>
    <p v-if="truncated" class="mt-2 text-xs text-ds-muted">
      结果较多，只显示前 {{ MAX_RENDER }} 项，请继续输入以缩小范围。
    </p>

    <template #footer-left>
      <Button variant="text" size="sm" @click="cancel">取消</Button>
    </template>
    <template #footer-right>
      <Button size="sm" :disabled="customName === ''" @click="pickCustom">
        {{ actionLabel }}
      </Button>
    </template>
  </Dialog>
</template>
