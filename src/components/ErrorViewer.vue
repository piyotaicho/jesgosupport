<template>
  <div class="errorViewer">
    <div class="errorViewer-button">
      <el-popover placement="right" trigger="click" :width="290">
        <template #reference>
          <el-icon>
            <Menu />
          </el-icon>
        </template>
        <div>
          <div>
            <el-button type="primary" :icon="Delete">エラー情報をクリア</el-button>
          </div>
          <div>
            <el-button type="primary" :icon="Download">エラー情報をダウンロード</el-button>
          </div>
        </div>
      </el-popover>
    </div>
    <div>
      <dl>
        <template v-for="(errorReport, index) of errorDocuments" :key="index">
          <dt>hash: {{ errorReport.hash }} <span v-if="errorReport?.type">({{ errorReport.type }})</span></dt>
          <dd v-for="(errorLine, subindex) of errorReport.errors" :key="subindex">{{ errorLine }}</dd>
        </template>
      </dl>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Menu, Delete, Download } from '@element-plus/icons-vue'
import { store } from './store'

const errorDocuments = computed(() => store.state.ErrorDocument)

</script>

<style>
div.errorViewer {
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  display: flex;
  flex-direction: row;
}

div.errorViewer-button {
  position: absolute;
  top: 0;
  padding: 4px;
  background-color: #e2e2e2;
  width: 1.2rem;
  height: 1.05rem;
}

.errorViewer dt {
  padding-top: 0.5rem;
  font-weight: bold;
}</style>
