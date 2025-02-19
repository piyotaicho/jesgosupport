<template>
  <div class="dropdown-combo-input">
    <el-input v-model="value"
      :disabled="props.disabled" :size="props.size"
      :placeholder="props.placeholder"
      :maxlength="props.maxlength"
      :minlength="props.minlength"
      :clearable="props.clearable"
      >
      <template #suffix>
        <el-icon class="el-input__icon" @click="showLargeInput = true" v-if="props.largetext"><EditPen/></el-icon>
      </template>

      <template #append>
        <el-select v-model="value" placeholder=" "
          :disabled="props.disabled"
          :size="props.size"
          :effect="props.effect"
          :placement="props.placement"
        >
          <slot></slot>
        </el-select>
      </template>
    </el-input>
    <el-dialog v-if="props.largetext" v-model="showLargeInput"
      :close-on-click-modal="false"
      title="文字列を編集可能です"
    >
      <textarea class="largeinput" v-model="value"></textarea>
      <template #footer>
        <el-button type="primary" @click="showLargeInput = false">閉じる</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, WritableComputedRef } from 'vue'
import { EditPen } from '@element-plus/icons-vue'

type selectPlacement = 'top' | 'bottom' | 'bottom-start' | 'auto' | 'auto-start' | 'auto-end' | 'right' | 'left' | 'top-start' | 'top-end' | 'bottom-end' | 'right-start' | 'right-end' | 'left-start' | 'left-end'

const props = withDefaults(defineProps<{
  modelValue: string,
  disabled?: boolean,
  size?: 'large'|'default'|'small',
  effect?: string,
  placeholder?: string,
  maxlength?: string|number,
  minlength?: number,
  clearable?: boolean,
  placement?: selectPlacement,
  largetext?: boolean
}>(),
{
  disabled: false,
  size: 'default',
  effect: 'light',
  placeholder: 'Please input or select',
  clearable: false,
  placement: 'bottom-start',
  largetext: false
})

const showLargeInput = ref(false)

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
  width: 2rem;
}

div.dropdown-combo-input .el-select .el-input__wrapper {
  max-width: 14px;
  padding-left: 11px;
}

div.dropdown-combo-input .el-input-group__append {
  padding-left: 16.5px;
  padding-right: 16px;
}

div.dropdown-combo-input .el-input-group__append .el-select__wrapper {
  padding: 4px 6px;
}

div.dropdown-combo-input > .el-input__inner {
  text-overflow: ellipsis;
}

textarea.largeinput {
  min-height: 5rem;
  max-height: 80%;
  width: 90%;
  max-width: 99%;
  overflow-y: auto;
}
</style>
