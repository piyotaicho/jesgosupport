<script setup lang="ts">
import { computed } from 'vue'
import { CascaderOption } from 'element-plus'

const props = defineProps<{
  placeholder: string,
  options: CascaderOption[],
  disabled?: boolean,
  modelValue: string
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', newvalue: string): void
}>()

const value = computed({
  get: () => props.modelValue,
  set: (newvalue: string) => emits('update:modelValue', newvalue)
})
</script>

<template>
  <el-cascader v-model="value" :placeholder="props.placeholder"
    :options="options"
    :show-all-levels="false"
    :clearable="true"
    :filterable="true"
    :disabled="props.disabled === true"
    :props="{emitPath: false}"
    :value-on-clear="''"
    style="width: 100%;"
    />
</template>
