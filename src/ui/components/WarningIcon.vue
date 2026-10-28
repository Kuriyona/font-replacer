<script setup lang="ts">
import { Icon, Tooltip } from "@sharpdotnut/dotsharp";
import warningIcon from "@iconify-icons/material-symbols/warning";

defineProps<{ message: string }>();
</script>

<template>
  <Tooltip :label="message">
    <Icon :icon="warningIcon" size="1.1em" :label="message" class="text-ds-error" />
  </Tooltip>
</template>
