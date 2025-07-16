import { scriptInfo, updateDocument, mainOutput } from './types'
import { showModalMessageBox } from './modal-dialog'
import { papaParse } from './fileHandlers'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: '腫瘍登録番号のインポート',
    plugin_version: '0.201',
    all_patient: true,
    attach_patient_info: false,
    show_upload_dialog: true,
    update_db: true,
    target_schema_id_string: '/schema/*/root',
    explain: '日産婦腫瘍登録からダウンロードデータから腫瘍登録番号をインポートします.'
  }
}

type csvRow = string[]
const idMatchRegex = /^(?<type>CC|EM|OV)\d{4}-\d+$/i // /^(?<type>CC|EM|OV|TD|UA|US|VAC|VUC)\d{4}-\d+$/i

/**
 * プラグイン呼び出し
 * @param uploadedData uploadダイアログで取得されたテキストファイルの中身
 * @param apicall 更新系apiファンクション
 * @returns undefined
 */
export async function main (uploadedData: string, apicall: (request: updateDocument[]) => string): Promise<mainOutput> {
  try {
    // JESGOのアップロードダイアログで取得されたデータ取得
    if (uploadedData && uploadedData !== '') {
      // CSVデータをパース(uminデータがヘッダーが2行に渡る仕様なのでヘッダはパースしない)
      // newlineは\nで明示的に指示しないと分離されない(backendの問題？)
      const csvData = papaParse.parse(uploadedData, { header: false, newline: '\n' }).data as csvRow[]
      if (csvData.length < 2) {
        // 最低でもヘッダの2行がある
        throw new TypeError('ファイルの様式が腫瘍登録書き出しファイルとは異なります.')
      }
      // ヘッダの2行目から患者No.とハッシュ値1のインデックスを取得
      // 登録番号は患者No.または患者 No.のどちらかの揺らぎあるので柔軟に対応
      const indexOfId = csvData[1].findIndex(header => (header === '患者No.' || header === '患者 No.'))
      const indexOfHash = csvData[1].indexOf('ハッシュ値1')

      if (indexOfId === -1 || indexOfHash === -1) {
        throw new TypeError('ファイルの様式が腫瘍登録書き出しファイルとは異なります.')
      }

      // ヘッダを削除
      csvData.splice(0, 2)

      // ハッシュ値と登録番号の組み合わせをリクエストに変換
      const requests:updateDocument[] = []
      for (const record of csvData) {
        const hash = record[indexOfHash]
        const id = record[indexOfId]
        if (id !== '' && hash !== '') {
          const request = makeRequest(hash, id)
          if (request) {
            requests.push(request)
          }
        } else {
          console.warn(`登録番号(${id})またはハッシュ値(${hash})が空です`)
        }
      }
      await showModalMessageBox(`${requests.length}件の登録番号を処理します.`)

      // リクエストを実行
      await apicall(requests)
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e:any) {
    console.error(e)
    await showModalMessageBox(e?.message || 'エラーが発生しました.')
  }
  return undefined
}

/**
 * 更新系リクエストを作成する
 * @param hash 症例ハッシュ
 * @param idString 登録番号文字列
 */
function makeRequest (hash: string, idString: string): updateDocument|undefined {
  if (idString) {
    const matchResult = idString.match(idMatchRegex)
    if (matchResult !== null) {
      const tumorType = matchResult?.groups?.type || ''
      console.info(`割り当て ${idString} -> ${hash} ${tumorType}`)
      if (tumorType !== '') {
        const request = {
          hash,
          schema_id: `/schema/${tumorType}/root`,
          target: {
            '/腫瘍登録番号': idString
          }
        }
        return request
      } else {
        throw new Error(`${tumorType}の認識標識には対応しておりません.`)
      }
    }
  }
  return undefined
}
