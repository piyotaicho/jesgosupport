<script setup lang="ts">
import { h, ref, computed } from 'vue'
import { useStore } from './store'
import { Menu, Delete, Download, Upload } from '@element-plus/icons-vue'
import { CsvObject } from './types'
import { ElInputNumber, ElMessageBox } from 'element-plus'
import Papa from 'papaparse'
import { loadFile, userDownload } from './utilities'

const store = useStore()

const csvData = computed(() => {
  const csv = store.getters.csvDocument as CsvObject
  let header:string[]
  if (store.getters.csvHeader.length > 0) {
    // 読み込まれたヘッダ付きCSV
    header = store.getters.csvHeader || []
  } else {
    header = []
    if (csv && csv.length > 0 && csv[0].length > 0) {
      for (let index = 0; index < csv[0].length; index++) {
        header.push(base26(index + 1))
      }
    } else {
      return [[]]
    }
  }
  return [header, ...csv]
})

const isEmpty = computed(() => (store.getters.csvDocument as CsvObject).length === 0)
const disableDownload = computed(() => isEmpty.value || (store.getters.csvHeader.length > 0))

/**
 * CSV出力バッファのクリア
 */
const clearCSV = () => {
  store.commit('clearCsvDocument')
}

/**
 * CSV出力バッファの内容をダウンロードさせる
 */
async function saveCSV ():Promise<void> {
  if (store.getters.csvDocument.length > 0) {
    const csvOffset = ref(store.getters.rulesetConfig?.csvOffset || 0)
    const csvSJIS = ref(!(store.getters.rulesetConfig?.csvUnicode || false))
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
    exportCsvDocument.push(...store.getters.csvDocument)

    userDownload(
      Papa.unparse(
        exportCsvDocument,
        {
          header: false,
          quotes: false
        }
      ),
      'jesgo-support-CSV出力.csv',
      csvSJIS.value
    )
  }
}

async function loadCSV () {
  const csvFIleContent = await loadFile('.csv')

  if (csvFIleContent) {
    const hasHeader = await ElMessageBox.confirm(
      'CSVファイルの先頭行はヘッダー行ですか？',
      'CSVファイルの確認',
      {
        confirmButtonText: 'はい',
        cancelButtonText: 'いいえ',
        closeOnClickModal: false
      }
    ).then(() => true, () => false)

    const csvData = Papa.parse(csvFIleContent, { header: false }).data
    store.commit('clearCsvDocument')
    if (hasHeader) {
      store.commit('setCsvHeader', csvData[0])
      store.commit('setCsvDocument', csvData.slice(1))
    } else {
      store.commit('setCsvDocument', csvData)
    }
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
    <table><tbody>
      <tr v-for="(line, lineIndex) in csvData" :key="lineIndex">
        <!-- 先頭行にメニューを配置 -->
        <template v-if="lineIndex === 0">
          <th class="csv-menu-button">
            <el-popover placement="right" trigger="click" :width="262">
              <template #reference>
                <el-icon><Menu /></el-icon>
              </template>
              <div>
                <div>
                  <el-button type="primary" :icon="Delete" @click="clearCSV" :disabled="isEmpty">CSVをクリア</el-button>
                </div>
                <div>
                  <el-button type="primary" :icon="Upload" @click="loadCSV">テンプレートCSVを読み込み</el-button>
                </div>
                <div>
                  <el-button type="primary" :icon="Download" @click="saveCSV" :disabled="disableDownload">CSVを保存</el-button>
                </div>
              </div>
            </el-popover>
          </th>
          <th v-for="(cell, columnIndex) in line" :key="columnIndex" class="csv-header">
            {{ cell }}
          </th>
        </template>
        <template v-else>
          <th class="csv-rowindex">{{ lineIndex }}</th>
          <td v-for="(cell, columnIndex) in line" :key="columnIndex">
            {{ cell }}
          </td>
        </template>
      </tr>
    </tbody></table>
  </div>
</template>

<style>
div.csvViewer {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: auto;
}

div.csvViewer table {
  font-size: 0.9rem;
  border-spacing: 0;
}

.csvViewer tr {
  height: 1.05rem;
}

.csvViewer th {
  position: sticky;
  top: 0;
  left: 0;
  min-width: 1.2rem;
  padding: 3px;
  border-right: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  background:  #e2e2e2;
  font-weight: bold;
  white-space: nowrap;
}

.csvViewer tr:first-child th {
  border-top: 1px solid #ccc;
}

.csvViewer th:first-child {
  border-left: 1px solid #ccc;
}

.csvViewer tr:first-child th:first-child {
  z-index: 1;
}

.csvViewer td {
  background: white;
  border-right: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  padding: 3px 1rem;
}

.csvViewer tr:nth-child(even) {
  background-color: #f2f2f2;
}
</style>
