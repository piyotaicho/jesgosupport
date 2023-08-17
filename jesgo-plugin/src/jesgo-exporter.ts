/* eslint-disable eqeqeq */
/* eslint-disable camelcase */
//
// JESGO-JSON ルールセット作成用 JSONドキュメント作成プラグイン
//
// piyotaicho/P4mohnet
//
import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument } from './types'
import { showModalMessageBox } from './modal-dialog'

const script_info: scriptInfo = {
  plugin_name: 'JESGO-support用出力(byTS&webpack)',
  plugin_version: '0.1',
  all_patient: true,
  attach_patient_info: true,
  update_db: false,
  show_upload_dialog: false,
  explain: 'JESGO-supportが読み込むAPI生データを出力します.入力された患者の全情報が入っています.'
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
  const numberOfCases = docData.length
  await showModalMessageBox(`出力される症例数は ${numberOfCases} です.`)
  return docData
}

export async function finalize () {
  //
}
