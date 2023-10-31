import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, updateDocument, setterPluginArgument } from './types'
import { showModalDialog, createElementFromHtml } from './modal-dialog'
import { dialogHTML } from './jesgo-support-runtime-ui'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { processor } from '../../src/components/processor'
import { unparse as papaUnparse } from 'papaparse'
import { LogicRule } from '../../src/components/types'
import { tr } from 'element-plus/es/locale'

type ScriptTypeFormat = 'loadscript'|'CC'|'EM'|'OV'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: 'JESGO-supportランタイム',
    plugin_version: '0.1',
    all_patient: true,
    attach_patient_info: true,
    show_upload_dialog: false,
    update_db: true,
    target_schema_id_string: '',
    explain: 'JESGOsupport(version <1.0)で作成されたスクリプトを実行してCSVファイルを作成、エラーを書き戻します.'
  }
}

/**
 * プラグインmainルーチン
 * @param docData
 *  - 取得系 症例リスト
 *  - 更新系(uploadなし) 表示されている全てのドキュメント
 *  - 更新系(uploadあり) uploadされたデータ
 * @param apicall APIcallback
 * @returns
 *  - 取得系 ビューアに渡すデータ(JSON, array or string)
 *  - 取得系 void
 */
export async function main (docData: setterPluginArgument[], apicall: (docData: getterPluginArgument|updateDocument|updateDocument[], mode: boolean) => string): Promise<mainOutput> {
  // 更新モードなのでdocDataには表示されている全てのドキュメントが入っている
  const getterAPIcall = (request: getterPluginArgument) => apicall(request, true)
  const setterAPIcall = (request: updateDocument[]) => apicall(request, false)

  if (docData) {
    // 実際の処理へ handlerはちゃんと処理したらupdateDocumentを返す
    const values: unknown = await handler(docData, getterAPIcall)
    verbose('handler returnd', values)

    // APIで返り値ドキュメントを処理(書き戻しモード)
    if (values && Array.isArray(values) && values.length > 0) {
      const updateValues = values as updateDocument[]
      await setterAPIcall(updateValues)
    }
  }
  return undefined
}

export async function finalize (): Promise<void> {
  // NOP
}

/**
 * メッセージログとデータダンプを表示
 * @param message
 * @param item
 */
function verbose (message = '', item:unknown) {
  if (message !== '') {
    console.log(message)
  }
  console.dir(item)
}

/**
 * saveCSV dataURLを使ってファイルにダウンロードさせる(CSV専用)
 * @param data CSVテーブルの2次元配列
 */
