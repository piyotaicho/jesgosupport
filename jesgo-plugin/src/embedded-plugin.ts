//
// スクリプト内包型プラグインの共通ルーチン
//
import { mainOutput, getterPluginArgument, pulledDocument, updateDocument, setterPluginArgument } from './types'
import { showModalDialog, createElementFromHtml } from './modal-dialog'
import { dialogHTML } from './embedded-runtime-ui'
import { processor } from '../../src/components/processor'
import { LogicRule } from '../../src/components/types'
import { saveCSV } from './fileHandlers'

export type pluginInformation = {
  version: string
  filename: string
  targetDocumentType: 'CC'|'EM'|'OV'
  title?: string
  description?: string
  script: unknown
}

/**
 * プラグインmainルーチン
 * @param docData
 *  - 取得系 症例リスト
 *  - 更新系(uploadなし) 表示されている全てのドキュメント
 *  - 更新系(uploadあり) uploadされたデータ
 * @param apicall APIcallback
 * @param scriptInfo
 * @returns
 *  - 取得系 ビューアに渡すデータ(JSON, array or string)
 *  - 取得系 void
 */
export async function main (docData: setterPluginArgument[], targetPointer: string, apicall: (docData: getterPluginArgument|updateDocument|updateDocument[], mode: boolean) => string, pluginInfo: pluginInformation): Promise<mainOutput> {
  console.log(`${pluginInfo.filename}@${pluginInfo.version} (C) 2023 by P4mohnet\nhttps://github.com/piyotaicho/jesgosupport`)

  // 更新モードなのでdocDataには表示されている全てのドキュメントが入っている
  const getterAPIcall = (request: getterPluginArgument) => apicall(request, true)
  const setterAPIcall = (request: updateDocument[]) => apicall(request, false)

  if (docData) {
    // 実際の処理へ handlerはちゃんと処理したらupdateDocumentを返す
    const values: unknown = await handler(docData, pluginInfo, targetPointer, getterAPIcall)

    // APIで返り値ドキュメントを処理(書き戻しモード)
    if (values && Array.isArray(values) && values.length > 0) {
      const updateValues = values as updateDocument[]
      verbose('Update database:', updateValues)
      await setterAPIcall(updateValues)
    }
  }
  return undefined
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
async function handler (data: setterPluginArgument[], pluginInfo: pluginInformation, targetPointer: string, getterAPIcall?: (arg: getterPluginArgument) => string): Promise<updateDocument[]|undefined> {
  // データ無し
  const dataLength = data.length
  if (dataLength === 0) {
    return undefined
  }

  // ダイアログの表示
  const createDialogContent = (parent:Element) => parent.appendChild(createElementFromHtml(
    dialogHTML
      .replace('$$version$$', pluginInfo.version)
      .replace('$$title$$', pluginInfo.title || 'ランタイム')
      .replace('$$description$$', pluginInfo.description || 'スクリプトを実行します')
  ))

  // ダイアログ内の変数
  type typeErrorBuffer = {
    // eslint-disable-next-line camelcase
    his_id?: string
    name?: string
    hash?: string
    documentId?: number
    errors: string[]
  }

  let script: unknown = pluginInfo.script
  const csvBuffer: string[][] = []
  const errorBuffer:typeErrorBuffer[] = []
  let csvOffset = 0

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

    // ページ1 - ダイアログボタンイベントを待期
    await new Promise<void>(resolve => {
      const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
      if (runButton) {
        runButton.addEventListener('click', () => resolve())
      }
    })

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
    const divCsvOffset = document.getElementById('plugin-div-csv-offset') as HTMLDivElement
    const inputCsvOffset = document.getElementById('plugin-offset-value') as HTMLInputElement
    const divCsvDownload = document.getElementById('plugin-div-csv-download') as HTMLInputElement
    const downloadButton = document.getElementById('plugin-download') as HTMLButtonElement
    const statusline3 = document.getElementById('plugin-statusline3') as HTMLSpanElement

    divCsvDownload.style.display = 'none'
    divCsvOffset.style.display = 'none'

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
      if (targets.length > 1) {
        statusline1.innerText = `対象症例数は ${targets.length} 症例です.`
      } else {
        statusline1.innerText = ''
      }
      statusline2.innerText = 'データを抽出・変換処理中です'
    }

    // データの逐次処理
    for (let index = 0; index < targets.length; index++) {
      const progressbar = document.getElementById('plugin-progressbar') as HTMLDivElement
      if (targets.length === 1) {
        const progressbarDiv = document.getElementById('plugin-div-progressbar') as HTMLDivElement
        progressbarDiv.style.display = 'none'
      }
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
            const extractedDocumentId = extractDocumentId(caseData[0].documentList, pluginInfo.targetDocumentType)
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
      if (targets.length > 1) {
        if (csvBuffer.length > 0) {
          statusline1.innerText = `${targets.length}症例から${csvBuffer.length}症例のデータを抽出しました.`
        } else {
          statusline1.innerText = `${targets.length}症例を処理しました.`
        }
      }
    }

    await new Promise<void>(resolve => setTimeout(() => {
      // CSVのデータがあればダウンロード関係をenable
      if (csvBuffer.length > 0) {
        divCsvDownload.style.display = ''
        divCsvOffset.style.display = ''

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
            // /jesgo:error で確認あり
            // /jesgo:error/- で確認なし(追加)
            [targetPointer]: errorItem.errors
          }
        }
      )
    }
  }
  return returnValue
}
