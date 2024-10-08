<template>
  <div class="case_navigation">
    <div style="margin-right: 1rem;">
      <el-tooltip content="JESGO-JSONファイルの読み込み" placement="bottom" :show-after="500">
        <el-button type="primary" round :icon="Document" @click="emits('loadJson')"/>
      </el-tooltip>
    </div>
    <div>
      <el-tooltip content="前のレコード" placement="bottom" :show-after="500">
        <el-button type="primary" round :icon="CaretLeft" @click="prev()" />
      </el-tooltip>
    </div>
    <div class="navigation_number">
      <span>
        {{ props.index + 1 }} / {{ props.length }}
      </span>
    </div>
    <div>
      <el-tooltip content="次のレコード" placement="bottom" :show-after="500">
        <el-button type="primary" round :icon="CaretRight" @click="next()"/>
      </el-tooltip>
    </div>
    <div class="navigation_number">
      <label><input type="checkbox" v-model="enableQuery"/>マスタクエリを適用</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document, CaretLeft, CaretRight } from '@element-plus/icons-vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    index: number,
    length?: number
    apply?: boolean
  }>(),
  {
    index: -1,
    length: 0
  }
)
const emits = defineEmits<{
  (e: 'update:index', value: number): void,
  (e: 'loadJson'): void
  (e: 'update:apply', value: boolean): void
}>()

const enableQuery = computed({
  get: () => props?.apply === undefined ? true : props.apply,
  set: (value:boolean) => emits('update:apply', value)
})

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
  justify-content: center;
  margin: 0 2rem;
}

div.navigation_number {
  margin: 0 1rem;
  margin-top: 0.25rem;
  flex-shrink: 0;
}
</style>
