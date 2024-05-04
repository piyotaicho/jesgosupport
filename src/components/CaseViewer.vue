<template>
  <div class="case-viewer">
    <CaseNavigation
      :index="index"
      :length="maxIndex"
      :apply="applyQuery"
      @update:index="updateIndex($event)"
      @update:apply="applyQuery = $event"
      @loadJson="loadJsonDocument">
    </CaseNavigation>
    <div class="case-viewer-identifiers">
      <el-row>
        <el-col :span="5"><span>$hash: </span></el-col>
        <el-col :span="19"><span>{{ caseHash }}</span></el-col>
      </el-row>
      <el-row>
        <el-col :span="5"><span>$his_id: </span></el-col>
        <el-col :span="19"><span>{{ caseId }}</span></el-col>
      </el-row>
      <el-row>
        <el-col :span="5"><span>$name: </span></el-col>
        <el-col :span="19"><span>{{ caseName }}</span></el-col>
      </el-row>
      <el-row @click="copytoClipboard">
        <el-col :span="8">
          <span>強調表示パス<el-icon><CopyDocument /></el-icon>: </span>
        </el-col>
        <el-col :span="16"><span>{{ store.getters.highLightedPath }}</span></el-col>
      </el-row>
    </div>
    <JsonViewer :json="caseDocumentList"></JsonViewer>
  </div>
</template>

<script setup lang="ts">
import { computed, ComputedRef } from 'vue'
import { useStore } from './store'
import { ElMessageBox } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
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

const applyQuery = computed({
  get: () => store.getters.applyQuery,
  set: (value) => store.commit('setApplyQuery', value)

})

const index = computed({
  get: () => store.getters.caseIndex,
  set: (value) => store.commit('setIndex', value)
})

/**
 * maxIndex 表示するドキュメントの症例数
 */
const maxIndex = computed(() => store.getters.documentLength)

/**
 * indexで指定されたレコードドキュメント
 * @returns {JsonObject} ドキュメントが空白の場合は空オブジェクトを返す
 */
const caseDocument: ComputedRef<JsonObject> = computed(() => store.getters.displayDocument[index.value])

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
const caseDocumentList: ComputedRef<JsonObject> = computed(() => store.getters.jesgodocument(index.value))

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
  const highLightedPath = store.getters.highLightedPath
  if (highLightedPath !== '') {
    await navigator.clipboard.writeText(highLightedPath)
  }
}

/**
 * loadJsonDocument FILE APIで読み込んだJSONファイルをJSONドキュメントとして保存
 * @param {Event} HTMLイベントオブジェクト
 */
async function loadJsonDocument () {
  try {
    const content = await loadFile()

    if (content) {
      const loadedDocument = JSON.parse(content as string) as JsonObject
      if (Array.isArray(loadedDocument) && loadedDocument[0]?.documentList) {
        store.commit('setJsonDocument', loadedDocument)
        index.value = 0
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
