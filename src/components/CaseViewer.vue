<template>
  <div class="case-viewer">
    <CaseNavigation
      :index="documentState.index"
      :length="maxIndex"
      @update:index="updateIndex($event)">
    </CaseNavigation>
    <div class="case-viewer-identifiers">
      <div>
        $hash: {{ caseHash }}
      </div>
      <div>
        $his_id: {{ caseId }}
      </div>
    </div>
    <JsonViewer :json="caseDocumentList"></JsonViewer>
  </div>
</template>

<script setup lang="ts">
import { JsonObject } from './types'
import CaseNavigation from './CaseNavigation.vue'
import JsonViewer from './JsonViewer.vue'
import { reactive, computed, ComputedRef } from 'vue'

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

const maxIndex = computed(() => {
  if (Array.isArray(props.json)) {
    return props.json.length
  } else {
    return 0
  }
})

const caseDocument: ComputedRef<JsonObject> = computed(() => {
  if (props.json && maxIndex.value > 0 && documentState.index >= 0) {
    return (props.json as object[])[documentState.index]
  } else {
    return {}
  }
})

const caseHash: ComputedRef<string> = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (caseDocument.value as jesgoOutput)?.hash || 'N.A.'
})

const caseId: ComputedRef<string> = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (caseDocument.value as jesgoOutput)?.his_id || 'N.A.'
})

const caseDocumentList: ComputedRef<JsonObject> = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentLists = (caseDocument.value as any)?.documentList as JsonObject[] || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return documentLists.filter(element => (element as any)?.患者台帳)
})

const documentState = reactive({
  // ドキュメントのJSONpathにおいて症例区切りとなるarrayへのポインタ
  basePath: '/',
  // ナビゲーション
  index: -1
})

function updateIndex (value: number) :void {
  if (value >= 0 || value < maxIndex.value) {
    documentState.index = value
  }
}

</script>

<style>
div.case-viewer {
  border: 1px solid cyan;
  display: flex;
  flex-direction: column;
  height: 90%;
}

div.case-viewer-identifiers {
  display: flex;
  flex-direction: column;
}

div.case-viewer-identifiers div {
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
