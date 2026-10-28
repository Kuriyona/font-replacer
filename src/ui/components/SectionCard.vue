<script setup lang="ts">
import { Card } from "@sharpdotnut/dotsharp";

defineProps<{ title?: string }>();
</script>

<template>
  <Card variant="outlined" :title="title">
    <template v-if="$slots.actions" #title-right>
      <slot name="actions" />
    </template>
    <slot />
  </Card>
</template>
