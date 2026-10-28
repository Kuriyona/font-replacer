<script setup lang="ts">
import { computed, ref } from "vue";
import { Button, FormItem, Input, Option, Select } from "@sharpdotnut/dotsharp";
import type { Rule, SiteRule } from "@/shared/types";
import ConfirmDialog from "./ConfirmDialog.vue";
import RuleOrderList from "./RuleOrderList.vue";
import SectionCard from "./SectionCard.vue";

const site = defineModel<SiteRule>({ required: true });
const props = defineProps<{
  rules: Rule[];
  missingByRule: Map<string, string[]>;
}>();
const emit = defineEmits<{ save: []; cancel: []; delete: [] }>();

const byId = computed(() => new Map(props.rules.map((rule) => [rule.id, rule])));
/** 只保留仍然存在的规则；这条序列同时用于展示与排序，索引与展示顺序一致 */
const assignedIds = computed(() => site.value.ruleIds.filter((id) => byId.value.has(id)));
const assigned = computed(() =>
  assignedIds.value
    .map((id) => byId.value.get(id))
    .filter((rule): rule is Rule => rule !== undefined),
);
const available = computed(() =>
  props.rules.filter((rule) => rule.enabled && !site.value.ruleIds.includes(rule.id)),
);

const pickValue = ref<string | number>("");

const move = (index: number, delta: number): void => {
  const target = index + delta;
  if (target < 0 || target >= assignedIds.value.length) return;
  const ruleIds = [...assignedIds.value];
  const [item] = ruleIds.splice(index, 1);
  if (!item) return;
  ruleIds.splice(target, 0, item);
  site.value = { ...site.value, ruleIds };
};

const remove = (index: number): void => {
  const removed = assignedIds.value[index];
  if (!removed) return;
  site.value = {
    ...site.value,
    ruleIds: site.value.ruleIds.filter((id) => id !== removed),
  };
};

const setMatch = (value: string | number): void => {
  site.value = { ...site.value, match: value === "domain" ? "domain" : "host" };
};

const addRule = (value: string | number): void => {
  const id = String(value);
  pickValue.value = "";
  if (id === "" || site.value.ruleIds.includes(id)) return;
  site.value = { ...site.value, ruleIds: [...site.value.ruleIds, id] };
};
</script>

<template>
  <div class="space-y-4">
    <SectionCard title="作用范围">
      <div class="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Input
          v-model="site.pattern"
          label="主机名或域名"
          description="修改后保存会迁移到新的作用范围键。"
        />
        <Select label="匹配方式" :value="site.match" @update:value="setMatch">
          <Option label="主机（精确）" value="host" />
          <Option label="域名及子域" value="domain" />
        </Select>
      </div>
    </SectionCard>

    <SectionCard title="规则顺序">
      <RuleOrderList
        :rules="assigned"
        :missing-by-rule="props.missingByRule"
        @move="move"
        @remove="remove"
      />
      <div class="mt-3">
        <FormItem description="靠前的规则优先；同一元素只应用第一条命中的规则。">
          <Select
            label="添加规则"
            :value="pickValue"
            placeholder="选择一条规则…"
            :disabled="available.length === 0"
            @update:value="addRule"
          >
            <Option v-for="rule in available" :key="rule.id" :label="rule.name" :value="rule.id" />
          </Select>
        </FormItem>
      </div>
    </SectionCard>

    <div class="flex items-center justify-end gap-2">
      <ConfirmDialog
        title="删除站点配置"
        description="删除后该站点不再应用任何规则。"
        confirm-label="删除站点"
        @confirm="emit('delete')"
      >
        <template #trigger>
          <Button variant="text" size="sm" class="text-ds-error!">删除</Button>
        </template>
      </ConfirmDialog>
      <Button variant="text" size="sm" @click="emit('cancel')">取消</Button>
      <Button size="sm" @click="emit('save')">保存</Button>
    </div>
  </div>
</template>
