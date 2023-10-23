import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, updateDocument } from './types'
import { showModalDialog, createElementFromHtml } from './modal-dialog'
import dialogHTML from './jesgo-support-runtime-ui'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { processor } from '../../src/components/processor'
import Papa from 'papaparse'
import { LogicRule } from '../../src/components/types'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: 'JESGO-supportランタイム',
    plugin_version: '0.1',
    all_patient: true,
    attach_patient_info: true,
    show_upload_dialog: false,
    update_db: true,
    explain: 'JESGOsupport(version <1.0)で作成されたスクリプトを実行してCSVファイルを作成、エラーを書き戻します.'
  }
}

export async function main (docData: getterPluginArgument, apifunction: (docData: getterPluginArgument|updateDocument[], mode: boolean) => string): Promise<mainOutput> {
  if (docData.caseList) {
    // APIでドキュメントを取得(取得モード)
    const documentJSON = await apifunction(docData, true)
    let documents:pulledDocument[]
    try {
      documents = JSON.parse(documentJSON) as pulledDocument[]
    } catch {
      window.alert('APIの返り値が異常です.')
      return undefined
    }

    // 実際の処理へ handlerはちゃんと処理したらupdateDocumentを返す
    const values: unknown = await handler(documents)

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function saveCSV (data:unknown[]) {
  if (data && Array.isArray(data) && data.length > 0) {
    const blob = new Blob([
      Papa.unparse(
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
    anchorElement.download = '出力データ.csv'
    anchorElement.click()
  }
}

async function handler (data: pulledDocument[]): Promise<updateDocument[]|undefined> {
  // データ無し
  if (data.length === 0) {
    return undefined
  }

  // ダイアログの表示
  const createDialogContent = (parent:Element) => parent.appendChild(createElementFromHtml(dialogHTML))

  // ダイアログ内での処理
  const script: unknown[] = []
  type scriptTypeValuse = 'loadscript'|'CC'|'EM'|'OV'
  let scriptType:scriptTypeValuse = 'loadscript'

  // 実行ボタンのイベントハンドラ
  const loadScriptByRunButton = async (): Promise<string> => {
    // selectの判定
    const scriptSelection = document.getElementById('plugin-selection-mode') as HTMLSelectElement
    const inputFileElement = document.getElementById('plugin-input-file') as HTMLInputElement

    if (!scriptSelection || !inputFileElement) {
      // DOM展開エラーかしら？
      return ''
    }
    scriptType = scriptSelection.value as scriptTypeValuse

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
    // 1ページ目のDOMイベントを設定
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

    for (const index in data) {
      const caseData = data[index]

      const processorEvent = async (caseData: pulledDocument, script: LogicRule[]) => new Promise((resolve) => {
        setTimeout(() => {
          resolve(processor(caseData, script))
        },
        0)
      })
      const result = await processorEvent(caseData, script as LogicRule[])

      if (result) {
        const { csv, errors } = result
      }
    }
  }

  await showModalDialog(createDialogContent, dialogProcedure)

  return undefined
}
