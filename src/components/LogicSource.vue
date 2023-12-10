<template>
  <div class="source-block">
    <el-row :gutter="20" justify="space-between">
      <el-col :span="4">
        <div class="source-block-left" @click="previewSource">
          <el-tooltip placement="top-start" content="クリックでソースをプレビューします.">
            <span>ソース {{ props.index + 1 }}</span>
          </el-tooltip>
          <div>
            <el-button :icon="View" type="primary" circle :disabled="sourcePath === ''"/>
          </div>
        </div>
      </el-col>

      <el-col :span="20">
        <el-row :gutter="0">
          <el-col :span="4" style="margin-top: 0.35rem;">パス:</el-col>
          <el-col :span="16">
            <DropdownCombo v-model.lazy.trim="sourcePath" clearable placeholder="JSONpathを入力もしくは予約語を選択" style="width: 90%; margin-right: 0.5rem;">
              <el-option value="$hash" label="ハッシュ値"/>
              <el-option value="$his_id" label="カルテ番号"/>
              <el-option value="$name" label="患者名"/>
              <el-option value="$date_of_birth" label="生年月日"/>
              <el-option value="$highlight" label="強調表示のパスを引用" />
            </DropdownCombo>
          </el-col>
          <el-col :span="3">
            <el-tooltip placement="top-end" content="入力されたJSONパスをハイライトします.">
              <el-button :icon="Aim" type="primary" circle @click="highlight()" :disabled="disableHighlight"/>
            </el-tooltip>
          </el-col>
        </el-row>

        <el-row>
          <el-col :span="4" style="margin-top: 0.35rem;">サブパス</el-col>
          <el-col :span="19">
            <el-input v-model.lazy.trim="sourceSubPath" clearable placeholder="パスの結果に対するJSONpathを入力" :disabled="disableSubpath"/>
          </el-col>
        </el-row>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { h, WritableComputedRef, computed } from 'vue'
import { Aim, View } from '@element-plus/icons-vue'
import { useStore } from './store'
import { SourceBlock } from './types'
import { ElMessageBox } from 'element-plus'
import DropdownCombo from './DropdownCombo.vue'

const store = useStore()

const reservedWords = [
  '$hash',
  '$his_id',
  '$name',
  '$date_of_birth'
]

const props = defineProps<{
  index: number,
  block: SourceBlock
}>()

const emits = defineEmits<{
  (e:'updateblock', index: number, value: SourceBlock): void
}>()

const disableSubpath = computed(() => reservedWords.indexOf(props.block.path) !== -1)
const disableHighlight = computed(() => ['', ...reservedWords].indexOf(sourcePath.value) !== -1)

const sourcePath :WritableComputedRef<string> = computed({
  get: () => props.block.path || '',
  set: (newPath: string) => {
    if (newPath !== '$highlight') {
      emits('updateblock', props.index, Object.assign(props.block, { path: newPath }))
    } else {
      emits('updateblock', props.index, Object.assign(props.block, { path: store.getters.highLightedPath }))
    }
  }
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
    store.getters.highLightedPath !== sourcePath.value
  ) {
    store.commit('setHighlight', sourcePath.value)
  } else {
    store.commit('setHighlight', '')
  }
}

/**
 * previewSource ソースの値のプレビューを表示する
 */
async function previewSource (): Promise<void> {
  if (store.getters.documentLength > 0 && sourcePath.value) {
    let result = ''
    switch (sourcePath.value) {
      case '$hash':
        result = JSON.stringify(store.getters.document()?.hash || 'N/A')
        break
      case '$his_id':
        result = JSON.stringify(store.getters.document()?.his_id || 'N/A')
        break
      case '$name':
        result = JSON.stringify(store.getters.document()?.name || 'N/A')
        break
      case '$date_of_birth':
        result = JSON.stringify(store.getters.document()?.date_of_birth || 'N/A')
        break
      default:
        result = JSON.stringify(store.getters.parseJesgoDocument([sourcePath.value, sourceSubPath.value]))
    }

    try {
      await ElMessageBox({
        message: h('div', null, [
          h('p', 'ソースの抽出結果は'),
          h('span', `${result}`),
          h('p', 'です.')
        ])
      })
    } catch {
      // do nothing :)
    }
  } else {
    ElMessageBox.alert('JSONドキュメントがありません.')
  }
}
</script>

<style>
div.source-block {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  padding: 0.3rem 0.6rem;
  border: 1px #444444 solid;
  border-radius: 0.3rem;
  margin-bottom: 0.2rem;
}

div.source-block-left {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
