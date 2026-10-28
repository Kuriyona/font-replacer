<script setup lang="ts">
import { computed } from "vue";
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

const addRule = (event: Event): void => {
  const select = event.target as HTMLSelectElement;
  const id = select.value;
  select.value = "";
  if (id === "" || site.value.ruleIds.includes(id)) return;
  site.value = { ...site.value, ruleIds: [...site.value.ruleIds, id] };
};
</script>

<template>
  <div class="space-y-4">
    <SectionCard title="作用范围">
      <div class="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div>
          <label class="label" for="site-pattern">主机名或域名</label>
          <input id="site-pattern" v-model="site.pattern" class="input" />
          <p class="hint">修改后保存会迁移到新的作用范围键。</p>
        </div>
        <div>
          <label class="label" for="site-match">匹配方式</label>
          <select id="site-match" v-model="site.match" class="input">
            <option value="host">主机（精确）</option>
            <option value="domain">域名及子域</option>
          </select>
        </div>
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
        <label class="label" for="site-add-rule">添加规则</label>
        <select
          id="site-add-rule"
          class="input"
          :disabled="available.length === 0"
          @change="addRule"
        >
          <option value="">{{ available.length ? "选择一条规则…" : "没有可添加的规则" }}</option>
          <option v-for="rule in available" :key="rule.id" :value="rule.id">{{ rule.name }}</option>
        </select>
        <p class="hint">靠前的规则优先；同一元素只应用第一条命中的规则。</p>
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
          <button type="button" class="btn btn-danger">删除</button>
        </template>
      </ConfirmDialog>
      <button type="button" class="btn" @click="emit('cancel')">取消</button>
      <button type="button" class="btn btn-primary" @click="emit('save')">保存</button>
    </div>
  </div>
</template>
