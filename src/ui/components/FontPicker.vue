<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxViewport,
} from "reka-ui";
import type { FontCache, RuleFont } from "@/shared/types";

const props = defineProps<{ cache: FontCache | null }>();
const emit = defineEmits<{ select: [font: RuleFont]; cancel: [] }>();

const MAX_RENDER = 200;
const open = ref(true);
const search = ref("");

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

const pick = (value: unknown): void => {
  if (typeof value !== "string" || value === "") return;
  emit("select", { family: value, source: "system" });
};

const pickCustom = (): void => {
  const family = exactFamily.value ?? customName.value;
  if (family === "") return;
  emit("select", { family, source: exactFamily.value ? "system" : "custom" });
};
</script>

<template>
  <div class="rounded-md border border-border bg-surface p-2">
    <ComboboxRoot
      v-model:open="open"
      :ignore-filter="true"
      :reset-search-term-on-select="false"
      @update:model-value="pick"
    >
      <ComboboxAnchor>
        <ComboboxInput
          v-model="search"
          class="input"
          placeholder="搜索字体，或直接输入字体名"
          autofocus
        />
      </ComboboxAnchor>
      <ComboboxContent
        class="z-10 max-h-64 overflow-auto rounded-md border border-border bg-surface"
      >
        <ComboboxViewport>
          <ComboboxItem
            v-for="item in visible"
            :key="item.family"
            :value="item.family"
            class="flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-sm data-[highlighted]:bg-accent-soft"
          >
            <span class="truncate" :style="{ fontFamily: `'${item.family}'` }">
              {{ item.family }}
            </span>
            <span v-if="item.styles.length" class="shrink-0 text-xs text-muted">
              {{ item.styles.join(" / ") }}
            </span>
          </ComboboxItem>
        </ComboboxViewport>
        <ComboboxEmpty class="px-2 py-1.5 text-xs text-muted"> 没有匹配的本机字体 </ComboboxEmpty>
      </ComboboxContent>
    </ComboboxRoot>

    <p v-if="truncated" class="hint">
      结果较多，只显示前 {{ MAX_RENDER }} 项，请继续输入以缩小范围。
    </p>

    <div class="mt-2 flex items-center justify-between gap-2">
      <button
        type="button"
        class="btn"
        :disabled="customName === '' && exactFamily === null"
        @click="pickCustom"
      >
        <template v-if="exactFamily">添加 {{ exactFamily }}</template>
        <template v-else-if="customName">使用自定义字体名：{{ customName }}</template>
        <template v-else>请选择或输入字体</template>
      </button>
      <button type="button" class="btn" @click="emit('cancel')">取消</button>
    </div>
  </div>
</template>
