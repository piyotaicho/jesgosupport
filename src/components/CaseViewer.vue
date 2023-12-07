<template>
  <div class="case-viewer">
    <CaseNavigation
      :index="index"
      :length="maxIndex"
      @update:index="updateIndex($event)"
      @loadJson="loadJson">
    </CaseNavigation>
    <div class="case-viewer-identifiers">
      <div>
        $hash: {{ caseHash }}
      </div>
      <div>
        $his_id: {{ caseId }}
      </div>
      <div>
        $name: {{ caseName }}
      </div>
      <div class="clickable" @click="copytoClipboard">
        <el-tooltip placement="top-start" content="クリックでJSONパスをクリップボードにコピー">
          強調表示パス: {{ store.state.HighlightedPath }}
        </el-tooltip>
      </div>
    </div>
    <JsonViewer :json="caseDocumentList"></JsonViewer>
    <input type="file" ref="inputFileJson" accept="*.json" style="display: none;" @input="loadJsonDocument($event)">
  </div>
</template>

<script setup lang="ts">
import { ref, computed, ComputedRef, watchEffect } from 'vue'
import { useStore } from './store'
import { ElMessageBox } from 'element-plus'
import { JsonObject } from './types'
import { loadFile } from './utilities'
import CaseNavigation from './CaseNavigation.vue'
import JsonViewer from './JsonViewer.vue'

const store = useStore()

interface jesgoOutput {
  hash: string,
  decline?: boolean,
  // eslint-disable-next-line camelcase
  his_id?: string,
  // eslint-disable-next-line camelcase
  date_of_birth?: string,
  name?: string,
  documentList: JsonObject
}

const props = defineProps<{
  json: JsonObject|undefined
}>()

const index = computed({
  get: () => store.state.currentIndex,
  set: (value) => store.commit('setIndex', value)
})

const inputFileJson = ref()

watchEffect(() => {
  // JSONドキュメントが更新されたら表示を最初のレコードに移動する
  if (props.json !== undefined && Array.isArray(props.json)) {
    index.value = props.json.length === 0 ? -1 : 0
  } else {
    index.value = -1
  }
})

/**
 * maxIndex JSONドキュメント配列の症例数
 */
const maxIndex = computed(() => {
  if (Array.isArray(props.json)) {
    return props.json.length
  } else {
    return 0
  }
})

/**
 * indexで指定されたレコードドキュメント
 * @returns {JsonObject} ドキュメントが空白の場合は空オブジェクトを返す
 */
const caseDocument: ComputedRef<JsonObject> = computed(() => store.getters.documentRef(index.value))

/**
 * @returns {string} 症例レコードのハッシュ
 */
const caseHash: ComputedRef<string> = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (caseDocument.value as jesgoOutput)?.hash || 'N.A.'
})

/**
 * @returns {string} 症例レコードにある患者ID
 */
const caseId: ComputedRef<string> = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (caseDocument.value as jesgoOutput)?.his_id || 'N.A.'
})

/**
 * @returns {string} 症例レコードにある患者名
 */
const caseName: ComputedRef<string> = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (caseDocument.value as jesgoOutput)?.name || 'N.A.'
})

/**
 * @returns {string} 症例レコードが保持するJSEGOドキュメント本体部分
 */
const caseDocumentList: ComputedRef<JsonObject> = computed(() => store.getters.jesgoDocumentRef(index.value))

/**
 * イベントハンドラ index の値を更新しハイライトを解除する
 * @param {number}
 */
function updateIndex (value: number) :void {
  if (value >= 0 || value < maxIndex.value) {
    index.value = value
    store.commit('setHighlight')
  }
}

/**
 * イベントハンドラ クリップボードにハイライトされたjsonpathをコピーする
 */
async function copytoClipboard (): Promise<void> {
  if (store.state.HighlightedPath !== '') {
    await navigator.clipboard.writeText(store.state.HighlightedPath)
  }
}

/**
 * loadJson inputFileJsonへのclickイベント発火
 */
function loadJson ():void {
  inputFileJson.value.click()
}

/**
 * loadJsonDocument FILE APIで読み込んだJSONファイルをJSONドキュメントとして保存
 * @param {Event} HTMLイベントオブジェクト
 */
async function loadJsonDocument (event: Event) {
  try {
    const content = await loadFile(event)

    if (content) {
      const loadedDocument = JSON.parse(content as string) as JsonObject
      if (Array.isArray(loadedDocument) && loadedDocument[0]?.documentList) {
        store.commit('setJsonDocument', loadedDocument)
      } else {
        throw new Error('このファイルは有効なJESGOから出力されたJSONファイルではないようです.')
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e:any) {
    ElMessageBox.alert(e.message)
  }
}

</script>

<style>
div.case-viewer {
  /* border: 1px solid cyan; */
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
}

div.case-viewer-identifiers {
  flex: initial;
  display: flex;
  flex-direction: column;
}

div.case-viewer-identifiers div {
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
