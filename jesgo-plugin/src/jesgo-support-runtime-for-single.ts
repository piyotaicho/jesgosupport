import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, updateDocument, setterPluginArgument } from './types'
import { showModalDialog, createElementFromHtml } from './modal-dialog'
import { dialogHTML } from './jesgo-support-runtime-single-ui'
import { processor } from '../../src/components/processor'
import { unparse as papaUnparse } from 'papaparse'
import { LogicRule } from '../../src/components/types'

const version = '0.9.1'
export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: '外部スクリプトの実行(個別)',
    plugin_version: version.split('.').slice(0, 2).join('.'),
    all_patient: false,
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
  console.log(`jesgo-support-runtime-for-single.ts@${version} (C) 2023 by P4mohnet\nhttps://github.com/piyotaicho/jesgosupport`)

  // 更新モードなのでdocDataには表示されている全てのドキュメントが入っている
  const getterAPIcall = (request: getterPluginArgument) => apicall(request, true)
  const setterAPIcall = (request: updateDocument[]) => apicall(request, false)

  if (docData) {
    // 実際の処理へ handlerはちゃんと処理したらupdateDocumentを返す
    console.dir(docData)
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
function saveCSV (data:unknown[], offset = 0, filename = 'JESGO出力データ.csv') {
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

/**
 * JESGOドキュメントから jesgo:document_id の値を抽出する
 * @param documentList
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDocumentId (documentList: any[]): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractFromDaicho = (daicho:any) => daicho['jesgo:document_id'] || -1

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

  let script: unknown[] = []
  const csvBuffer: string[][] = []
  const errorBuffer:typeErrorBuffer[] = []
  let csvOffset = 0

  // ダイアログボタンイベント
  const loadScript = async () => await new Promise<unknown[]>(resolve => {
    // DOMイベントを設定
    const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
    if (runButton) {
      runButton.addEventListener('click', async () => {
        // スクリプトの取得
        const JSONstring = await loadJSONfile()
        try {
          if (JSONstring === '') {
            throw new Error(undefined)
          }
          resolve(JSON.parse(JSONstring))
        } catch (e) {
          window.alert('指定のスクリプトが正しいJSONフォーマットではありません.')
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

    for (let index = 0; index < dataLength; index++) {
      if (targets.map(item => item.caseList[0].case_id).indexOf(data[index].case_id) < 0) {
        targets.push({
          caseList: [{
            case_id: data[index].case_id
          }],
          targetDocument: 0
        })
      }
    }

    console.dir(targets)

    // ページ2 - セットアップ
    dialogPage1.style.display = 'none'
    dialogPage2.style.display = 'flex'

    // 2ページ目のDOM取得と設定
    const statusline1 = document.getElementById('plugin-statusline1') as HTMLSpanElement
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

    // サポートツールの言語バージョンチェック
    type scriptHeader = {
      processorVersion: string
      csvOffset?: number
    }
    let scriptVersion = '0'
    if ((script[0] as scriptHeader)?.processorVersion) {
      const scriptHeaderValue = script[0] as scriptHeader
      const scriptVersionString = scriptHeaderValue.processorVersion
      scriptVersion = scriptVersionString.substring(0, (scriptVersionString + ' ').indexOf(' ')).split('.')[0]

      if (scriptHeaderValue?.csvOffset !== undefined) {
        csvOffset = scriptHeaderValue.csvOffset || 0
      }
      // splice scriptHeader
      script.shift()
    }

    // 症例数ステータスの更新
    if (statusline1) {
      statusline1.innerText = 'ドキュメントを変換中です.'
    }

    // プロセッサコールをラップ
    type processorOutputFormat = {
      csv: string[]
      errors: string[]
    }
    let processorCall
    if (scriptVersion >= '0') {
      processorCall = async (caseData: pulledDocument) => await processor(caseData, script as LogicRule[]) as processorOutputFormat
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      processorCall = async (_:unknown) => undefined
    }

    // データの逐次処理
    for (let index = 0; index < targets.length; index++) {
      if (!document.getElementById('plugin-dialog-content-top')) {
        // ダイアログのDOMが消失した = modalがcloseされた と判断して処理を中止する
        verbose(undefined, 'Plugin-aborted by closing the dialog.')
        return
      }

      // ドキュメントの取得
      const documentId = targets[index].targetDocument
      const caseData:pulledDocument[] = getterAPIcall ? JSON.parse(await getterAPIcall(targets[index])) : []

      console.dir(caseData)

      if (!Array.isArray(caseData)) {
        continue
      }

      // 言語処理プロセッサの起動

      const result = await processorCall(caseData[0])

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
            const extractedDocumentId = extractDocumentId(caseData[0].documentList)
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
    if (statusline1) {
      statusline1.innerText = '変換終了.'
    }

    await new Promise<void>(resolve => setTimeout(() => {
      // CSVのデータがあればダウンロード関係をenable
      if (csvBuffer.length > 0) {
        statusline1.innerText = '変換終了, CSVファイルをダウンロードできます.'
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
            '/jesgo:error': errorItem.errors
          }
        }
      )
    }
  }
  return returnValue
}
