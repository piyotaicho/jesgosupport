<template>
  <div class="errorViewer">
    <div class="errorViewer-button">
      <el-popover placement="right" trigger="click" :width="204">
        <template #reference>
          <el-icon>
            <Menu />
          </el-icon>
        </template>
        <div>
          <div>
            <el-button type="primary" :icon="Delete" :disabled="disabledButtons" @click="eraseError">エラー情報をクリア</el-button>
          </div>
          <div>
            <el-button type="primary" :icon="Download" :disabled="disabledButtons" @click="saveError">エラー情報を保存</el-button>
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
import { ComputedRef, computed } from 'vue'
import { Menu, Delete, Download } from '@element-plus/icons-vue'
import { store } from './store'
import { userDownload } from './utilities'
import { ErrorObject } from './types'

const errorDocuments:ComputedRef<ErrorObject[]> = computed(() => store.getters.errorDocument)
const disabledButtons = computed(() => errorDocuments.value.length === 0)

const saveError = ():void => {
  if (errorDocuments.value.length > 0) {
    const data = JSON.stringify(errorDocuments.value.map(element => {
      return {
        hash: element.hash,
        type: element?.type || '',
        messages: element.errors
      }
    }), undefined, ' ')
    userDownload(data, 'errorreports.json')
  }
}

const eraseError = ():void => store.commit('clearErrorDocument')
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
  display: flex;
  justify-content: center;
  align-content: center;
  top: 0;
  padding: 2px;
  margin: auto auto;
  background-color: #e2e2e2;
  border: 1px solid #ccc;
  width: 1.3rem;
  height: 1.7rem;
}

.errorViewer dt {
  padding-top: 0.5rem;
  font-weight: bold;
}</style>
