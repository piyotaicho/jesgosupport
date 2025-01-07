<template>
  <div style="display: flex; flex-direction: column;">
    <el-row justify="center">
      <el-col :span="18">
        <el-progress
          :text-inside="true"
          :stroke-width="24"
          :percentage="percentage"
          status="success"
        />
      </el-col>
    </el-row>
    <el-row style="padding-top: 1.5rem;" justify="center">
      <el-col :span="6">
        <div>
          <el-button type="danger" round @click="cancel">処理中止</el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  index: number,
  length: number
}>()

const emit = defineEmits<{
  cancel: []
}>()

const percentage = computed(() => {
  if (props.index < 0 || props.length <= 0) {
    return 0
  } else {
    return Math.round((props.index + 1) / props.length * 1000) / 10
  }
})

const cancel = () => emit('cancel')
</script>
