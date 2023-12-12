import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, updateDocument, setterPluginArgument } from './types'
import { showModalDialog, createElementFromHtml } from './modal-dialog'
import { dialogHTML } from './jesgo-support-runtime-ui'
import { processor } from '../../src/components/processor'
import { unparse as papaUnparse } from 'papaparse'
import { LogicRule } from '../../src/components/types'

const version = '0.9.1'
const filename = 'jesgo-support-runtime.ts'
export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: '外部スクリプトの実行',
    plugin_version: version.split('.').slice(0, 2).join('.'),
    all_patient: true,
    attach_patient_info: true,
    show_upload_dialog: false,
    update_db: true,
    target_schema_id_string: '',
    explain: 'JESGOsupport(version <0.9)で作成されたスクリプトを実行してCSVファイルを作成、エラーを書き戻します.'
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
  console.log(`${filename}@${version} (C) 2023 by P4mohnet\nhttps://github.com/piyotaicho/jesgosupport`)

  // 更新モードなのでdocDataには表示されている全てのドキュメントが入っている
  const getterAPIcall = (request: getterPluginArgument) => apicall(request, true)
  const setterAPIcall = (request: updateDocument[]) => apicall(request, false)

  if (docData) {
    // 実際の処理へ handlerはちゃんと処理したらupdateDocumentを返す
    const values: unknown = await handler(docData, getterAPIcall)

    // APIで返り値ドキュメントを処理(書き戻しモード)
    if (values && Array.isArray(values) && values.length > 0) {
      const updateValues = values as updateDocument[]
      verbose('Update database:', updateValues)
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
 * JSONファイルをInput type="FILE"とFileReaderで読み込む
 * @returns string
 */
async function loadJSONfile (): Promise<string> {
  return await new Promise(resolve => {
    const inputFile = document.createElement('input') as HTMLInputElement
    inputFile.type = 'file'
    inputFile.accept = 'application/json'

    // FileReaderをセットアップ
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(reader.result as string)
    },
    {
      once: true
    })

    // input type="file"のセットアップ
    const changeEvent = () => {
      const files = inputFile.files
      if (files && files.length > 0) {
        reader.readAsText(files[0])
      }
    }
    const cancelEvent = () => {
      inputFile.removeEventListener('change', changeEvent)
      resolve('')
    }

    inputFile.addEventListener('change', changeEvent, { once: true })
    inputFile.addEventListener('cancel', cancelEvent, { once: true })

    // input type=file発火
    inputFile.click()
  })
}

/**
 * saveCSV dataURLを使ってファイルにダウンロードさせる(CSV専用)
 * @param data CSVテーブルの2次元配列
 */
