/* eslint-disable eqeqeq */
/* eslint-disable camelcase */
//
// 単一患者のJESGO-JSONドキュメント作成プラグイン
//
// piyotaicho/P4mohnet
//
import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument } from './types'

const version = '1.0.0'
const script_info: scriptInfo = {
  plugin_name: '患者文書出力(個別)',
  plugin_version: '1.0',
  all_patient: false,
  attach_patient_info: true,
  update_db: false,
  show_upload_dialog: false,
  explain: '編集中の患者の全情報をJESGO-supportで読み込むAPI生データ(JSON)として出力します.'
}

export async function init () {
  return script_info
}

export async function main (docData: getterPluginArgument, apifunc: (docData: getterPluginArgument) => string): Promise<mainOutput> {
  console.log(`jesgo-exporter-single.ts@${version} (C) 2023 by P4mohnet\nhttps://github.com/piyotaicho/jesgosupport`)

  if (docData.caseList) {
    const apiresult = await apifunc(docData)
    let documents:pulledDocument[]
    try {
      documents = JSON.parse(apiresult) as pulledDocument[]
    } catch {
      return ('APIの返り値が異常です.')
    }
    return documents
  }
  return (undefined)
}

export async function finalize () {
  //
}
