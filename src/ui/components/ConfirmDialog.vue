<script setup lang="ts">
import { ref } from "vue";
import { Button, Dialog } from "@sharpdotnut/dotsharp";

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

const open = ref(false);

const confirm = (): void => {
  open.value = false;
  emit("confirm");
};
</script>

<template>
  <Dialog v-model:open="open" :title="title">
    <p>{{ description }}</p>
    <template #footer-left>
      <Button variant="text" size="sm" @click="open = false">取消</Button>
    </template>
    <template #footer-right>
      <Button
        v-if="tone === 'danger'"
        variant="text"
        size="sm"
        class="text-ds-error!"
        @click="confirm"
      >
        {{ confirmLabel }}
      </Button>
      <Button v-else size="sm" @click="confirm">{{ confirmLabel }}</Button>
    </template>
  </Dialog>

  <span class="inline-flex" @click="open = true">
    <slot name="trigger" />
  </span>
</template>
