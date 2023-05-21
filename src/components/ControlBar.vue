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
import { JSONPath } from 'jsonpath-plus'
import { ElMessageBox } from 'element-plus'

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
      const loadedRuleset = JSON.parse(content as string) as LogicRule[]
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
  const blob = new Blob([data], { type: 'application/json' })
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

/**
 * マクロ実行ユニット
 * @param {JsonObject} 1症例分のオブジェクト
 * @param {LogicRule[]} ルールセット配列
 * @returns {csv: string[][], errors: string[]}
 */
// eslint-disable-next-line camelcase
function processor (content: {hash?: string, his_id?: string, name?: string, documentList: JsonObject}, rules: LogicRule[]): undefined|{csv: string[], errors: string[]} {
  const hash = content?.hash || ''
  const hisid = content?.his_id || ''
  const name = content?.name || ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jesgoDocument = (content.documentList as JsonObject[]).filter(element => (element as any)?.患者台帳)

  // 結果バッファ
  const csvRow:string[] = []
  const errorMessages:string[] = []

  // ルールセットの逐次解析
  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
    const rule = rules[ruleIndex]

    console.log(`Start processing ruleset "${rule.title}".`)

    // ソースと変数はルールごとのスコープ
    const sourceValues:(string|undefined)[][] = []
    const variables:(string|undefined)[][] = [[], [], [], [], [], [], [], [], [], [], []]

    // 引数のエスケープ解析
    function parseArg (arg: string) : string[] {
      if (arg !== undefined && arg !== null) {
        if (arg.charAt(0) === '@') {
          const index = Number(arg.charAt(1)) - 1
          return sourceValues[index] as string[] || ['']
        }

        if (arg.charAt(0) === '$') {
          if (arg === '$hash') {
            return [hash]
          } else {
            const index = Number(arg.charAt(1))
            return variables[index] as string[] || ['']
          }
        }

        // カンマ区切りでの切り出し
        const regex = /("[^"\\]*(?:\\.[^"\\]*)*"|\/(?:[^/\\]+|\\.)*\/[gimy]{0,4}|[^,\s]+)/g
        return (arg.match(regex) || []).map(item => item.replace(/^"((?:\\"|[^"])*)"$/, '$1'))
      } else {
        return ['']
      }
    }

    // JSONパスで値を取得
    function parseJesgo (jsonpath: string|string[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result:any
      try {
        // jsonpathが配列の場合は[0]がメイン
        const primarypath:string = Array.isArray(jsonpath) ? jsonpath[0] : jsonpath
        result = JSONPath({
          path: primarypath,
          json: jesgoDocument
        })

        // サブパスがあれば続いて処理する
        if (Array.isArray(jsonpath) && (jsonpath[1] || '') !== '') {
          result = JSONPath({
            path: jsonpath[1],
            json: result
          })
        }
      } catch (e) {
        console.error(e)
      }
      return result
    }

    // ソースを解析
    if (rule.source) {
      for (let sourceIndex = 0; sourceIndex < rule.source.length; sourceIndex++) {
        const path = rule.source[sourceIndex as number].path || ''
        if (path !== '') {
          switch (path) {
            case '$hash':
              sourceValues.splice(sourceIndex, 1, [hash])
              break
            case '$his_id':
              sourceValues.splice(sourceIndex, 1, [hisid])
              break
            case '$name':
              sourceValues.splice(sourceIndex, 1, [name])
              break
            default:
              sourceValues.splice(sourceIndex, 1, parseJesgo(path))
          }
        }
        console.log(`Parse source[${sourceIndex}], assigned ${JSON.stringify(sourceValues[sourceIndex])}.`)
      }
    }

    // プロセス実体
    function operators (op1:string[], op1type:string, op2:string[], oper:string): boolean {
      console.log('Operator - operators')
      const op1typed = op1type === 'value' ? op1 : [op1.length.toString()]
      switch (oper) {
        case 'eq':
          // eslint-disable-next-line eqeqeq
          return op1typed[0] == op2[0]
        case 'gt':
          return op1typed[0] > op2[0]
        case 'ge':
          return op1typed[0] >= op2[0]
        case 'lt':
          return op1typed[0] < op2[0]
        case 'le':
          return op1typed[0] <= op2[0]
        case 'in':
          return op1typed.some(item => op2.includes(item))
        case 'incl':
          return op2.some(item => op1typed.includes(item))
        case 'regexp':
          console.log(`Regexpression ${op2[0]}`)
          return op1typed.some(item => RegExp(op2[0]).test(item))
        default:
          console.log(`Illegal operator "${oper}"`)
          return false
      }
    }

    function vars (op1:string[], dst:string): boolean {
      console.log('Operator - variables')
      if (dst !== '') {
        if (dst.charAt(0) === '@') {
          const index = Number(dst.charAt(1)) - 1
          sourceValues[index] = op1
          return true
        }
        if (dst.charAt(0) === '$') {
          const index = Number(dst.charAt(1))
          variables[index] = op1
          return true
        }
      }
      console.log(`Assigning vars failed to ${dst}.`)
      return false
    }

    function translator (op1:string, table:string[][]): boolean {
      console.log('Operator - translation')
      const srcvalues = parseArg(op1)
      let result = true
      for (let index = 0; index < srcvalues.length; index++) {
        let replaced = false
        for (const translation of table) {
          // 元の値が空白の場合は対処しない
          if (translation[0] !== '') {
            // 変換先 ダブルクオートを除去
            const value = translation[1].replace(/^"((?:\\"|[^"])*)"$/, '$1')

            if (/^\/(?:[^/\\]+|\\.)*\/[gimy]{0,4}$/g.test(translation[0])) {
              // 正規表現
              if (RegExp(translation[0]).test(srcvalues[index])) {
                srcvalues.splice(index, 1, value)
                replaced = true
                break
              }
            } else {
              // クオートを除去
              const pattern = translation[0].replace(/^"((?:\\"|[^"])*)"$/, '$1')
              if (srcvalues[index] === pattern) {
                srcvalues.splice(index, 1, value)
                replaced = true
                break
              }
            }
          }
        }
        if (!replaced) {
          console.log(`Translation failed: "${srcvalues[index]}" does not match translation table.`)
          result = false
        }
      }

      // 全て置換できたら元のデータを書き換える
      if (result && op1.charAt(0) === '@') {
        const index = Number(op1.charAt(1)) - 1
        sourceValues.splice(index, 1, srcvalues)
      }
      if (result && op1.charAt(0) === '$') {
        const index = Number(op1.charAt(1))
        variables.splice(index, 1, srcvalues)
      }

      return result
    }

    function assignvars (op1:string[], dst:string): boolean {
      console.log('Operator - store')

      const xlcolToNum = (col:string):number => {
        let num = 0
        for (let pos = 0; pos < col.length; pos++) {
          num *= 26
          num += col.toUpperCase().charCodeAt(pos) - 64
        }
        return num - 1
      }

      const value = op1.join(',')
      if (dst === '$error') {
        // エラーメッセージとして出力
        console.log(`Assign an error message: ${value}.`)
        errorMessages.push(value)
      } else {
        if (/^[A-Z]+$/.test(dst)) {
          // Excel風の列番号で指定
          console.log(`Assign a value ${value} into column ${dst}.`)
          const colindex = xlcolToNum(dst)
          csvRow[colindex] = value
        } else {
          // 不正な指定
          console.log(`Assign failed: illegal column name "${dst}".`)
          return false
        }
      }
      return true
    }

    // マクロを逐次実行
    for (let step = 0; step < (rule.procedure || []).length;) {
      const procedure = (rule.procedure || [])[step]
      let result = true
      const args = procedure.arguments
      switch (procedure.type) {
        case 'Operators': // 条件分岐
          result = operators(parseArg(args[0]), args[1] || 'value', parseArg(args[2]), args[3])
          break
        case 'Variables':
          vars(parseArg(args[0]), args[1])
          break
        case 'Translation':
          result = translator(args[0], procedure.lookup || [['', '']])
          break
        case 'Store':
          assignvars(parseArg(args[0]), args[1] || '$error')
      }

      // 分岐処理
      if (result) {
        // 正常終了
        if (procedure.trueBehaivior === 'Abort') {
          step = (rule.procedure || []).length // 処理ループから抜ける
        } else {
          if (typeof procedure.trueBehaivior === 'number') {
            console.log(`Proceed next ${procedure.trueBehaivior} steps.`)
            // move steps forward
            step += procedure.trueBehaivior
          }
        }
      } else {
        // eslint-disable-next-line no-labels
        if (procedure.type === 'Operators' || procedure.type === 'Translation') {
          if (procedure.falseBehaivior === 'Exit') {
            // 症例に対する処理の中止
            return undefined
          }
          if (procedure.falseBehaivior === 'Abort') {
            step = (rule.procedure || []).length // 処理ループから抜ける
          }
          if (typeof procedure.falseBehaivior === 'number') {
            // move steps forward
            step += procedure.falseBehaivior
          }
        }
      }
    }
  }

  // 返り値の処理
  return {
    csv: csvRow,
    errors: errorMessages
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
