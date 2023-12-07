<template>
  <div class="app_box">
    <el-container>
      <el-header height="36px"><ControlBar/></el-header>
      <el-main>
        <div class="panes">
          <Splitpanes horizontal :dblClickSplitter="false" class="default-theme pane-root">
            <Pane size="10">
              <CsvViewer :csv="CsvDocument"></CsvViewer>
            </Pane>
            <Pane size="10">
              <ErrorViewer />
            </Pane>
            <Pane size="80">
              <Splitpanes :dblClickSplitter="false" class="default-theme">
                <Pane size="45">
                  <CaseViewer :json="JsonDocument"></CaseViewer>
                </Pane>
                <Pane size="55">
                  <LogicSection></LogicSection>
                </Pane>
              </Splitpanes>
            </Pane>
          </Splitpanes>
        </div>
      </el-main>
      <el-footer height="16px"><FooterCopyrights /></el-footer>
    </el-container>
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
body {
  margin: 0;
  overflow: hidden;
}

div.app_box {
  display: flex;
  position: absolute;
  top: 0;
  left: 0.8rem;
  bottom: 0;
  right: 0.8rem;
  flex-direction: column;
  overflow: hidden;
}

.clickable :hover {
  cursor: pointer;
}

div.panes {
  height: 100%;
  flex: 1;
}

.pane-root {
  width: 100%;
}

.el-main {
  margin: 0;
  padding: 0;
}
</style>
