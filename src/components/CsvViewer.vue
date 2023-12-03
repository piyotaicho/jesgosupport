<script setup lang="ts">
import { h, ref, computed } from 'vue'
import { store } from './store'
import { Menu, Delete, Download, Upload } from '@element-plus/icons-vue'
import { CsvObject } from './types'
import { ElInputNumber, ElMessageBox } from 'element-plus'
import Papa from 'papaparse'

const props = defineProps<{
  csv: CsvObject
}>()

const csvData = computed(() => {
  if (props.csv && props.csv.length > 0 && props.csv[0].length > 0) {
    const header: string[] = []
    for (let index = 0; index < props.csv[0].length; index++) {
      header.push(base26(index + 1))
    }
    return [header, ...props.csv]
  } else {
    return [[]]
  }
})

const isEmpty = computed(() => !(props.csv && props.csv.length > 0))
/**
 * CSV出力バッファのクリア
 */
const clearCsv = () => {
  store.commit('clearCsvDocument')
}

/**
 * CSV出力バッファの内容をダウンロードさせる
 */
async function saveCSV ():Promise<void> {
  if (store.state.CsvDocument.length > 0) {
    const csvOffset = ref(0)
    await ElMessageBox({
      title: 'オフセットの設定',
      message: () => h('p', null, [
        h('span', null, 'CSV出力の行オフセットを設定できます.'),
        h(ElInputNumber, {
          min: 0,
          modelValue: csvOffset.value,
          'onUpdate:modelValue': (val: number|undefined) => { csvOffset.value = Number(val) || 0 }
        })
      ])
    })

    const exportCsvDocument: CsvObject = []
    for (let i = 0; i < csvOffset.value; i++) {
      exportCsvDocument.push([])
    }
    exportCsvDocument.push(...store.state.CsvDocument)

    // 一時的DOMでダウンロード
    const blob = new Blob([
      new Uint8Array([0xEF, 0xBB, 0xBF]),
      Papa.unparse(exportCsvDocument,
        {
          header: false,
          quotes: false
        })
    ], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('download', 'result.csv')
    a.setAttribute('href', url)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
}

function base26 (value: number): string {
  let carry = value / 26 | 0
  let remain = value % 26
  if (remain === 0 && carry !== 0) {
    remain = 26
    carry--
  }
  return (remain === 0 && carry === 0) ? '' : base26(carry) + String.fromCharCode(64 + remain)
}
</script>

<template>
  <div class="csvViewer">
    <div>
      <table>
        <tr v-for="(line, lineIndex) in csvData" :key="lineIndex">
          <!-- 先頭行にメニューを配置 -->
          <template v-if="lineIndex === 0">
            <th>
              <el-popover placement="right" trigger="click" :width="290">
                <template #reference>
                  <el-icon><Menu /></el-icon>
                </template>
                <div>
                  <div>
                    <el-button type="primary" :icon="Delete" @click="clearCsv" :disabled="isEmpty">CSV出力をクリア</el-button>
                  </div>
                  <div>
                    <el-button type="primary" :icon="Upload">テンプレートCSVをアップロード</el-button>
                  </div>
                  <div>
                    <el-button type="primary" :icon="Download" @click="saveCSV" :disabled="isEmpty">CSV出力をダウンロード</el-button>
                  </div>
                </div>
              </el-popover>
            </th>
            <th v-for="(cell, columnIndex) in line" :key="columnIndex">
              {{ cell }}
            </th>
          </template>
          <template v-else>
            <th>{{ lineIndex }}</th>
            <td v-for="(cell, columnIndex) in line" :key="columnIndex">
              {{ cell }}
            </td>
          </template>
        </tr>
      </table>
    </div>
  </div>
</template>

<style>
div.csvViewer {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: auto;
}

div.csvViewer > div {
  box-sizing: content-box;
  height: 100%;
  overflow: visible;
}

div.csvViewer table {
  font-size: 0.9rem;
  border-collapse: collapse;
}

.csvViewer tr {
  height: 1.05rem;
}

.csvViewer th {
  background-color: #e2e2e2;
  font-weight: bold;
  border: 1px solid #ccc;
  min-width: 1.2rem;
  padding: 3px;
}

.csvViewer td {
  border: 1px solid #ccc;
  padding: 3px 1rem;
}

.csvViewer tr:nth-child(even) {
  background-color: #f2f2f2;
}
</style>
