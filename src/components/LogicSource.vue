<template>
  <div>
    <div>
      ソース {{ props.index + 1 }}
    </div>
    <div>
      パス: <el-input v-model.trim="sourcePath"/> <el-button :icon="View" round @click="highlight()"/>
    </div>
    <div>
      サブパス: <el-input v-model="sourceSubPath" :disabled="disableSubpath"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WritableComputedRef, computed } from 'vue'
import { View } from '@element-plus/icons-vue'
import { useStore } from './store'
import { SourceBlock } from './types'

const store = useStore()

const reservedWords = [
  '$hash',
  '$his_id',
  '$name'
  // '$1', '$2', '$3', '$4', '$5',
  // '$6', '$7', '$8', '$9', '$0'
]

const props = defineProps<{
  index: number,
  block: SourceBlock
}>()

const emits = defineEmits<{
  (e:'update:block', value: SourceBlock): void
}>()

const disableSubpath = computed(() => reservedWords.indexOf(props.block.path) !== -1)

const sourcePath :WritableComputedRef<string> = computed({
  get: () => props.block.path || '',
  set: (newPath: string) => emits('update:block', Object.assign(props.block, { path: newPath }))
})

const sourceSubPath :WritableComputedRef<string> = computed({
  get: () => disableSubpath.value ? '' : (props.block.subpath || ''),
  set: (newPath: string) => emits('update:block', Object.assign(props.block, { subpath: newPath }))
})

/**
 * highlight JSONビューアのハイライトの有無を切り替える(トグル動作)
 */
function highlight (disable = false) {
  if (!disable && !disableSubpath.value && store.state.HighlightedPath !== sourcePath.value) {
    store.commit('setHighlight', sourcePath.value)
  } else {
    store.commit('setHighlight', '')
  }
}
</script>
