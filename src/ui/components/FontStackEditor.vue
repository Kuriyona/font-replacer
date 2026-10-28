<script setup lang="ts">
import { computed, ref } from "vue";
import { Button, Icon } from "@sharpdotnut/dotsharp";
import addIcon from "@iconify-icons/material-symbols/add";
import arrowDownIcon from "@iconify-icons/material-symbols/arrow-downward";
import arrowUpIcon from "@iconify-icons/material-symbols/arrow-upward";
import deleteIcon from "@iconify-icons/material-symbols/delete";
import type { FontCache, RuleFont } from "@/shared/types";
import FontPicker from "./FontPicker.vue";
import IconAction from "./IconAction.vue";
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
        class="flex items-center gap-2 rounded-ds-sm border border-ds-line bg-ds-surface px-2 py-1"
      >
        <span class="w-4 text-center text-xs text-ds-muted">{{ index + 1 }}</span>
        <span class="min-w-0 flex-1 truncate text-sm" :style="{ fontFamily: `'${font.family}'` }">
          {{ font.family }}
        </span>
        <span class="shrink-0 rounded-ds-sm bg-ds-surface-hover px-1.5 text-[10px] text-ds-muted">
          {{ font.source === "system" ? "本机" : "自定义" }}
        </span>
        <WarningIcon
          v-if="font.source === 'system' && missingSet.has(font.family.toLowerCase())"
          message="本机未找到该字体"
        />
        <IconAction
          :icon="arrowUpIcon"
          label="上移字体"
          :disabled="index === 0"
          @click="move(index, -1)"
        />
        <IconAction
          :icon="arrowDownIcon"
          label="下移字体"
          :disabled="index === fonts.length - 1"
          @click="move(index, 1)"
        />
        <IconAction :icon="deleteIcon" label="删除字体" tone="danger" @click="remove(index)" />
      </li>
    </ol>
    <p v-else class="text-xs text-ds-muted">还没有字体。至少添加一个字体后才能保存。</p>

    <div class="mt-2">
      <Button variant="tonal" size="sm" @click="picking = true">
        <Icon :icon="addIcon" />
        添加字体
      </Button>
    </div>
    <p class="mt-1 text-xs text-ds-muted">顺序即回退优先级；页面原有字体自动排在最后。</p>

    <FontPicker v-model:open="picking" :cache="cache" @select="add" @cancel="picking = false" />
  </div>
</template>
