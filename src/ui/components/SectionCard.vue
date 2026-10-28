<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <header v-if="title" class="mb-3 flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold">{{ title }}</h2>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>
