<template>
  <div class="control-bar">
    <el-button-group>
      <el-button type="primary" @click="loadJson()">Load JSON document</el-button>
      <el-button type="primary" @click="loadCsv()">Load CSV template</el-button>
    </el-button-group>
    <el-button-group>
      <el-button type="primary" :icon="CaretTop">Load rule-set</el-button>
      <el-button type="primary" :icon="CaretBottom">Save rule-set</el-button>
    </el-button-group>
    <el-button type="primary" :icon="CaretRight">Process</el-button>

    <input type="file" ref="inputFileJson" accept="*.json" style="display: none;" @input="loadJsonFile($event)">
    <input type="file" ref="inputFileCsv" accept="*.csv" style="display: none;" @input="loadCsvFile($event)">
  </div>
</template>

<script setup lang="ts">
import { CsvObject, JsonObject } from './types'
import { CaretTop, CaretBottom, CaretRight } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { useStore } from './store'

const store = useStore()
const inputFileJson = ref()
const inputFileCsv = ref()

/**
 * loadJson inputFileJsonへのclickイベント発火
 */
function loadJson ():void {
  inputFileJson.value.click()
}

/**
 * loadJsonFile FILE APIで読み込まれたJSONファイルをパース
 * @param {Event} HTMLイベントオブジェクト
 */
async function loadJsonFile (event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const files = target.files as FileList
  if (files.length > 0) {
    const reader = new FileReader()
    await new Promise((resolve, reject) => {
      try {
        reader.onload = () => resolve(reader.result)
        reader.readAsText(files[0])
      } catch (e) {
        window.alert('指定されたファイルにアクセスできません.')
        reject(e)
      }
    }).then(async content => {
      if (content) {
        store.commit('setJsonDocument', JSON.parse(content as string) as JsonObject)
      }
    })
  }
}

/**
 * loadCsv inputFileCsvへのclickイベント発火
 */
function loadCsv ():void {
  inputFileCsv.value.click()
}

/**
 * loadCsvFile FILE APIで読み込まれたCSVファイルをパース
 * @param {Event} HTMLイベントオブジェクト
 */
async function loadCsvFile (event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const files = target.files as FileList
  if (files.length > 0) {
    const reader = new FileReader()
    await new Promise((resolve, reject) => {
      try {
        reader.onload = () => resolve(reader.result)
        reader.readAsText(files[0])
      } catch (e) {
        window.alert('指定されたファイルにアクセスできません.')
        reject(e)
      }
    }).then(async content => {
      store.commit('setCsvDocument', parseCSV(content as string))
    })
  }
}

function parseCSV (content: string): CsvObject|undefined {
  if (!content) return undefined

  // 改行コードを確認して切り出し
  const newline:string = (content.indexOf('\r\n') < 0) ? (content.indexOf('\r') < 0 ? '\n' : '\r') : '\r\n'
  const lines:string[] = content.split(newline)

  // CSVのパース
  const rows:string[][] = []
  const columncounts: object = {}
  for (const line of lines) {
    const row:string[] = []
    if (line.length === 0) {
      // 空白行はスキップ
      continue
    }

    for (let start = 0; start < line.length; start++) {
      let end:number
      if (line.charAt(start) === '"') {
        // ダブルクォートでのクオートあり：閉じを検索
        for (end = start + 1; end < line.length; end++) {
          end = ((end = line.indexOf('"', end)) < 0) ? line.length : end
          if (line.charAt(++end) !== '"') {
            // CSVでは " は "" にエスケープされる、クオートのエスケープでなければ切り出し
            break
          }
        }
        row.push(line.substring(start + 1, end - 1).replace(/""/g, '"').trim())
      } else {
        // クオート無し カンマを探す
        end = (end = line.indexOf(',', start)) < 0 ? line.length : end
        row.push(line.substring(start, end).trim())
      }
      start = end
    }

    if (line.charAt(line.length - 1) === ',') {
      // 最終フィールドに割り当てがないにもかかわらず , が入力されるExcelのBroken CSVに対応
      row.push('')
    }
    rows.push(row)

    // コラム数をdictionaryに収納
    Object.assign(columncounts, { [row.length]: null })
  }
  if (Object.keys(columncounts).length > 1) {
    // コラム数が複数存在する場合エラーとして扱う
    throw new Error('ファイルのレコード中のフィールド数が一定ではありません.不正なCSVファイルです.')
  }
  return (rows)
}

</script>

<style>
div.control-bar {
  border: 1px solid cyan;
  display: flex;
  justify-content: space-around;
}
</style>
