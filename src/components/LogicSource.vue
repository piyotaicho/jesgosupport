<template>
  <div class="source-block">
    <div class="source-block-index clickable" @click="previewSource">
      <el-tooltip placement="top-start" content="クリックでソースをプレビューします.">
        ソース {{ props.index + 1 }}
      </el-tooltip>
    </div>
    <div class="source-block-content">
      <div class="source-block-path">
        <div>
          パス:
        </div>
        <div>
          <el-select v-model.trim="sourcePath" clearable allow-create filterable placeholder="JSONpathを入力もしくは予約語を選択">
            <el-option value="$hash" label="ハッシュ値"/>
            <el-option value="$his_id" label="カルテ番号"/>
            <el-option value="$name" label="患者名"/>
          </el-select>
          <el-tooltip placement="top-end" content="入力されたJSONパスをハイライトします.">
            <el-button :icon="Aim" type="primary" circle @click="highlight()"/>
          </el-tooltip>
        </div>
      </div>
      <div class="source-block-subpath">
        <div>
          サブパス:
        </div>
        <div>
          <el-input v-model="sourceSubPath" :disabled="disableSubpath"/>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, WritableComputedRef, computed } from 'vue'
import { Aim } from '@element-plus/icons-vue'
import { useStore } from './store'
import { SourceBlock } from './types'
import { ElMessageBox } from 'element-plus'

const store = useStore()

const reservedWords = [
  '$hash',
  '$his_id',
  '$name'
]

const props = defineProps<{
  index: number,
  block: SourceBlock
}>()

const emits = defineEmits<{
  (e:'updateblock', index: number, value: SourceBlock): void
}>()

const disableSubpath = computed(() => reservedWords.indexOf(props.block.path) !== -1)

const sourcePath :WritableComputedRef<string> = computed({
  get: () => props.block.path || '',
  set: (newPath: string) => emits('updateblock', props.index, Object.assign(props.block, { path: newPath }))
})

const sourceSubPath :WritableComputedRef<string> = computed({
  get: () => disableSubpath.value ? '' : (props.block.subpath || ''),
  set: (newPath: string) => emits('updateblock', props.index, Object.assign(props.block, { subpath: newPath }))
})

/**
 * highlight JSONビューアのハイライトの有無を切り替える(トグル動作)
 */
function highlight (disable = false) {
  if (
    !disable &&
    !disableSubpath.value &&
    sourcePath.value !== '' &&
    store.state.HighlightedPath !== sourcePath.value
  ) {
    store.commit('setHighlight', sourcePath.value)
  } else {
    store.commit('setHighlight', '')
  }
}

/**
 * previewSource ソースの値のプレビューを表示する
 */
function previewSource (): void {
  if (store.getters.documentLength > 0) {
    let result = ''
    switch (sourcePath.value) {
      case '$hash':
        result = JSON.stringify(store.getters.documentRef()?.hash || 'N/A')
        break
      case '$his_id':
        result = JSON.stringify(store.getters.documentRef()?.his_id || 'N/A')
        break
      case '$name':
        result = JSON.stringify(store.getters.documentRef()?.name || 'N/A')
        break
      default:
        result = JSON.stringify(store.getters.parseJesgoDocument(sourcePath.value))
    }

    ElMessageBox({
      message: h('div', null, [
        h('p', 'ソースの結果は'),
        h('span', `${result}`),
        h('p', 'です.')
      ])
    })
  } else {
    ElMessageBox.alert('JSONドキュメントがありません.')
  }
}
</script>

<style>
div.source-block {
  display: flex;
  flex-direction: row;
  width: 100%;
  padding: 0.3rem 0;
  border: 1px #444444 solid;
  border-radius: 0.3rem;
  margin-bottom: 0.2rem;
}

div.source-block-index {
  display: block;
  justify-content: center;
  align-items: center;
  width: 5.8rem;
  margin: auto;
}

div.source-block-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

div.source-block-content > div {
  display: flex;
  flex-direction: row;
}

div.source-block-content > div > div:nth-child(1) {
  display: block;
  width: 7rem;
}

div.source-block-content > div > div:nth-child(2) {
  display: block;
  width: 100%;
}

.source-block-path .el-select {
  width: 25rem;
}
</style>
