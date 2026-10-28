<script setup lang="ts">
import type { PageIssue } from "@/shared/types";
import WarningIcon from "./WarningIcon.vue";

defineProps<{ issues: PageIssue[] }>();
const emit = defineEmits<{ select: [issue: PageIssue] }>();

const label = (issue: PageIssue): string => {
  if (issue.kind === "font-missing") return `${issue.ruleName}：本机未找到字体 ${issue.family}`;
  if (issue.kind === "css-failed") return `${issue.ruleName}：CSS 加载失败 ${issue.url}`;
  return `自定义 CSS 注入失败：${issue.message}`;
};
</script>

<template>
  <div v-if="issues.length > 0" class="rounded-md border border-danger bg-danger-soft p-3 text-sm">
    <p class="mb-1 flex items-center gap-1.5 font-semibold text-danger">
      <WarningIcon :message="`${issues.length} 个警告`" />
      {{ issues.length }} 个警告
    </p>
    <ul class="space-y-1">
      <li v-for="(issue, index) in issues" :key="index">
        <button
          type="button"
          class="w-full text-left text-xs text-danger underline-offset-2 hover:underline"
          @click="emit('select', issue)"
        >
          {{ label(issue) }}
        </button>
      </li>
    </ul>
  </div>
</template>
