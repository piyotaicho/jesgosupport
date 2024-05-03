<script setup lang="ts">
import { WritableComputedRef, computed } from 'vue'

const props = defineProps<{
  modelValue: string|number,
  allowExit?: boolean
}>()

const emits = defineEmits<{
  (e:'update:modelValue', newvalue: string|number): void
}>()

const value:WritableComputedRef<string|number> = computed({
  get: () => props.modelValue,
  set: (newvalue) => emits('update:modelValue', newvalue)
})
</script>

<template>
  <div class="Logic-block-behavior">
    <el-row>
      <el-col :span="10" style="margin-top: 0.25rem;"><slot>次の処理</slot>: </el-col>
      <el-col :span="12">
        <el-select v-model="value">
          <el-option label="ルールの処理を終了" value="Abort"/>
          <template v-if="props.allowExit === true">
            <!-- allowExitが指定されていたら終了を許可する(エラーのみ) -->
            <el-option label="症例に対する全ての処理を終了" value="Exit"/>
          </template>
          <el-option label="次のブロックへ" :value="1"/>
          <el-option v-for="number in [2,3,4,5,6,7,8,9,10,11,12]" :key="number" :label="number + '先のブロックへ'" :value="number" />
        </el-select>
      </el-col>
    </el-row>
  </div>
</template>
