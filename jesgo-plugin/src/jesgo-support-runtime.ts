import { mainOutput, scriptInfo, getterPluginArgument, updateDocument, setterPluginArgument } from './types'
import { dialogHTML } from './jesgo-support-runtime-ui'
import { handler, verbose, loadJSONfile } from './runtime-common'
// スクリプトプリセット
import { scriptCC, scriptEM, scriptOV, checkCC, checkEM, checkOV } from './support-scripts/scripts-v1'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: '腫瘍登録スクリプト一括実行',
    plugin_version: '1.0',
    all_patient: true,
    attach_patient_info: true,
    show_upload_dialog: false,
    update_db: true,
    target_schema_id_string: '',
    explain: 'JESGOsupport(version 1.0~)で作成された腫瘍登録スクリプトを実行してCSVファイルを作成、エラーを書き戻します.'
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
    const values: unknown = await handler(docData, getRuleSet, dialogHTML, getterAPIcall)

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

async function getRuleSet (): Promise<unknown> {
  type ScriptTypeFormat = 'loadscript'|'CC'|'EM'|'OV'|'CCcheck'|'EMcheck'|'OVcheck'

  return new Promise<unknown>((resolve, reject) => {
    // DOMイベントを設定
    const runButton = document.getElementById('plugin-process-script') as HTMLButtonElement
    if (runButton) {
      runButton.addEventListener('click', async () => {
        // スクリプトの選択を確認
        const scriptSelection = document.getElementById('plugin-selection-mode') as HTMLSelectElement
        if (!scriptSelection) {
          window.alert('プラグイン内部エラーです.')
          throw new Error('DOM ERROR')
        }

        // 処理プリセットの設定
        switch (scriptSelection.value as ScriptTypeFormat) {
          case 'loadscript':
            try {
              // eslint-disable-next-line no-case-declarations
              const JSONstring = await loadJSONfile()
              const ruleset = JSON.parse(JSONstring)

              if (!ruleset) {
                throw new Error('有効なスクリプトがロードされませんでした、プラグインの処理を終了します.')
              }

              // eslint-disable-next-line no-prototype-builtins
              if (Array.isArray(ruleset) && (typeof (ruleset[0]) === 'object' && ruleset[0].hasOwnProperty('title'))) {
                // 旧バージョンのルールセットは使用できない
                throw new Error('旧バージョンのルールセットは使用できません. JESGO supportツールでバージョン1以上に修正してください.')
              }

              if (
                ruleset?.title === undefined ||
                !(ruleset?.rules && Array.isArray(ruleset.rules))
              ) {
                throw new Error('このファイルは有効なルールセットが記載されたJSONファイルではないようです.')
              }

              resolve(ruleset)
            } catch (e) {
              if ((e as Error).name === 'SyntaxError') {
                reject(new Error('スクリプトが正しいJSONフォーマットではありません.'))
              } else {
                reject(new Error((e as Error)?.message))
              }
            }
            break
          case 'CC':
            resolve(scriptCC)
            break
          case 'EM':
            resolve(scriptEM)
            break
          case 'OV':
            resolve(scriptOV)
            break
          case 'CCcheck':
            resolve(checkCC)
            break
          case 'EMcheck':
            resolve(checkEM)
            break
          case 'OVcheck':
            resolve(checkOV)
            break
          default:
            reject(new Error('選択肢から不正な値が取得されました.'))
        }
      })
    }
  })
}
