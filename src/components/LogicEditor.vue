<template>
  <div>
    <div>
      <!-- コントロールボタン -->
      <ElButton :color="BlockColorByType.Operators" round :icon="Plus" @click="addBlock('Operators')">条件</ElButton>
      <ElButton :color="BlockColorByType.Variables" round :icon="Plus" @click="addBlock('Variables')">変数</ElButton>
      <ElButton :color="BlockColorByType.Query" round :icon="Plus" @click="addBlock('Query')">抽出</ElButton>
      <ElButton :color="BlockColorByType.Translation" round :icon="Plus" @click="addBlock('Translation')">置換</ElButton>
      <ElButton :color="BlockColorByType.Translation" round :icon="Plus" @click="addBlock('Period')">日付計算</ElButton>
      <ElButton :color="BlockColorByType.Store" round :icon="Plus" @click="addBlock('Store')">割り当て</ElButton>
      <!-- <el-button type="primary" round :icon="Delete"/> -->
    </div>
    <div id="logicBlocks">
      <!-- ロジック編集 -->
      <LogicTemplate v-for="(block, index) in props.blocks" :key="index"
        :index="index" :block="block"
        @delete="deleteBlock" @reorder="reorderBlock"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// import { ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { LogicBlock, BlockType, failableBlockTypes, BlockColorByType } from './types'
import LogicTemplate from './LogicTemplate.vue'
import { nextTick } from 'vue'

const props = defineProps<{
  blocks: LogicBlock[]
}>()

const emits = defineEmits<{
  (e:'update:blocks', value: LogicBlock[]): void
}>()

function addBlock (blockType: BlockType) {
  const newBlock: LogicBlock = {
    type: blockType,
    arguments: blockType !== 'Operators' ? [] : ['', 'value', '', 'eq'],
    trueBehavior: 1,
    ...failableBlockTypes.includes(blockType) ? { falseBehavior: 'Abort' } : {}
  }
  emits('update:blocks', [...props.blocks, newBlock])

  // DOMのレンダリングまで待って要素にスクロール 80ms は使用の不都合にならないように
  nextTick()
  setTimeout(() => {
    const scrollableElement = document.getElementById('logicBlocks')
    if (scrollableElement) {
      scrollableElement.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, 80)
}

function deleteBlock (index: number) {
  if (props.blocks.length !== 0) {
    const newBlocks = Object.assign(props.blocks)
    newBlocks.splice(index, 1)
    emits('update:blocks', newBlocks)
  }
}

function reorderBlock (index: number, offset: number) {
  const newBlocks = [...props.blocks]
  if (
    (index > 0 && offset === -1) ||
    (index < newBlocks.length - 1 && offset === 1)
  ) {
    newBlocks.splice(index + offset, 0, newBlocks.splice(index, 1)[0])
    emits('update:blocks', newBlocks)

    const scrollableElement = document.getElementById('logicBlock' + (index + offset).toString())
    if (scrollableElement) {
      scrollableElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
}
</script>
