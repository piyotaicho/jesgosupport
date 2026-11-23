<script setup lang="ts">
import { computed, ref } from 'vue'
import { CascaderOption } from 'element-plus'

const props = defineProps<{
  placeholder: string,
  options: CascaderOption[],
  disabled?: boolean,
  modelValue: string
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', newvalue: string): void
  (e: 'typed-input', typedValue: string): void
}>()

const isVariable = (value: string) => {
  return value.charAt(0) === '@' || value.charAt(0) === '$'
}

const options = computed(() => {
  if (props.modelValue !== '' && !isVariable(props.modelValue)) {
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

const typedValue = ref('')
const selectingOption = ref(false)
const suppressTypedInput = ref(false)

function beforeFilter (typedstring: string) {
  // Keep user's raw input separate from option selection.
  typedValue.value = typedstring
  if (suppressTypedInput.value) {
    suppressTypedInput.value = false
    return false
  }
  emits('typed-input', typedstring)
  value.value = typedstring
  return false
}

function onChange (newvalue: string) {
  selectingOption.value = true
  suppressTypedInput.value = true
  typedValue.value = ''
  value.value = newvalue
}

function onVisibleChange (visible: boolean) {
  if (visible) {
    return
  }

  if (selectingOption.value) {
    selectingOption.value = false
    typedValue.value = ''
    return
  }

  if (typedValue.value !== '' && typedValue.value !== value.value) {
    value.value = typedValue.value
  }

  typedValue.value = ''
}

function onBlur () {
  if (selectingOption.value) {
    selectingOption.value = false
    typedValue.value = ''
    return
  }

  if (typedValue.value !== '' && typedValue.value !== value.value) {
    value.value = typedValue.value
  }

  typedValue.value = ''
}

function onClear () {
  selectingOption.value = false
  suppressTypedInput.value = true
  typedValue.value = ''
  value.value = ''
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
    @change="onChange"
    @visible-change="onVisibleChange"
    @blur="onBlur"
    @clear="onClear"
    style="width: 100%;"
  />
</template>
