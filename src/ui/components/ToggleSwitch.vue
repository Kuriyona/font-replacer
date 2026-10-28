<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui";

const checked = defineModel<boolean>({ required: true });
</script>

<template>
  <SwitchRoot
    v-model="checked"
    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border bg-bg transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent"
  >
    <SwitchThumb
      class="block size-3.5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[1.15rem] data-[state=checked]:bg-white"
    />
  </SwitchRoot>
</template>
