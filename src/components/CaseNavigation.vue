<template>
  <div class="case_navigation">
    <div>
      <el-button :icon="CaretLeft" @click="prev()">
        前のレコード
      </el-button>
    </div>
    <div class="navigation_number">
      <span>
        {{ props.index + 1 }} / {{ props.length }}
      </span>
    </div>
    <div>
      <el-button @click="next()">
        次のレコード<el-icon class="el-icon--right"><caret-right /></el-icon>
      </el-button>
    </div>
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
    index: -1,
    length: 0
  }
)
const emits = defineEmits<{(e: 'update:index', value: number): void
}>()
// const caseNumber = ref(0)

/**
 * prev() イベントハンドラ indexをひとつ前に移動
 */
function prev () {
  if (props.length === 0) {
    emits('update:index', -1)
  } else {
    emits('update:index', props.index > 0 ? props.index - 1 : 0)
  }
}

/**
 * next() イベントハンドラ indexを1つ後ろに移動
 */
function next () {
  if (props.length === 0) {
    emits('update:index', -1)
  } else {
    emits('update:index', props.index < (props.length - 1) ? props.index + 1 : props.length - 1)
  }
}
</script>

<style>
div.case_navigation {
  flex: initial;
  display: flex;
  flex-direction: row;
  min-width: 40rem;
  margin: 0 2rem;
}

div.navigation_number {
  margin: 0 2rem;
  margin-top: 0.25rem;
}
</style>
