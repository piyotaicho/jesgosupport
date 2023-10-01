/* eslint-disable eqeqeq */
/* eslint-disable camelcase */
//
// JSGOE用インポートデータ作成プラグイン
//
// piyotaicho/P4mohnet
//
import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, formatJESGOdocument, formatJESGOdaicho } from './types'
import { convertDaichoToJOED, formatJOED } from './jesgo-joed-translator'
import { showModalMessageBox } from './modal-dialog'

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

async function handler (docData: pulledDocument[]) {
  const JOEDdocuments:formatJOED[] = []

  for (const caseEntry of docData) {
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
            daicho => {
              const exportDocument = convertDaichoToJOED(
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
          const exportDocument = convertDaichoToJOED(
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
  const numberOfCases = docData.length
  const numberOfRecords = JOEDdocuments.length
  await showModalMessageBox(`出力される症例数は ${numberOfCases}症例 鏡視下手術実施数は ${numberOfRecords}件 です.`)
  return JOEDdocuments
}

export async function finalize () {
  //
}
