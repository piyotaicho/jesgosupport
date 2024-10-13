//
// スクリプト内包型プラグインの共通ルーチン
//
import { mainOutput, getterPluginArgument, updateDocument, setterPluginArgument } from './types'
import { fileRuleSetV1 } from '../../src/components/types'
import { dialogHTML } from './embedded-runtime-ui'
import { handler, verbose } from './runtime-common'

export type pluginInformation = {
  version: string
  description: string
  rulesetObject: fileRuleSetV1
  dialogHTML?: string
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
export async function main (
  docData: setterPluginArgument[],
  apicall: (docData: getterPluginArgument|updateDocument|updateDocument[], mode: boolean) => string,
  pluginInfo: pluginInformation): Promise<mainOutput> {
  console.log(`${pluginInfo.rulesetObject.title}@${pluginInfo.version} (C) 2023-2024 by P4mohnet\nhttps://github.com/piyotaicho/jesgosupport`)

  // 更新モードなのでdocDataには表示されている全てのドキュメントが入っている
  const getterAPIcall = (request: getterPluginArgument) => apicall(request, true)
  const setterAPIcall = (request: updateDocument[]) => apicall(request, false)

  if (docData) {
    const divHTML = (pluginInfo.dialogHTML || dialogHTML)
      .replace('$$version$$', pluginInfo.version)
      .replace('$$title$$', pluginInfo.rulesetObject.title || 'ランタイム')
      .replace('$$description$$', pluginInfo.description || 'スクリプトを実行します')
    // 実際の処理へ handlerはちゃんと処理したらupdateDocumentを返す
    const values: unknown = await handler(docData, async () => pluginInfo.rulesetObject, divHTML, getterAPIcall)

    // APIで返り値ドキュメントを処理(書き戻しモード)
    if (values && Array.isArray(values) && values.length > 0) {
      const updateValues = values as updateDocument[]
      verbose('Update database:', updateValues)
      await setterAPIcall(updateValues)
    }
  }
  return undefined
}
