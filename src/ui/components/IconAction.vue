<script setup lang="ts">
import { IconButton } from "@sharpdotnut/dotsharp";
import type { IconifyIcon } from "@iconify/vue";

withDefaults(
  defineProps<{
    icon: IconifyIcon;
    label: string;
    disabled?: boolean;
    tone?: "default" | "danger";
  }>(),
  { disabled: false, tone: "default" },
);
</script>

<template>
  <IconButton
    :icon="icon"
    :label="label"
    :disabled="disabled"
    class="h-8! w-8!"
    :class="tone === 'danger' ? 'text-ds-error!' : ''"
  />
</template>
