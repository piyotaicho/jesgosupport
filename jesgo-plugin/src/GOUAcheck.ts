import { mainOutput, scriptInfo, getterPluginArgument, updateDocument, setterPluginArgument } from './types'
import { dialogHTML } from './embedded-runtime-single-ui'
import { handler, verbose } from './runtime-common'
import { scriptCheckUA as checkRule } from './support-scripts/scriptsForCheckRaretumors'

const version = '1.2.4'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: '子宮腺肉腫個別チェック',
    plugin_version: `${version.split('.')[0]}.${Number(version.split('.')[1]).toString()}${Number(version.split('.')[2]).toString().padStart(2,'0')}`,
    all_patient: false,
    attach_patient_info: true,
    show_upload_dialog: false,
    update_db: true,
    target_schema_id_string: '',
    explain: '症例毎に子宮腺肉腫登録のロジカルチェックを行います.(2023年～2024年登録対応)'
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
    const dialogHTMLreplaced = dialogHTML
      .replace('$$title$$', (await init()).plugin_name)
      .replace('$$description$$', (await init())?.explain || '')
    const values: unknown = await handler(docData, async () => checkRule, dialogHTMLreplaced, getterAPIcall)

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
