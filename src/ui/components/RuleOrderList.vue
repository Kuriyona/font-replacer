<script setup lang="ts">
import arrowDownIcon from "@iconify-icons/material-symbols/arrow-downward";
import arrowUpIcon from "@iconify-icons/material-symbols/arrow-upward";
import deleteIcon from "@iconify-icons/material-symbols/delete";
import type { Rule } from "@/shared/types";
import IconAction from "./IconAction.vue";
import WarningIcon from "./WarningIcon.vue";

const props = withDefaults(
  defineProps<{
    rules: Rule[];
    missingByRule?: Map<string, string[]>;
    emptyText?: string;
  }>(),
  { missingByRule: () => new Map(), emptyText: "该站点暂不应用任何规则" },
);

const emit = defineEmits<{ move: [index: number, delta: number]; remove: [index: number] }>();

const missingCount = (rule: Rule): number => props.missingByRule.get(rule.id)?.length ?? 0;

const summary = (rule: Rule): string => {
  const families = rule.fonts.map((font) => font.family);
  const fontText =
    families.length > 3 ? `${families.slice(0, 3).join(" → ")} → …` : families.join(" → ");
  const filterText =
    rule.selectors.mode === "none"
      ? "不限制"
      : `${rule.selectors.mode === "blacklist" ? "黑名单" : "白名单"} ${rule.selectors.list.length}`;
  return `${fontText} · ${filterText}`;
};
</script>

<template>
  <ol v-if="rules.length" class="space-y-1">
    <li
      v-for="(rule, index) in rules"
      :key="rule.id"
      class="flex items-center gap-2 rounded-ds-sm border border-ds-line bg-ds-surface px-2 py-1"
    >
      <span class="w-4 text-center text-xs text-ds-muted">{{ index + 1 }}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm">{{ rule.name }}</span>
          <span
            v-if="!rule.enabled"
            class="shrink-0 rounded-ds-sm bg-ds-surface-hover px-1.5 text-[10px] text-ds-muted"
          >
            已停用
          </span>
          <WarningIcon
            v-if="missingCount(rule) > 0"
            :message="`${missingCount(rule)} 个字体在本机未找到`"
          />
        </div>
        <p class="truncate text-xs text-ds-muted">{{ summary(rule) }}</p>
      </div>
      <IconAction
        :icon="arrowUpIcon"
        label="上移规则"
        :disabled="index === 0"
        @click="emit('move', index, -1)"
      />
      <IconAction
        :icon="arrowDownIcon"
        label="下移规则"
        :disabled="index === rules.length - 1"
        @click="emit('move', index, 1)"
      />
      <IconAction
        :icon="deleteIcon"
        label="移除规则"
        tone="danger"
        @click="emit('remove', index)"
      />
    </li>
  </ol>
  <p v-else class="text-xs text-ds-muted">{{ emptyText }}</p>
</template>