export function saveCSV (data:unknown[], offset = 0, filename = 'JESGO出力データ.csv') {
  if (data && Array.isArray(data) && data.length > 0) {
    const offsettedData = []
    for (let count = 0; count < offset; count++) {
      offsettedData.push([])
    }
    offsettedData.push(...data)

    const blob = new Blob([
      papaUnparse(
        offsettedData,
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
    anchorElement.download = filename
    anchorElement.click()
  }
}

type ScriptTypeFormat = 'loadscript'|'CC'|'EM'|'OV'

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
export async function handler (data: setterPluginArgument[], getterAPIcall?: (arg: getterPluginArgument) => string): Promise<updateDocument[]|undefined> {
  // データ無し
  const dataLength = data.length
  if (dataLength === 0) {
    return undefined
  }

  // ダイアログの表示
  const createDialogContent = (parent:Element) => parent.appendChild(createElementFromHtml(dialogHTML.replace('$$version$$', version)))

  // ダイアログ内の変数
  type typeErrorBuffer = {
    // eslint-disable-next-line camelcase
    his_id?: string
    name?: string
    hash?: string
    documentId?: number
    errors: string[]
  }

  let script: unknown
  const csvBuffer: string[][] = []
  const errorBuffer:typeErrorBuffer[] = []
  let csvOffset = 0

  // ダイアログボタンイベント
  const loadScript = async () => await new Promise<unknown>(resolve => {
    // DOMイベントを設定
    const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
    if (runButton) {
      runButton.addEventListener('click', async () => {
        const JSONstring = await loadJSONfile()
        try {
          if (JSONstring === '') {
            throw new Error(undefined)
          }
          resolve(JSON.parse(JSONstring))
        } catch (e) {
          window.alert('スクリプトが正しいJSONフォーマットではありません.')
        }
      })
    }
  })

  // ダイアログ内処理
  const dialogProcedure = async () => {
    // ページのセットアップ
    const dialogPage1 = document.getElementById('plugin-settings')
    const dialogPage2 = document.getElementById('plugin-processing')
    if (!dialogPage1 || !dialogPage2) {
      window.alert('DOMエラーです')
      throw new Error('DOM ERROR')
    }

    dialogPage1.style.display = 'flex'
    dialogPage2.style.display = 'none'

    // ページ1 - スクリプトのロード
    script = await loadScript()

    if (!script) {
      window.alert('スクリプトがロードされませんでした、プラグインの処理を終了します.')

      const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
      if (runButton) {
        runButton.disabled = true
      }
      return
    }

    // 取得ドキュメントリストの整理
    const targets:getterPluginArgument[] = []

    for (let index = 0; index < dataLength; index++) {
      if (targets.map(item => item.caseList[0].case_id).indexOf(data[index].case_id) < 0) {
        // ドキュメント全てを取得
        targets.push({
          caseList: [{
            case_id: data[index].case_id
          }],
          targetDocument: 0
        })
      }
    }

    // ページ2 - セットアップ
    dialogPage1.style.display = 'none'
    dialogPage2.style.display = 'flex'

    // 2ページ目のDOM取得と設定
    const statusline1 = document.getElementById('plugin-statusline1') as HTMLSpanElement
    const statusline2 = document.getElementById('plugin-statusline2') as HTMLSpanElement
    const inputCsvOffset = document.getElementById('plugin-offset-value') as HTMLInputElement
    const downloadButton = document.getElementById('plugin-download') as HTMLButtonElement
    const statusline3 = document.getElementById('plugin-statusline3') as HTMLSpanElement

    if (csvOffset !== 0 && inputCsvOffset) {
      inputCsvOffset.value = csvOffset.toString()
    }

    downloadButton.addEventListener('click', () => {
      if (csvBuffer.length > 0) {
        if (csvOffset === 0) {
          csvOffset = Number(inputCsvOffset.value) || 0
        }
        saveCSV(csvBuffer, csvOffset)
      }
    })

    // サポートツール スクリプトファイルのバージョンチェック
    type newScriptFile = {
      title: string
      config?: unknown
      rules: unknown[]
    }

    let scriptVersion = '0'
    if (Array.isArray(script) && (script[0] as { title?: string })?.title) {
      // version 0 基本タイプ
      console.log('Load script version <0.9')
    } else if (
      (script as newScriptFile)?.title !== undefined &&
      (script as newScriptFile)?.rules && Array.isArray((script as newScriptFile).rules)
    ) {
      // version 0.9- 拡張タイプ
      scriptVersion = '1'
      if ((script as newScriptFile)?.config) {
        csvOffset = ((script as newScriptFile).config as { csvOffset?: number })?.csvOffset || 0
      }
      script = (script as newScriptFile).rules
    } else {
      window.alert('ロードしたファイルはスクリプトファイルではありません、プラグインの処理を終了します.')

      const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
      if (runButton) {
        runButton.disabled = true
      }
      return
    }

    // 症例数ステータスの更新
    if (statusline1 && statusline2) {
      statusline1.innerText = `抽出対象症例数は ${targets.length} 症例です.`
      statusline2.innerText = 'データを抽出・変換処理中です'
    }

    // データの逐次処理
    for (let index = 0; index < targets.length; index++) {
      const progressbar = document.getElementById('plugin-progressbar') as HTMLDivElement

      // プログレスバーの更新
      if (progressbar) {
        progressbar.style.width = `${((Number(index) + 1) * 100 / targets.length) | 0}%`
      } else {
        // ダイアログのDOMが消失した = modalがcloseされた と判断して処理を中止する
        verbose(undefined, 'Plugin-aborted by closing the dialog.')
        return
      }

      // ドキュメントの取得
      const documentId = targets[index].targetDocument
      const caseData:pulledDocument[] = getterAPIcall ? JSON.parse(await getterAPIcall(targets[index])) : []

      if (!Array.isArray(caseData)) {
        continue
      }

      // 言語処理プロセッサの起動
      type processorOutputFormat = {
        csv: string[]
        errors: string[]
      }

      const result = scriptVersion >= '0' ? (await processor(caseData[0], script as LogicRule[])) as processorOutputFormat : undefined

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
              his_id: caseData[0]?.his_id,
              name: caseData[0]?.name,
              documentId,
              errors: result.errors
            })
          } else {
            const extractedDocumentId = extractDocumentId(caseData[0].documentList, 'loadscript')
            if (extractedDocumentId !== -1) {
              errorBuffer.push({
                hash: caseData[0].hash,
                his_id: caseData[0]?.his_id,
                name: caseData[0]?.name,
                documentId: extractedDocumentId,
                errors: result.errors
              })
            } else {
              errorBuffer.push({
                hash: caseData[0].hash,
                his_id: caseData[0]?.his_id,
                name: caseData[0]?.name,
                errors: result.errors
              })
            }
          }
        }
      }
    }

    // ステータスの更新とダウンロードの有効化
    const progressbar = document.getElementById('plugin-progressbar') as HTMLDivElement
    if (progressbar) {
      progressbar.style.width = '100%'
      progressbar.innerText = ''
    }
    if (statusline1 && statusline2) {
      statusline2.innerText = '変換終了'
      statusline1.innerText = `${targets.length}症例から${csvBuffer.length}症例のデータを抽出しました.`
    }

    await new Promise<void>(resolve => setTimeout(() => {
      // CSVのデータがあればダウンロード関係をenable
      if (csvBuffer.length > 0) {
        statusline2.innerText = 'CSVファイルをダウンロードできます.'
        downloadButton.disabled = false
        if (csvOffset === 0) {
          inputCsvOffset.disabled = false
        }
      }
      // エラーがあれば閉じるでエラーが出る旨を表示
      if (errorBuffer.length > 0) {
        statusline3.style.display = ''
      }
      resolve()
    },
    500))
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
            '/jesgo:error/-': errorItem.errors
          }
        }
      )
    }
  }
  return returnValue
}
