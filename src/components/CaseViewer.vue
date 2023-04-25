<template>
  <div class="case-viewer">
    <CaseNavigation
      :index="documentState.index"
      :length="documentState.length"
      @update:index="updateIndex($event)">
    </CaseNavigation>
    <JsonViewer :json="props.json"></JsonViewer>
  </div>
</template>

<script setup lang="ts">
import { JsonObject } from './types'
import CaseNavigation from './CaseNavigation.vue'
import JsonViewer from './JsonViewer.vue'
import { reactive } from 'vue'

const props = defineProps<{
  json: JsonObject
}>()

const documentState = reactive({
  // ドキュメントのJSONpathにおいて症例区切りとなるarrayへのポインタ
  basePath: '/',
  // ナビゲーション
  index: 0,
  length: 0
})

function updateIndex (value: number) :void {
  if (value >= 0 || value < documentState.length) {
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
</style>
