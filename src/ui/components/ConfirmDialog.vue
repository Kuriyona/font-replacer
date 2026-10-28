<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "reka-ui";

withDefaults(
  defineProps<{
    title: string;
    description: string;
    confirmLabel?: string;
    tone?: "danger" | "default";
  }>(),
  { confirmLabel: "删除", tone: "danger" },
);

const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <AlertDialogRoot>
    <AlertDialogTrigger as-child>
      <slot name="trigger">
        <button type="button" class="btn">删除</button>
      </slot>
    </AlertDialogTrigger>
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-40 bg-black/50" />
      <AlertDialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <AlertDialogTitle class="text-base font-semibold">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-sm text-muted">
          {{ description }}
        </AlertDialogDescription>
        <div class="mt-5 flex justify-end gap-2">
          <AlertDialogCancel class="btn">取消</AlertDialogCancel>
          <AlertDialogAction
            :class="tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
