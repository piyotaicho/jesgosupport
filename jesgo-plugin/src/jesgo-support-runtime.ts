import { scriptInfo } from './types'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: 'JESGO-supportランタイム',
    plugin_version: (process.env.npm_package_version) || '0.0.1',
    all_patient: true,
    attach_patient_info: true,
    show_upload_dialog: false,
    update_db: false,
    explain: 'JESGOsupportで作成されたスクリプトを実行してCSVファイルとエラー出力を取得します.'
  }
}

export async function main (docData, apifunction): Promise<any> {
  return {}
}