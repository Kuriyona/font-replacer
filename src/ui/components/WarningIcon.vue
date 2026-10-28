<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";

defineProps<{ message: string }>();
</script>

<template>
  <span class="inline-flex text-danger" :title="message">
    <CircleAlert class="size-4" aria-hidden="true" />
    <span class="sr-only">{{ message }}</span>
  </span>
</template>
