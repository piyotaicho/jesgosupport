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

const typedValue = ref('')

onMounted(() => {
  // 通常文字列の入力を検知
  if (props.modelValue !== '' && props.modelValue.charAt(0) !== '@' && props.modelValue.charAt(0) !== '$') {
    typedValue.value = props.modelValue
  } else {
    typedValue.value = ''
  }
})

const options:ComputedRef<CascaderOption[]> = computed(() => {
  if (typedValue.value !== '') {
    return [
      {
        label: typedValue.value,
        value: typedValue.value
      },
      ...props.options
    ]
  } else {
    return props.options
  }
})

const value = computed({
  get: () => props.modelValue,
  set: (newvalue: string) => {
    if (newvalue === '' || newvalue !== typedValue.value) {
      typedValue.value = ''
    }
    emits('update:modelValue', newvalue)
  }
})

async function beforeFilter (typedstring: string) {
  typedValue.value = typedstring
  await nextTick()
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
    style="width: 100%;"
    />
</template>
