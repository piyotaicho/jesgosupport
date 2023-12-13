import { mainOutput, scriptInfo, getterPluginArgument, updateDocument, setterPluginArgument } from './types'
import { main as embeddedMain, pluginInformation } from './embedded-plugin'
import { checkCC2023 as embeddedScript } from './support-scripts/GOCC_2023_check'

const version = '0.9.1'
const filename = 'check-CC-2023-single.ts'
const targetDocumentType = 'CC'
const scriptInformation: scriptInfo = {
  plugin_name: '子宮頸がん登録チェック(2023年個別)',
  plugin_version: version.split('.').slice(0, 2).join('.'),
  all_patient: false,
  attach_patient_info: true,
  show_upload_dialog: false,
  update_db: true,
  target_schema_id_string: '',
  explain: '2023年症例子宮頸がん登録対応のチェックを行います'
}

export async function init ():Promise<scriptInfo> {
  return scriptInformation
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
  const pluginInfo: pluginInformation = {
    version,
    filename,
    targetDocumentType,
    title: scriptInformation.plugin_name,
    description: scriptInformation.explain,
    script: embeddedScript
  }
  return await embeddedMain(docData, apicall, pluginInfo)
}
