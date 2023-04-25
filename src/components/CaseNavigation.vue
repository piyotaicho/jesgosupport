<template>
  <div class="case_navigation">
    <el-button :icon="CaretLeft" @click="prev()">
      前のレコード
    </el-button>
    <span class="navigation_number">
      {{$props.index}} / {{ $props.length }}
    </span>
    <el-button @click="next()">
      次のレコード<el-icon class="el-icon--right"><caret-right /></el-icon>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { CaretLeft, CaretRight } from '@element-plus/icons-vue'
// import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    index: number,
    length?: number
  }>(),
  {
    index: 0,
    length: 0
  }
)
const emits = defineEmits<{(e: 'update:index', value: number): void
}>()
// const caseNumber = ref(0)

function prev () {
  emits('update:index', props.index > 0 ? props.index - 1 : 0)
  // caseNumber.value = caseNumber.value > 0 ? caseNumber.value - 1 : 0
}

function next () {
  emits('update:index', props.index <= (props.length - 1) ? props.index + 1 : props.length)
  // caseNumber.value++
}
</script>

<style>
div.case_navigation {
  display: flex;
  align-content: space-around;
}

span.navigation_number {
  padding: 0.5rem 1rem;
}
</style>
