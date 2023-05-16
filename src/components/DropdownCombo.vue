<template>
  <div class="dropdown-combo-input">
    <el-input v-model="value"
      :disabled="props.disabled" :size="props.size"
      :placeholder="props.placeholder"
      :maxlength="props.maxlength"
      :minlength="props.minlength"
      :clearable="props.clearable"
      >
      <template #append>
        <el-select v-model="value" placeholder=""
          :disabled="props.disabled"
          :size="props.size"
          :effect="props.effect"
          :placement="props.placement"
        >
          <slot></slot>
        </el-select>
      </template>
    </el-input>
  </div>
</template>

<script setup lang="ts">
import { computed, WritableComputedRef } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string,
  disabled?: boolean,
  size?: 'large'|'default'|'small',
  effect?: string,
  placeholder?: string,
  maxlength?: string|number,
  minlength?: number,
  clearable?: boolean,
  placement?: string
}>(),
{
  disabled: false,
  size: 'default',
  effect: 'light',
  placeholder: 'Please input or select',
  clearable: false,
  placement: 'bottom-start'
})

const emits = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
const value:WritableComputedRef<string> = computed({
  get: () => props.modelValue,
  set: (value) => emits('update:modelValue', value)
})
</script>

<style>
div.dropdown-combo-input .el-select {
  width: 2.7rem;
}
</style>
