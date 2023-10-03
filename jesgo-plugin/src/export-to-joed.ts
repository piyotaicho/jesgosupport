/* eslint-disable eqeqeq */
/* eslint-disable camelcase */
//
// JSGOE用インポートデータ作成プラグイン
//
// piyotaicho/P4mohnet
//
import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, formatJESGOdocument, formatJESGOdaicho } from './types'
import { convertDaichoToJOED, formatJOED } from './jesgo-joed-translator'
import { createElementFromHtml, showModalDialog } from './modal-dialog'
import { dialogHTMLstrings } from './export-to-joed-ui'

const script_info: scriptInfo = {
  plugin_name: 'JOED5用インポートデータの作成',
  plugin_version: '0.1',
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

  // modal dialog 内で実行される処理
  const procedure = async () => {
    // ダイアログ内容の初期化
    const numberOfCases = docData.length
    const statusline1 = document.getElementById('plugin-statusline1')
    if (statusline1) {
      statusline1.innerText = `JESGOから出力された症例数は ${numberOfCases}症例です.`
    }

    const progressbar = document.getElementById('plugin-progressbar')

    let count = 0
    for (const caseEntry of docData) {
      // ダイアログのプログレスバーを更新
      count++
      if (progressbar) {
        progressbar.style.width = (count * 100 / numberOfCases).toString().substring(0, 5) + '%'
      }

      // JESGO症例情報を取得
      // JOED5で必要なものは 患者id と 氏名のみ、年齢はevent_dateで計算する
      const patientId = caseEntry.his_id
      const patientName = caseEntry.name
      const patientDOB = caseEntry.date_of_birth

      // JESGO患者台帳から情報を抽出
      for (const item of caseEntry.documentList) {
        const documentEntry = item as formatJESGOdocument
        if (documentEntry?.患者台帳 !== undefined) {
          if (Array.isArray(documentEntry.患者台帳)) {
            const daichoArray = documentEntry.患者台帳 as formatJESGOdaicho[]
            daichoArray.forEach(
              async daicho => {
                const exportDocument = await convertDaichoToJOEDwrapper(
                  patientId,
                  patientName,
                  patientDOB,
                  daicho
                )
                if (exportDocument) {
                  JOEDdocuments.push(...exportDocument)
                }
              }
            )
          } else {
            const exportDocument = await convertDaichoToJOEDwrapper(
              patientId,
              patientName,
              patientDOB,
              documentEntry.患者台帳
            )
            if (exportDocument) {
              JOEDdocuments.push(...exportDocument)
            }
          }
        }
      }
    }

    // 処理終了のメッセージを出す
    if (progressbar) {
      progressbar.innerText = '変換終了'
    }
    const statusline2 = document.getElementById('plugin-statusline2')
    if (statusline2) {
      const numberOfRecords = JOEDdocuments.length
      statusline2.innerText = `${numberOfRecords}件の鏡視下手術情報を抽出しました.`
    }
  }

  // ダイアログの表示をする
  await showModalDialog(createDialogContent, procedure)
  return JOEDdocuments
}

/**
 * ロックアップ回避のための変換ルーチンのラッパー
 */
async function convertDaichoToJOEDwrapper (
  patientId: string|undefined, patientName: string|undefined, patientDOB:string|undefined, daicho: formatJESGOdaicho
): Promise<formatJOED[]|undefined> {
  return await new Promise(resolve => {
    setTimeout(() => {
      try {
        resolve(convertDaichoToJOED(patientId, patientName, patientDOB, daicho))
      } catch (e) {
        console.error(e)
        resolve(undefined)
      }
    },
    0)
  })
}
