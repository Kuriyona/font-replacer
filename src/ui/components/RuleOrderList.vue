<script setup lang="ts">
import { ArrowDown, ArrowUp, Trash2 } from "@lucide/vue";
import type { Rule } from "@/shared/types";
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
      class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
    >
      <span class="w-4 text-center text-xs text-muted">{{ index + 1 }}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm">{{ rule.name }}</span>
          <span
            v-if="!rule.enabled"
            class="shrink-0 rounded bg-accent-soft px-1 text-[10px] text-muted"
          >
            已停用
          </span>
          <WarningIcon
            v-if="missingCount(rule) > 0"
            :message="`${missingCount(rule)} 个字体在本机未找到`"
          />
        </div>
        <p class="truncate text-xs text-muted">{{ summary(rule) }}</p>
      </div>
      <button
        type="button"
        class="btn btn-icon"
        aria-label="上移规则"
        :disabled="index === 0"
        @click="emit('move', index, -1)"
      >
        <ArrowUp class="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="btn btn-icon"
        aria-label="下移规则"
        :disabled="index === rules.length - 1"
        @click="emit('move', index, 1)"
      >
        <ArrowDown class="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="btn btn-icon btn-danger"
        aria-label="移除规则"
        @click="emit('remove', index)"
      >
        <Trash2 class="size-3.5" aria-hidden="true" />
      </button>
    </li>
  </ol>
  <p v-else class="text-xs text-muted">{{ emptyText }}</p>
</template>
