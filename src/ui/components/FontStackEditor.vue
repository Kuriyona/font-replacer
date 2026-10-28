<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "@lucide/vue";
import type { FontCache, RuleFont } from "@/shared/types";
import FontPicker from "./FontPicker.vue";
import WarningIcon from "./WarningIcon.vue";

const props = defineProps<{ fonts: RuleFont[]; missing: string[]; cache: FontCache | null }>();
const emit = defineEmits<{ update: [fonts: RuleFont[]] }>();

const picking = ref(false);
const missingSet = computed(() => new Set(props.missing.map((family) => family.toLowerCase())));

const move = (index: number, delta: number): void => {
  const target = index + delta;
  if (target < 0 || target >= props.fonts.length) return;
  const next = [...props.fonts];
  const [item] = next.splice(index, 1);
  if (!item) return;
  next.splice(target, 0, item);
  emit("update", next);
};

const remove = (index: number): void => {
  emit(
    "update",
    props.fonts.filter((_, current) => current !== index),
  );
};

const add = (font: RuleFont): void => {
  const exists = props.fonts.some(
    (item) => item.family.toLowerCase() === font.family.toLowerCase(),
  );
  if (!exists) emit("update", [...props.fonts, font]);
  picking.value = false;
};
</script>

<template>
  <div>
    <ol v-if="fonts.length" class="space-y-1">
      <li
        v-for="(font, index) in fonts"
        :key="`${font.family}-${index}`"
        class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
      >
        <span class="w-4 text-center text-xs text-muted">{{ index + 1 }}</span>
        <span class="min-w-0 flex-1 truncate text-sm" :style="{ fontFamily: `'${font.family}'` }">
          {{ font.family }}
        </span>
        <span
          class="shrink-0 rounded px-1 text-[10px]"
          :class="font.source === 'system' ? 'bg-accent-soft text-muted' : 'bg-bg text-muted'"
        >
          {{ font.source === "system" ? "本机" : "自定义" }}
        </span>
        <WarningIcon
          v-if="font.source === 'system' && missingSet.has(font.family.toLowerCase())"
          message="本机未找到该字体"
        />
        <button
          type="button"
          class="btn btn-icon"
          aria-label="上移字体"
          :disabled="index === 0"
          @click="move(index, -1)"
        >
          <ArrowUp class="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn btn-icon"
          aria-label="下移字体"
          :disabled="index === fonts.length - 1"
          @click="move(index, 1)"
        >
          <ArrowDown class="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn btn-icon btn-danger"
          aria-label="删除字体"
          @click="remove(index)"
        >
          <Trash2 class="size-3.5" aria-hidden="true" />
        </button>
      </li>
    </ol>
    <p v-else class="text-xs text-muted">还没有字体。至少添加一个字体后才能保存。</p>

    <div class="mt-2">
      <button v-if="!picking" type="button" class="btn" @click="picking = true">
        <Plus class="size-3.5" aria-hidden="true" />
        添加字体
      </button>
      <FontPicker v-else :cache="cache" @select="add" @cancel="picking = false" />
    </div>
    <p class="hint">顺序即回退优先级；页面原有字体自动排在最后。</p>
  </div>
</template>
