import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, updateDocument, setterPluginArgument, caseList, updateGetRequest } from './types'
import { showModalDialog, createElementFromHtml } from './modal-dialog'
import { dialogHTML } from './jesgo-support-runtime-ui'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { processor } from '../../src/components/processor'
import { unparse as papaUnparse } from 'papaparse'
import { LogicRule } from '../../src/components/types'

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

export async function main (docData: setterPluginArgument[], apifunction: (docData: getterPluginArgument|updateDocument|updateDocument[], mode: boolean) => string): Promise<mainOutput> {
  if (docData) {
    // APIでドキュメントを取得(取得モード)
    const request:updateDocument[] = []
    for (const item of docData) {
      const caseId = item.case_id
      if (item.schema_id.includes('/root')) {
        if (!request.find(element => (element as updateGetRequest)?.caseList[0]?.case_id === caseId)) {
          request.push({
            caseList: [{
              case_id: caseId
            }],
            targetDocument: 0 // magic number - item.document_id
          })
        }
      }
    }

    let documents:pulledDocument[] = []
    try {
      verbose('API(GET) request', request)
      const documentJSON = await apifunction(request[0], true) // 1リクエストにつき1ドキュメントしか取得できない。対応を考える！
      verbose('API(GET) returns', documentJSON)

      documents = JSON.parse(documentJSON) as pulledDocument[]
      if (documents.length === 0) {
        throw new Error('データがありません.')
      }
    } catch (e) {
      window.alert('APIの返り値が異常です.')
      console.error(e)
      return undefined
    }

    // 実際の処理へ handlerはちゃんと処理したらupdateDocumentを返す
    const values: unknown = await handler(documents)
    verbose('handler returnd', values)

    // APIで返り値ドキュメントを処理(書き戻しモード)
    if (values && Array.isArray(values) && values.length > 0) {
      const updateValues = values as updateDocument[]
      await apifunction(updateValues, false)
    }
  }
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
 * @returns 更新系APIに渡す更新オブジェクトの配列
 */
async function handler (data: pulledDocument[]): Promise<updateDocument[]|undefined> {
  // データ無し
  if (data.length === 0) {
    return undefined
  }

  // ダイアログの表示
  const createDialogContent = (parent:Element) => parent.appendChild(createElementFromHtml(dialogHTML))

  // ダイアログ内での処理
  const script: unknown[] = []
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
    const inputFileElement = document.getElementById('plugin-input-file') as HTMLInputElement

    if (!scriptSelection || !inputFileElement) {
      // DOM展開エラーかしら？
      return ''
    }
    scriptType = scriptSelection.value as ScriptTypeFormat

    switch (scriptType) {
      case 'loadscript':
        // input type="file" を発火させてスクリプトを取得する
        return await new Promise((resolve) => {
          // FileReaderをセットアップ
          const reader = new FileReader()
          reader.addEventListener('load', () => {
            resolve(reader.result as string)
          },
          {
            once: true
          })

          // input type="file"のセットアップ
          inputFileElement.addEventListener('change', () => {
            if (inputFileElement.files) {
              const file = inputFileElement.files[0]
              reader.readAsText(file)

              // hack
              inputFileElement.value = file.name
            } else {
              // キャンセルだと思う
              resolve('')
            }
          },
          {
            once: true
          })

          inputFileElement.onchange = () => {
            // キャンセルだと思う
            resolve('')
          }

          inputFileElement.click()
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

  // ダイアログ1ページ目のスクリプト
  const loadScript = async () => await new Promise<void>(resolve => {
    // DOMイベントを設定
    const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
    if (runButton) {
      runButton.addEventListener('click', async () => {
        const JSONstring = await loadScriptByRunButton()
        if (JSONstring !== '') {
          try {
            script.splice(0, script.length, ...JSON.parse(JSONstring))
            resolve()
          } catch (e) {
            window.alert('スクリプトが正しいJSONフォーマットではありません.')
          }
        }
        script.splice(0, script.length)
      })
    }
  })

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

    await loadScript()

    if (script.length === 0) {
      window.alert('スクリプトがロードされませんでした、プラグインの処理を終了します.')

      const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
      if (runButton) {
        runButton.disabled = true
      }
    }

    dialogPage1.style.display = 'none'

    // ページ2 - 変換処理
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

    const statusline1 = document.getElementById('plugin-statusline1') as HTMLSpanElement
    const statusline2 = document.getElementById('plugin-statusline2') as HTMLSpanElement
    const progressbar = document.getElementById('plugin-progressbar') as HTMLDivElement
    const statusline3 = document.getElementById('plugin-statusline3') as HTMLSpanElement

    // 症例数ステータスの更新
    if (statusline1) {
      statusline1.innerText = `JESGOから出力された症例数は${data.length}症例です.`
    }

    if (progressbar) {
      progressbar.style.width = '0%'
    }

    // データの逐次処理
    for (const index in data) {
      const caseData = data[index]

      // プログレスバーの更新
      progressbar.style.width = `${(Number(index) + 1) / data.length}%`

      // 言語処理プロセッサの起動
      type processorOutputFormat = {
        csv: string[]
        errors: string[]
      }

      const processorEvent = async (caseData: pulledDocument, script: LogicRule[]):Promise<processorOutputFormat|undefined> => new Promise((resolve) => {
        setTimeout(() => {
          if (scriptVersion > '0') {
            resolve(processor(caseData, script))
          }
        },
        0)
      })
      const result = await processorEvent(caseData, script as LogicRule[])

      if (result) {
        csvBuffer.push(result.csv)
        if (result.errors.length > 0) {
          const documentId = extractDocumentId(caseData.documentList, scriptType)
          if (documentId !== -1) {
            errorBuffer.push({
              hash: caseData.hash,
              documentId: documentId,
              errors: result.errors
            })
          } else {
            errorBuffer.push({
              hash: caseData.hash,
              errors: result.errors
            })
          }
        }
      }
    }

    // ステータスの更新とダウンロードの有効化
    progressbar.style.width = '100%'
    if (statusline2) {
      statusline2.innerText = '変換終了'
    }
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
