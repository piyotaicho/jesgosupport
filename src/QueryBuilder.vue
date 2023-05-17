<template>
  <div class="app_box">
    <ControlBar/>
    <Splitpanes horizontal :class="['default-theme', 'pane-root']">
      <Pane size="10">
        <CsvViewer :csv="CsvDocument"></CsvViewer>
      </Pane>
      <Pane size="10">
        <ErrorViewer />
      </Pane>
      <Pane size="80">
        <Splitpanes style="height: 100%;" class="default-theme">
          <Pane size="50">
            <CaseViewer :json="JsonDocument"></CaseViewer>
          </Pane>
          <Pane size="50">
            <LogicSection></LogicSection>
          </Pane>
        </Splitpanes>
      </Pane>
    </Splitpanes>
    <FooterCopyrights />
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
import ErrorViewer from './components/ErrorViewer.vue'
import LogicSection from './components/LogicSection.vue'

import FooterCopyrights from './components/FooterCopyrights.vue'

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
  position: relative;
  flex-direction: column;
}

.clickable :hover {
  cursor: pointer;
}

.pane-root {
  width: 98vw; height: 94vh; margin-left: auto; margin-right: auto;
}
</style>
