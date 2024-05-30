import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, updateDocument, setterPluginArgument } from './types'
import { showModalDialog, createElementFromHtml } from './modal-dialog'
import { dialogHTML } from './jesgo-support-runtime2-ui'
import { processor } from '../../src/components/newProcessor'
import { LogicRuleSet, configObject, fileRuleSetV1 } from '../../src/components/types'
import { unparse as papaUnparse } from 'papaparse'
import { queryDocument } from '../../src/components/utilities'
import { JSONPath } from 'jsonpath-plus'
// スクリプトプリセット
import { scriptCC, scriptEM, scriptOV } from './support-scripts/scripts-v1'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: 'JESGO-supportランタイム',
    plugin_version: '1.0',
    all_patient: true,
    attach_patient_info: true,
    show_upload_dialog: false,
    update_db: true,
    target_schema_id_string: '',
    explain: 'JESGOsupport(version 1.0)で作成されたスクリプトを実行してCSVファイルを作成、エラーを書き戻します.'
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

type ScriptTypeFormat = 'loadscript'|'CC'|'EM'|'OV'

/**
 * 実行ハンドラ
 * @param APIからの返り値
 * @param getterAPIcall 取得系API
 * @param ダイアログのHTML
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

  // ダイアログ内の変数
  type typeErrorBuffer = {
    // eslint-disable-next-line camelcase
    his_id?: string
    name?: string
    hash?: string
    documentId?: number
    errors: string[]
  }

  let rulesetConfig: configObject = {}
  let rulesetTitle = ''
  let script: LogicRuleSet[] = []
  const csvBuffer: string[][] = []
  const errorBuffer:typeErrorBuffer[] = []

  // ダイアログボタンイベント
  const loadScript = async () => await new Promise<unknown>(resolve => {
    // DOMイベントを設定
    const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
    if (runButton) {
      runButton.addEventListener('click', async () => {
        // スクリプトの選択を確認
        const scriptSelection = document.getElementById('plugin-selection-mode') as HTMLSelectElement
        if (!scriptSelection) {
          window.alert('プラグイン内部エラーです.')
          throw new Error('DOM ERROR')
        }

        // 処理プリセットの設定
        switch (scriptSelection.value as ScriptTypeFormat) {
          case 'loadscript':
            // eslint-disable-next-line no-case-declarations
            const JSONstring = await loadJSONfile()
            try {
              if (JSONstring === '') {
                throw new Error(undefined)
              }
              resolve(JSON.parse(JSONstring))
            } catch (e) {
              window.alert('スクリプトが正しいJSONフォーマットではありません.')
            }
            break
          case 'CC':
            resolve(scriptCC)
            break
          case 'EM':
            resolve(scriptEM)
            break
          case 'OV':
            resolve(scriptOV)
            break
          default:
            throw new Error('SELECTから不正な値が取得されました.')
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
    try {
      const loadedContent = (await loadScript()) as fileRuleSetV1|undefined

      if (!loadedContent) {
        throw new Error('有効なスクリプトがロードされませんでした、プラグインの処理を終了します.')
      }

      // eslint-disable-next-line no-prototype-builtins
      if (Array.isArray(loadedContent) && (typeof (loadedContent[0]) === 'object' && loadedContent[0].hasOwnProperty('title'))) {
        // 旧バージョンのルールセットは使用できない
        throw new Error('旧バージョンのルールセットは使用できません. JESGO supportツールでバージョン1以上に修正してください.')
      }

      if (
        loadedContent?.title === undefined ||
        !(loadedContent?.rules && Array.isArray(loadedContent.rules))
      ) {
        throw new Error('このファイルは有効なルールセットが記載されたJSONファイルではないようです.')
      }

      // ルールセットファイルを分解して設定
      rulesetTitle = loadedContent.title
      rulesetConfig = loadedContent?.config || {}
      script = loadedContent.rules
    } catch (e: unknown) {
      const message = (e as Error)?.message || 'エラーです'
      window.alert(message)

      const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
      if (runButton) {
        runButton.disabled = true
      }
      return
    }

    // 取得ドキュメントリストの作成 (抽出用スキーマ指定は1.0.4ではまだ実装無し1.1～を予定)
    const targets:getterPluginArgument[] = Array.from(new Set(data.map(item => item.case_id))).map(item => {
      return {
        caseList: [{
          case_id: item
        }],
        targetDocument: 0
      }
    })

    // ページ2 - 実行フェーズ
    dialogPage1.style.display = 'none'
    dialogPage2.style.display = 'flex'

    // 2ページ目のDOM取得と設定
    const statusline1 = document.getElementById('plugin-statusline1') as HTMLSpanElement
    const statusline2 = document.getElementById('plugin-statusline2') as HTMLSpanElement
    const downloadButton = document.getElementById('plugin-download') as HTMLButtonElement
    const statusline3 = document.getElementById('plugin-statusline3') as HTMLSpanElement

    downloadButton.addEventListener('click', () => {
      if (csvBuffer.length > 0) {
        saveCSV(csvBuffer, rulesetConfig?.csvOffset || 0)
      }
    })

    // 症例数ステータスの更新
    if (statusline1 && statusline2) {
      statusline1.innerText = `読み込まれた症例数は ${targets.length} 症例です.`
      statusline2.innerText = `${rulesetTitle} - 処理中です`
    }

    // ドキュメントの逐次処理
    let skipNumber = 0
    for (let index = 0; index < targets.length; index++) {
      const progressbar = document.getElementById('plugin-progressbar') as HTMLDivElement

      // プログレスバーの更新
      if (progressbar) {
        progressbar.style.width = `${(Number(index) + 1) / targets.length * 100}%`
      } else {
        // ダイアログのDOMが消失した = modalがcloseされた と判断して処理を中止する
        verbose(undefined, 'Plugin-aborted by closing the dialog.')
        return
      }

      // APIでドキュメントを取得
      const caseData:pulledDocument[] = getterAPIcall ? JSON.parse(await getterAPIcall(targets[index])) : []

      if (!Array.isArray(caseData)) {
        continue
      }

      // 言語処理プロセッサの処理へ
      type processorOutputFormat = {
        csv: string[]
        errors: string[]
      }
      try {
        // ドキュメントのクエリ処理
        const queriedDocument = queryDocument([caseData[0]], rulesetConfig?.masterQuery, rulesetConfig?.masterBasePointer)[0]
        if (rulesetConfig?.skipUnmatchedRecord === true && (queriedDocument?.documentList || []).length === 0) {
          // 空白ドキュメントのスキップ指示があったら次のドキュメントへ
          skipNumber++
          continue
        }

        const result = await processor(queriedDocument, script, rulesetConfig?.documentVariables) as processorOutputFormat

        if (result) {
          // 結果
          if (result?.csv && result.csv.length > 0) {
            csvBuffer.push(result.csv)
          }

          // エラーオブジェクトの生成
          if (result?.errors && result.errors.length > 0) {
            // 指定スキーマからdocumentIdを抽出
            if (!rulesetConfig?.errorTargetSchemaId) {
              // errorTargerSchemaIdが未指定の場合一番最初に出現したドキュメントにエラーを埋め込む
              const documentIds = JSONPath({ path: '$..[?(@property === "jesgo:document_id")]', json: caseData[0]?.documentList || [] })

              if (documentIds.length > 0) {
                errorBuffer.push({
                  hash: caseData[0].hash,
                  his_id: caseData[0]?.his_id,
                  name: caseData[0]?.name,
                  documentId: documentIds[0],
                  errors: result.errors
                })
              }
            } else {
              // 指定したエラースキーマ(継承元を含む)にエラーを埋め込む
              // スキーマidを正規化(継承スキーマに対応するため前方一致で/を最後につけて区切り文字とする)
              const matchPattern = '/^' + rulesetConfig.errorTargetSchemaId.split('/').join('\\/') + '\\/?/'
              const jsonpath = `$..[?(@["jesgo:schema_id"] && @["jesgo:schema_id"].match(${matchPattern}) )].jesgo:document_id`
              const documentIds = JSONPath({ path: jsonpath, json: caseData[0]?.documentList || [] })

              if (documentIds.length > 0) {
                errorBuffer.push({
                  hash: caseData[0].hash,
                  his_id: caseData[0]?.his_id,
                  name: caseData[0]?.name,
                  documentId: documentIds[0],
                  errors: result.errors
                })
              }
            }
          }
        }
      } catch (e) {
        const message = (e as Error)?.message || '処理エラーが発生しました'
        if (!window.confirm(`${message} 無視して次の症例に対して処理を継続しますか？`)) {
          continue
        } else {
          // ダイアログ表示をエラー中断に変更
          statusline1.innerText = '処理エラーのため処理を中止しました.'
          statusline2.innerText = ''
          downloadButton.disabled = true

          // コンソールにエラーを出力しておく
          console.error(e)
        }
      }
    }

    // ステータスの更新とダウンロードの有効化
    const progressbar = document.getElementById('plugin-progressbar') as HTMLDivElement
    if (progressbar) {
      progressbar.style.width = '変換終了'
    }
    if (statusline1 && statusline2) {
      statusline1.innerText = `${targets.length - skipNumber}症例から${csvBuffer.length}症例のデータを抽出処理しました.`
      statusline2.innerText = ''
    }

    await new Promise<void>(resolve => setTimeout(() => {
      // CSVのデータがあればダウンロード関係をenable
      if (csvBuffer.length > 0) {
        statusline2.innerText = 'CSVファイルをダウンロードできます.'
        downloadButton.disabled = false
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

  // updateドキュメントとしてエラーバッファーを生成して返す
  const returnValue: updateDocument[] = []
  for (const errorItem of errorBuffer) {
    // エラーの出力パスを設定
    let errorPath = '/jesgo:error'
    if (rulesetConfig?.errorPointer) {
      errorPath = rulesetConfig.errorPointer
    }

    if (errorItem?.documentId) {
      returnValue.push(
        {
          document_id: Number(errorItem.documentId),
          target: {
            [errorPath]: errorItem.errors
          }
        }
      )
    }
  }
  return returnValue
}