function saveCSV (data:unknown[]) {
  if (data && Array.isArray(data) && data.length > 0) {
    const blob = new Blob([
      papaUnparse(
        data,
        {
          header: false,
          delimiter: ',',
          quoteChar: '"'
        }
      )
    ], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchorElement = document.createElement('A') as HTMLAnchorElement
    anchorElement.href = url
    anchorElement.download = 'JESGO出力データ.csv'
    anchorElement.click()
  }
}

/**
 * JESGOドキュメントから jesgo:document_id の値を抽出する
 * @param documentList
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDocumentId (documentList: any[], extractType: ScriptTypeFormat = 'loadscript'): number {
  const translation = {
    CC: '子宮頸がん',
    EM: '子宮体がん',
    OV: '卵巣がん'
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractFromDaicho = (daicho:any) => {
    if (extractType === 'loadscript') {
      return daicho['jesgo:document_id'] || -1
    }
    if (daicho?.がん種 && daicho.がん種 === translation[extractType]) {
      return daicho['jesgo:document_id'] || -1
    }
  }

  let documentId = -1
  if (documentList.length > 0) {
    for (const documentPart of documentList) {
      if (documentPart?.患者台帳) {
        if (Array.isArray(documentPart.患者台帳)) {
          for (const daicho of documentPart.患者台帳) {
            documentId = extractFromDaicho(daicho)
            if (documentId !== -1) {
              break
            }
          }
        } else {
          documentId = extractFromDaicho(documentPart.患者台帳)
        }
      } else {
        if (typeof documentPart === 'object') {
          if (Array.isArray(documentPart)) {
            documentId = extractDocumentId(documentPart)
          } else {
            documentId = documentPart['jesgo:document_id'] || -1
          }
        }
      }
      if (documentId !== -1) {
        break
      }
    }
  }
  return documentId
}

/**
 * 実行ハンドラ
 * @param APIからの返り値
 * @param getterAPIcall 取得系API
 * @returns 更新系APIに渡す更新オブジェクトの配列
 */
async function handler (data: setterPluginArgument[], getterAPIcall?: (arg: getterPluginArgument) => string): Promise<updateDocument[]|undefined> {
  // データ無し
  const dataLength = data.length
  if (dataLength === 0) {
    return undefined
  }

  // ダイアログの表示
  const createDialogContent = (parent:Element) => parent.appendChild(createElementFromHtml(dialogHTML))

  // ダイアログ内での処理
  let script: unknown[] = []
  const csvBuffer: string[][] = []

  type typeErrorBuffer = {
    // eslint-disable-next-line camelcase
    his_id?: string
    hash?: string
    documentId?: number
    errors: string[]
  }
  const errorBuffer:typeErrorBuffer[] = []

  let scriptType:ScriptTypeFormat = 'loadscript'

  // 実行ボタンのイベントハンドラ - スクリプトのロード
  const loadScriptByRunButton = async (): Promise<string> => {
    // selectの判定
    const scriptSelection = document.getElementById('plugin-selection-mode') as HTMLSelectElement

    if (!scriptSelection) {
      // DOM展開エラーかしら？
      return ''
    }
    scriptType = scriptSelection.value as ScriptTypeFormat

    verbose('loadScroptByRunButton:', `Script type : ${scriptType}`)

    switch (scriptType) {
      case 'loadscript':
        // input type="file" を発火させてスクリプトを取得する
        return await new Promise((resolve) => {
          const inputFile = document.createElement('input') as HTMLInputElement
          inputFile.type = 'file'

          // FileReaderをセットアップ
          const reader = new FileReader()
          reader.addEventListener('load', () => {
            verbose('FileReader loaded:', reader.result)
            resolve(reader.result as string)
          },
          {
            once: true
          })

          // input type="file"のセットアップ
          const changeEvent = () => {
            const files = inputFile.files
            if (files && files.length > 0) {
              verbose('Invoke FileReader', files[0])
              reader.readAsText(files[0])
            }
          }
          const cancelEvent = () => {
            verbose('InputFile:', 'dialog cancelled.')
            inputFile.removeEventListener('change', changeEvent)
            resolve('')
          }

          inputFile.addEventListener('change', changeEvent, { once: true })
          inputFile.addEventListener('cancel', cancelEvent, { once: true })

          // inputFile発火
          inputFile.click()
        })
      case 'CC':
        // 未実装
        return ''
      case 'EM':
        // 未実装
        return ''
      case 'OV':
        // 未実装
        return ''
      default:
        return ''
    }
  }

  // ダイアログボタンイベント
  const loadScript = async () => await new Promise<unknown[]>(resolve => {
    // DOMイベントを設定
    const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
    if (runButton) {
      runButton.addEventListener('click', async () => {
        const JSONstring = await loadScriptByRunButton()
        verbose('Script loaded as string', JSONstring)
        if (JSONstring !== '') {
          try {
            resolve(JSON.parse(JSONstring))
          } catch (e) {
            window.alert('スクリプトが正しいJSONフォーマットではありません.')
          }
        } else {
          script.splice(0, script.length)
        }
      })
    }
  })

  // ダイアログのスクリプト
  const dialogProcedure = async () => {
    // ページのセットアップ
    const dialogPage1 = document.getElementById('plugin-settings')
    const dialogPage2 = document.getElementById('plugin-processing')
    if (!dialogPage1 || !dialogPage2) {
      window.alert('DOMエラーです')
      throw new Error('DOM ERROR')
    }
    // dialogPage1.style.display = 'none'
    dialogPage2.style.display = 'none'

    // ページ1 - スクリプトのロード
    dialogPage1.style.display = ''

    script = await loadScript()

    verbose('Loaded script', script)

    if (script.length === 0) {
      window.alert('スクリプトがロードされませんでした、プラグインの処理を終了します.')

      const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
      if (runButton) {
        runButton.disabled = true
      }
      return
    }

    // 取得ドキュメントリストの整理
    const targets:getterPluginArgument[] = []
    let targetSchemaIdString = ''

    // 抽出する台帳スキーマの指定
    // プラグイン全般は全ドキュメントをパックして取得する
    switch (scriptType) {
      case 'CC':
        targetSchemaIdString = '/schema/CC/root'
        break
      case 'EM':
        targetSchemaIdString = '/schema/EM/root'
        break
      case 'OV':
        targetSchemaIdString = '/schema/OV/root'
        break
    }

    for (let index = 0; index < dataLength; index++) {
      if (targets.map(item => item.caseList[0].case_id).indexOf(data[index].case_id) < 0) {
        const schemaIdString = data[index].schema_id
        if (targetSchemaIdString === '') {
          // スクリプトロードの場合はドキュメント全てを取得
          targets.push({
            caseList: [{
              case_id: data[index].case_id
            }],
            targetDocument: 0
          })
        } else {
          // 台帳指定は台帳のみ取得
          const schemaIdStringArray:string[] = schemaIdString.split('/')
          const targetSchemaIdStringArray:string[] = targetSchemaIdString.split('/')

          let compareIndex = 0
          for (; compareIndex < targetSchemaIdStringArray.length; compareIndex++) {
            if (schemaIdStringArray[compareIndex] !== targetSchemaIdStringArray[compareIndex]) {
              break
            }
          }
          if (compareIndex === targetSchemaIdStringArray.length) {
            targets.push({
              caseList: [{
                case_id: data[index].case_id
              }],
              targetDocument: data[index].document_id
            })
          }
        }
      }
    }

    verbose('Documents are followings:', targets)

    // ページ2 - セットアップ
    dialogPage1.style.display = 'none'
    dialogPage2.style.display = ''

    // イベントハンドラ
    const downloadButton = document.getElementById('plugin-download') as HTMLButtonElement
    downloadButton.addEventListener('click', () => {
      if (csvBuffer.length > 0) {
        saveCSV(csvBuffer)
      }
    })

    // サポートツールの言語バージョンチェック
    type scriptHeader = {
      scriptVersion: string
    }
    let scriptVersion = '0'
    if ((script[0] as scriptHeader)?.scriptVersion) {
      const scriptVersionString = (script[0] as scriptHeader).scriptVersion
      scriptVersion = scriptVersionString.substring(0, (scriptVersionString + ' ').indexOf(' ')).split('.')[0]

      script.shift()
    }

    verbose('Script vaersion is', scriptVersion)

    // 2ページ目のDOM取得
    const statusline1 = document.getElementById('plugin-statusline1') as HTMLSpanElement
    const statusline2 = document.getElementById('plugin-statusline2') as HTMLSpanElement
    const progressbar = document.getElementById('plugin-progressbar') as HTMLDivElement
    const statusline3 = document.getElementById('plugin-statusline3') as HTMLSpanElement

    // 症例数ステータスの更新
    if (statusline1) {
      statusline1.innerText = `対象症例数は ${targets.length} 症例です.`
    }

    if (progressbar) {
      progressbar.style.width = '0%'
    }

    // データの逐次処理
    for (let index = 0; index < targets.length; index++) {
      // プログレスバーの更新
      progressbar.style.width = `${(Number(index) + 1) / targets.length}%`

      // ドキュメントの取得
      const documentId = targets[index].targetDocument
      const caseData:pulledDocument[] = getterAPIcall ? JSON.parse(await getterAPIcall(targets[index])) : []

      if (!Array.isArray(caseData)) {
        continue
      }
      verbose(`Process document ${documentId}:`, caseData[0])

      // 言語処理プロセッサの起動
      type processorOutputFormat = {
        csv: string[]
        errors: string[]
      }

      // const processorEvent = async (caseData: pulledDocument, script: LogicRule[]):Promise<processorOutputFormat|undefined> => new Promise((resolve) => {
      //   setTimeout(() => {
      //     // まだスクリプトバージョンは0しかない
      //     if (scriptVersion >= '0') {
      //       resolve(processor(caseData, script))
      //     }
      //   },
      //   0)
      // })
      const result = await new Promise<processorOutputFormat|undefined>(resolve => {
        if (scriptVersion >= '0') {
          setTimeout(async () => {
            const processorResult = await processor(caseData[0], script as LogicRule[])
            resolve(processorResult)
          }, 0)
        }
      })
      // processorEvent(caseData, script as LogicRule[])

      verbose('Process result', result)

      if (result) {
        // 結果
        if (result?.csv && result.csv.length > 0) {
          csvBuffer.push(result.csv)
        }

        // エラー
        if (result?.errors && result.errors.length > 0) {
          if (documentId !== 0) {
            errorBuffer.push({
              hash: caseData[0].hash,
              documentId: documentId,
              errors: result.errors
            })
          } else {
            const extractedDocumentId = extractDocumentId(caseData[0].documentList, scriptType)
            if (extractedDocumentId !== -1) {
              errorBuffer.push({
                hash: caseData[0].hash,
                documentId: extractedDocumentId,
                errors: result.errors
              })
            } else {
              errorBuffer.push({
                hash: caseData[0].hash,
                errors: result.errors
              })
            }
          }
        }
      }
    }

    // ステータスの更新とダウンロードの有効化
    progressbar.style.width = '100%'
    if (statusline2) {
      statusline2.innerText = '変換終了'
    }

    // CSVのデータがあればダウンロードボタンをenable
    if (csvBuffer.length > 0) {
      downloadButton.disabled = false
      statusline3.style.display = ''
    }
  }

  // ダイアログでの処理へ
  await showModalDialog(createDialogContent, dialogProcedure)

  // エラーバッファーをupdateドキュメントとして返す
  const returnValue: updateDocument[] = []
  for (const errorItem of errorBuffer) {
    if (errorItem?.documentId) {
      returnValue.push(
        {
          document_id: errorItem.documentId,
          target: {
            'jesgo:error': errorItem.errors
          }
        }
      )
    }
  }
  return returnValue
}
