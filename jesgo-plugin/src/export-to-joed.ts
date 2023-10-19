/* eslint-disable eqeqeq */
/* eslint-disable camelcase */
//
// JSGOE用インポートデータ作成プラグイン
//
// piyotaicho/P4mohnet
//
import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, formatJESGOdocument, formatJESGOdaicho, formatJESGOrelapse } from './types'
import { convertDaichoToJOED, formatJOED } from './jesgo-joed-translator'
import { createElementFromHtml, showModalDialog } from './modal-dialog'
import { dialogHTMLstrings } from './export-to-joed-ui'

const script_info: scriptInfo = {
  plugin_name: 'JOED5用インポートデータの作成',
  plugin_version: '0.3',
  all_patient: true,
  attach_patient_info: true,
  update_db: false,
  show_upload_dialog: false,
  explain: 'JOED5アプリケーションで読み込み可能なJSONファイルを作成します.'
}

export async function init () {
  return script_info
}

export async function main (docData: getterPluginArgument, apifunc: (docData: getterPluginArgument) => string): Promise<mainOutput> {
  if (docData.caseList) {
    const apiresult = await apifunc(docData)
    let documents:pulledDocument[]
    try {
      documents = JSON.parse(apiresult) as pulledDocument[]
    } catch {
      return ('APIの返り値が異常です.')
    }
    return await handler(documents)
  }
  return (undefined)
}

export async function finalize () {
  //
}

async function handler (docData: pulledDocument[]) {
  if (docData.length === 0) {
    return undefined
  }

  const JOEDdocuments:formatJOED[] = []

  // modal dialog に要素を配置する
  const createDialogContent = (parent:Element) => parent.appendChild(createElementFromHtml(dialogHTMLstrings))

  // メインのデータ変換処理
  const procedure = async (yearFilter: string) => {
    // ダイアログ内容の初期化
    const numberOfCases = docData.length
    const statusline1 = document.getElementById('plugin-statusline1')
    if (statusline1) {
      statusline1.innerText = `JESGOから出力された症例数は${numberOfCases}症例です.`
    }

    let count = 0
    for (const caseEntry of docData) {
      // ダイアログのプログレスバーを更新
      count++
      const progressbar = document.getElementById('pligin-progressbar')
      if (progressbar) {
        progressbar.style.width = (count * 100 / numberOfCases).toString().substring(0, 5) + '%'
      } else {
        // ダイアログのDOMが消失した = modalがcloseされた と判断して処理を中止する
        console.log('Plugin-aborted.')
        return undefined
      }

      // JESGO症例情報を取得
      // JOED5で必要なものは 患者id と 氏名のみ、年齢はevent_dateで計算する
      const patientId = caseEntry.his_id
      const patientName = caseEntry.name
      const patientDOB = caseEntry.date_of_birth

      // JESGOドキュメントから情報(初回治療～患者台帳、再発治療～再発)を抽出
      for (const item of caseEntry.documentList) {
        const documentEntry = item as formatJESGOdocument
        const daichoArray:(formatJESGOdaicho|formatJESGOrelapse)[] = []
        if (documentEntry?.患者台帳 !== undefined) {
          if (Array.isArray(documentEntry.患者台帳)) {
            daichoArray.push(...documentEntry.患者台帳 as formatJESGOdaicho[])
          } else {
            daichoArray.push(documentEntry.患者台帳)
          }
        }
        if (documentEntry?.再発 !== undefined) {
          if (Array.isArray(documentEntry.再発)) {
            daichoArray.push(...documentEntry.再発 as formatJESGOrelapse[])
          } else {
            daichoArray.push(documentEntry.再発)
          }
        }
        // 変換
        for (const daicho of daichoArray) {
          const exportDocument = await convertDaichoToJOEDwrapper(
            patientId,
            patientName,
            patientDOB,
            daicho,
            yearFilter
          )
          if (exportDocument) {
            JOEDdocuments.push(...exportDocument)
          }
        }
      }
    }

    // 処理終了のメッセージを出す
    const progressbar = document.getElementById('pligin-progressbar')
    if (progressbar) {
      progressbar.innerText = '抽出・変換終了'
    }
    const statusline2 = document.getElementById('plugin-statusline2')
    if (statusline2) {
      statusline2.innerText = `${JOEDdocuments.length}件の鏡視下手術情報を抽出しました.`
    }

    return true
  }

  // modal dialog 内で実行される処理
  const dialogProcedure = async () => {
    const selectElement = document.getElementById('plugin-selection')
    const processButton = document.getElementById('plugin-process-script')
    if (!selectElement || !processButton) {
      throw new Error('DOM loading failure.')
    }
    // ダイアログの select / option を追加
    const currentYear: number = new Date().getFullYear()

    for (let year = currentYear; year > 2019; year--) {
      const option = document.createElement('option')
      option.text = `${year}年`
      option.value = year.toString()
      selectElement.appendChild(option)
    }

    // ダイアログのボタンイベントを設定
    return await new Promise(resolve => {
      processButton.addEventListener(
        'click',
        async () => {
          const settingDiv = document.getElementById('plugin-setting')
          const processDiv = document.getElementById('plugin-processing')
          if (settingDiv && processDiv) {
            // ダイアログの内容をスイッチ
            settingDiv.style.display = 'none'
            processDiv.style.display = ''

            // メインルーチンへ
            resolve(await procedure((selectElement as HTMLSelectElement).value))
          } else {
            throw new Error('Div DOM loading failure.')
          }
        },
        {
          once: true
        }
      )
    })
  }

  // ダイアログの表示をする
  if (await showModalDialog(createDialogContent, dialogProcedure)) {
    return JOEDdocuments
  } else {
    return undefined
  }
}

/**
 * ロックアップ回避のための変換ルーチンのラッパー
 */
async function convertDaichoToJOEDwrapper (
  patientId: string|undefined, patientName: string|undefined, patientDOB:string|undefined, daicho: formatJESGOdaicho|formatJESGOrelapse, filterYear: string
): Promise<formatJOED[]|undefined> {
  return await new Promise(resolve => {
    setTimeout(() => {
      try {
        resolve(convertDaichoToJOED(patientId, patientName, patientDOB, daicho, filterYear))
      } catch (e) {
        console.log(`症例(${patientId})の処理中に例外が発生しました.`)
        console.dir(daicho)
        console.error(e)
        resolve(undefined)
      }
    },
    0)
  })
}
