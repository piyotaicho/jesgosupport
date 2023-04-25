<template>
  <div class="app_box">
    <ControlBar/>
    <Splitpanes horizontal style="width: 100vw;">
      <Pane min-size="15" max-size="50">
        <CsvViewer :csv="CsvDocument"></CsvViewer>
      </Pane>
      <Pane>
        <Splitpanes style="height: 100%;">
          <Pane>
            <CaseViewer :json="JsonDocument"></CaseViewer>
          </Pane>
          <Pane>
            <LogicSection></LogicSection>
          </Pane>
        </Splitpanes>
      </Pane>
    </Splitpanes>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from './components/store'

import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

import ControlBar from './components/ControlBar.vue'
import CaseViewer from './components/CaseViewer.vue'
import CsvViewer from './components/CsvViewer.vue'
import LogicSection from './components/LogicSection.vue'

const store = useStore()

const JsonDocument = computed(() => {
  return store?.state?.JsonDocument
})

const CsvDocument = computed(() => {
  return store?.state?.CsvDocument
})
</script>

<style>
div.app_box {
  display: flex;
  flex-direction: column;
}

</style>
