<template>
  <div class="source-block">
    <el-row :gutter="20" justify="space-between">
      <el-col :span="4">
        <div class="source-block-left">
          <div>
            <span>ソース {{ props.index + 1 }}</span>
          </div>
        </div>
      </el-col>

      <el-col :span="20">
        <el-row :gutter="0">
          <el-col :span="4" style="margin-top: 0.35rem;">パス:</el-col>
          <el-col :span="15">
            <DropdownCombo v-model.lazy.trim="sourcePath" clearable placeholder="JSONpathを入力もしくは予約語を選択">
              <el-option value="$hash" label="ハッシュ値"/>
              <el-option value="$his_id" label="カルテ番号"/>
              <el-option value="$name" label="患者名"/>
              <el-option value="$date_of_birth" label="生年月日"/>
              <el-option value="$highlight" label="強調表示のパスを引用" />
            </DropdownCombo>
          </el-col>
          <el-col :span="4" :offset="1">
            <el-button-group>
              <el-tooltip  placement="bottom" content="パスの結果をプレビューします." :show-after="500">
                <el-button :icon="View" type="primary" circle  @click="previewSource()" :disabled="sourcePath === ''"/>
              </el-tooltip>
              <el-tooltip  placement="bottom" content="入力されたJSONパスをハイライトします." :show-after="500">
                <el-button :icon="Aim" type="primary" circle @click="highlight()" :disabled="disableHighlight"/>
              </el-tooltip>
            </el-button-group>
          </el-col>
        </el-row>

        <el-row>
          <el-col :span="4" style="margin-top: 0.35rem;">サブパス</el-col>
          <el-col :span="15">
            <el-input v-model.lazy.trim="sourceSubPath" clearable placeholder="パスの結果に対するJSONpathを入力" :disabled="disableSubpath"/>
          </el-col>
          <el-col :span="3" :offset="1">
            <el-tooltip  placement="bottom" content="サブパスを含めた結果をプレビューします." :show-after="500">
              <el-button :icon="View" type="primary" circle  @click="previewSource(true)" :disabled="disableSubpath || sourceSubPath === ''"/>
            </el-tooltip>
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
async function previewSource (parseSubpath = false): Promise<void> {
  if (store.getters.documentLength > 0 && sourcePath.value) {
    let result:unknown[]
    switch (sourcePath.value) {
      case '$hash':
        result = [store.getters.document()?.hash || 'N/A']
        break
      case '$his_id':
        result = [store.getters.document()?.his_id || 'N/A']
        break
      case '$name':
        result = [store.getters.document()?.name || 'N/A']
        break
      case '$date_of_birth':
        result = [store.getters.document()?.date_of_birth || 'N/A']
        break
      default:
        if (parseSubpath) {
          result = store.getters.parseJesgoDocument([sourcePath.value, sourceSubPath.value])
        } else {
          result = store.getters.parseJesgoDocument([sourcePath.value])
        }
    }

    try {
      const dumpString = (result.length > 1 || result.findIndex(item => typeof item === 'object') >= 0)
        ? JSON.stringify(result, undefined, '  ')
        : JSON.stringify(result)
      await ElMessageBox({
        message: h('div', {
          style: 'white-space: pre; overflow-wrap: anywhere;'
        }, [
          h('p', 'ソースの抽出結果は'),
          h('div', {
            style: 'max-height: 80vh; padding: 0.2rem 0; background: #eee; overflow-x: auto; overflow-y: auto;'
          },
          h('span', dumpString)),
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
  justify-content: center;
  height: 100%;
}
</style>
