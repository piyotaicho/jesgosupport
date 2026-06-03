<script setup lang="ts">
import { computed, ComputedRef, nextTick, onMounted, ref } from 'vue'
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

const isVariable = (string: string) => {
  return string.charAt(0) === '@' || string.charAt(0) === '$'
}

const options:ComputedRef<CascaderOption[]> = computed(() => {
  if (!isVariable(props.modelValue) && props.modelValue !== '') {
    return [
      {
        label: props.modelValue,
        value: props.modelValue
      },
      ...props.options
    ]
  } else {
    return props.options
  }
})

const value = computed({
  get: () => props.modelValue,
  set: (newvalue: string) => emits('update:modelValue', newvalue)
})

async function beforeFilter (typedstring: string) {
  value.value = typedstring
  await nextTick()
  return false
}
</script>

<template>
  <el-cascader v-model="value" :placeholder="props.placeholder"
    :options="options"
    :show-all-levels="false"
    :clearable="true"
    :filterable="true"
    :disabled="props.disabled === true"
    :before-filter="beforeFilter"
    :props="{emitPath: false}"
    :value-on-clear="''"
    :debounce="150"
    style="width: 100%;"
  >
  </el-cascader>
</template>
