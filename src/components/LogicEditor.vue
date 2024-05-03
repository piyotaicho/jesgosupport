<template>
  <!-- コントロールボタン -->
  <div class="logic-controler">
    <div>
      <ElButton :color="BlockColorByType.Variables" round :icon="Plus" @click="addBlock('Variables')">変数</ElButton>
    </div>

    <ElDropdown @command="addModifiers">
      <ElButton color="yellow" style="border: 1px solid gray;" round :icon="Plus">演算<ElIcon class="el-icon--right"><ArrowDown /></ElIcon></ElButton>
      <template #dropdown>
        <ElDropdownItem command="Translation">置換</ElDropdownItem>
        <ElDropdownItem command="Sort">ソート</ElDropdownItem>
        <ElDropdownItem command="Query" divided>抽出</ElDropdownItem>
        <ElDropdownItem command="Period">日付計算</ElDropdownItem>
        <ElDropdownItem command="Sets">集合演算</ElDropdownItem>
      </template>
    </ElDropdown>

    <div>
      <ElButton :color="BlockColorByType.Operators" round :icon="Plus" @click="addBlock('Operators')">条件分岐</ElButton>
    </div>
    <div>
      <ElButton :color="BlockColorByType.Store" round :icon="Plus" @click="addBlock('Store')">割り当て</ElButton>
    </div>
  </div>

  <!-- ロジック編集 -->
  <div id="logicBlocks">
    <LogicTemplate v-for="(block, index) in props.blocks" :key="index"
      :index="index" :block="block" :variables="variables"
      @delete="deleteBlock" @reorder="reorderBlock"
    />
  </div>
</template>

<script setup lang="ts">
// import { ref } from 'vue'
import { Plus, ArrowDown } from '@element-plus/icons-vue'
import { LogicBlock, BlockType, failableBlockTypes, BlockColorByType } from './types'
import LogicTemplate from './LogicTemplate.vue'
import { nextTick, computed, ComputedRef } from 'vue'
import { CascaderOption } from 'element-plus'

const props = defineProps<{
  blocks: LogicBlock[],
  sourceCount: number,
  variables: string[]
}>()

const emits = defineEmits<{
  (e:'update:blocks', value: LogicBlock[]): void
}>()

// 現ルール内で試用する変数一覧
const variables:ComputedRef<CascaderOption[]> = computed(() => {
  const registers = [
    { label: '変数1', value: '$1' },
    { label: '変数2', value: '$2' },
    { label: '変数3', value: '$3' },
    { label: '変数4', value: '$4' },
    { label: '変数5', value: '$5' },
    { label: '変数6', value: '$6' },
    { label: '変数7', value: '$7' },
    { label: '変数8', value: '$8' },
    { label: '変数9', value: '$9' },
    { label: '変数0', value: '$0' }
  ]

  const systemConstants = [
    { label: 'ハッシュ値', value: '$hash' },
    { label: 'カルテ番号', value: '$his_id' },
    { label: '患者名', value: '$name' },
    { label: '生年月日', value: '$date_of_birth' },
    { label: '今日の日付', value: '$now' }
  ]

  const sources:string[] = []
  for (let index = 1; index <= props.sourceCount; index++) {
    sources.push(`@${index}`)
  }

  const options = [
    {
      label: '一時変数',
      value: 'register',
      children: [...registers]
    }
  ]

  if (sources.length > 0) {
    options.push(
      {
        label: 'ソース',
        value: 'sources',
        children: [
          ...sources.map(item => {
            return {
              label: `ソース${item.slice(1)}`,
              value: item
            }
          })
        ]
      }
    )
  }

  if (props.variables.length > 0) {
    options.push(
      {
        label: 'ドキュメント変数',
        value: 'variables',
        children: [
          ...props.variables.map(item => {
            return {
              label: item,
              value: item
            }
          })
        ]
      }
    )
  }

  options.push({
    label: '定数',
    value: 'constants',
    children: [...systemConstants]
  })

  return options
})

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

function addModifiers (blockType: BlockType) {
  addBlock(blockType)
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

<style>
div.logic-controler {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
}

div.logic-controler > div {
  margin-left: 0.4rem;
  margin-right: 0.2rem;
}
</style>
