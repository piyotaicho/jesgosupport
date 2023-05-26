<template>
  <div class="control-bar">
    <div>
      <el-button type="primary" :icon="CaretTop" @click="loadJson()">JESGO-JSONを読み込み</el-button>
    </div>

    <div>
      <el-button-group>
        <el-button type="primary" :icon="CaretBottom" @click="saveCSV">CSVを保存</el-button>
        <el-button type="primary" :icon="CaretBottom" @click="saveError">エラーを保存</el-button>
      </el-button-group>
    </div>

    <div>
      <el-button-group>
        <el-button type="primary" :icon="CaretTop" @click="loadRule">ルールセットを読み込み</el-button>
        <el-button type="primary" :icon="CaretBottom" @click="saveRule">ルールセットを保存</el-button>
      </el-button-group>
    </div>

    <div>
      <el-button type="primary" :icon="CaretRight" @click="performProcessing">実行</el-button>
    </div>

    <input type="file" ref="inputFileJson" accept="*.json" style="display: none;" @input="loadJsonDocument($event)">
    <input type="file" ref="inputRule" accept="*.json" style="display: none;" @input="loadRuleFile($event)">
    <!-- <input type="file" ref="inputFileCsv" accept="*.csv" style="display: none;" @input="loadCsvFile($event)"> -->
  </div>
</template>

<script setup lang="ts">
import { JsonObject, LogicRule } from './types'
import { CaretTop, CaretBottom, CaretRight } from '@element-plus/icons-vue'
import { ref } from 'vue'
import { useStore } from './store'
import Papa from 'papaparse'
import { ElMessageBox } from 'element-plus'
import { processor } from './processor'

const store = useStore()
const inputFileJson = ref()
const inputRule = ref()
// const inputFileCsv = ref()

/**
 * loadJson inputFileJsonへのclickイベント発火
 */
function loadJson ():void {
  inputFileJson.value.click()
}

/**
 * loadJson inputRuleへのclickイベント発火
 */
function loadRule ():void {
  inputRule.value.click()
}

/**
 * saveRule ルールセットのダウンロードリンクを作成
 */
function saveRule ():void {
  if (store.state.RuleSet.length > 0) {
    const data = store.getters.getRuleSetJson
    userDownload(data, 'ruleset.json')
  }
}

function saveCSV ():void {
  if (store.state.CsvDocument.length > 0) {
    const data = Papa.unparse(store.state.CsvDocument, {
      header: false,
      quotes: false
    })
    userDownload(data, 'results.csv')
  }
}

function saveError ():void {
  if (store.state.ErrorDocument.length > 0) {
    const data = JSON.stringify(store.state.ErrorDocument.map(element => {
      return {
        hash: element.hash,
        type: element?.type || '',
        messages: element.errors
      }
    }), undefined, ' ')
    userDownload(data, 'errorreports.json')
  }
}
/**
 * loadJsonDocument FILE APIで読み込んだJSONファイルをJSONドキュメントとして保存
 * @param {Event} HTMLイベントオブジェクト
 */
async function loadJsonDocument (event: Event) {
  const content = await loadJsonFile(event)
  if (content) {
    try {
      const loadedDocument = JSON.parse(content as string) as JsonObject
      if (Array.isArray(loadedDocument) && loadedDocument[0]?.documentList) {
        store.commit('setJsonDocument', loadedDocument)
      } else {
        throw new Error()
      }
    } catch {
      ElMessageBox.alert('このファイルは有効なJESGOから出力されたJSONファイルではないようです.')
    }
  }
}

/**
 * loadRuleFile FILE APIで読み込んだJSONファイルをルールセットに保存
 * @param {Event} HTMLイベントオブジェクト
 */
async function loadRuleFile (event: Event) {
  const content = await loadJsonFile(event)
  if (content) {
    try {
      // version 0.1.0のtypoを強制的に排除
      const replacedContent = (content as string).replace(/([bB])ehaivior/g, '$1ehavior')
      const loadedRuleset = JSON.parse(replacedContent) as LogicRule[]

      if (Array.isArray(loadedRuleset) && loadedRuleset[0]?.title) {
        store.commit('setRuleSet', loadedRuleset)
      } else {
        throw new Error()
      }
    } catch {
      ElMessageBox.alert('このファイルは有効なルールセットが記載されたJSONファイルではないようです.')
    }
  }
}

/**
 * loadJsonFile FILE APIで読み込まれたJSONファイルをパース
 * @param {Event} HTMLイベントオブジェクト
 */
async function loadJsonFile (event: Event): Promise<string|ArrayBuffer|null> {
  const target = event.target as HTMLInputElement
  const files = target.files as FileList
  if (files.length > 0) {
    const reader = new FileReader()
    return await new Promise((resolve) => {
      try {
        reader.onload = () => resolve(reader.result)
        reader.readAsText(files[0])
      } catch (e) {
        window.alert('指定されたファイルにアクセスできません.')
        console.error(e)
      }
    })
  }
  return null
}

/**
 * userDownload ブラウザでダウンロードさせる
 * @param {string} data
 * @param {string} filename
 */
function userDownload (data: string, filename: string): void {
  const blob = filename.includes('.json')
    ? new Blob([data], { type: 'application/json' })
    // Excelがアレ過ぎるのでCSVにはBOMをつける
    : new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), data], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.setAttribute('download', filename)
  a.setAttribute('href', url)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function performProcessing (): void {
  if (store.getters.documentLength > 0 && store.state.RuleSet.length > 0) {
    // ドキュメントとルールセットがないと実行しない
    store.commit('clearCsvDocument')
    store.commit('clearErrorDocument')
    for (let index = 0; index < store.getters.documentLength; index++) {
      processDocument(index)
    }
  }
}

function processDocument (index:number) {
  const hash = store.getters.documentRef(index)?.hash || ''

  const returnObject: {csv: string[], errors: string[]}|undefined = processor(store.getters.documentRef(index), store.state.RuleSet)

  // 処理済みデータを書き出し
  if (returnObject !== undefined) {
    const { csv: csvRow, errors: errorMessages } = returnObject
    store.commit('addCsvDocument', csvRow)
    const type = store.getters.jesgoDocumentRef(index)[0]?.患者台帳?.がん種
    console.log(type)
    store.commit('addErrorDocument', type
      ? {
          hash,
          type,
          errors: [...errorMessages]
        }
      : {
          hash,
          errors: [...errorMessages]
        }
    )
  }
}
</script>

<style>
div.control-bar {
  /* border: 1px solid cyan; */
  flex: initial;
  width: 100vw;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
}

div.control-bar > div {
  display: flexbox;
}
</style>
