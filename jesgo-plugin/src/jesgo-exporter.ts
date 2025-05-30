/* eslint-disable eqeqeq */
/* eslint-disable camelcase */
//
// JESGO-JSON ルールセット作成用 JSONドキュメント作成プラグイン
//
// piyotaicho/P4mohnet
//
import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument } from './types'
import { showModalMessageBox } from './modal-dialog'

const version = '1.0.1'
const script_info: scriptInfo = {
  plugin_name: '全患者文書出力',
  plugin_version: `${version.split('.')[0]}.${Number(version.split('.')[1]).toString()}${Number(version.split('.')[2]).toString().padStart(2,'0')}`,
  all_patient: true,
  attach_patient_info: true,
  update_db: false,
  show_upload_dialog: false,
  explain: 'JESGO-supportで読み込むAPI生データ(JSON)を全患者分出力します.入力された患者の全情報が入っています.'
}

export async function init () {
  return script_info
}

export async function main (docData: getterPluginArgument, apifunc: (docData: getterPluginArgument) => string): Promise<mainOutput> {
  console.log(`jesgo-exporter.ts@${version} (C) 2023-2025 by P4mohnet\nhttps://github.com/piyotaicho/jesgosupport`)

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
  await showModalMessageBox(`出力された症例数は ${numberOfCases} です.`)
  return docData
}

export async function finalize () {
  //
}
