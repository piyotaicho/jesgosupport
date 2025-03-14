import { scriptInfo, updateDocument, mainOutput } from './types'
import { showModalMessageBox } from './modal-dialog'
import { papaParse } from './fileHandlers'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: '腫瘍登録番号のインポート',
    plugin_version: '0.1',
    all_patient: true,
    attach_patient_info: false,
    show_upload_dialog: true,
    update_db: true,
    target_schema_id_string: '/schema/*/root',
    explain: '日産婦腫瘍登録からダウンロードデータから腫瘍登録番号をインポートします.'
  }
}

type csvRow = string[]

/**
 * プラグイン呼び出し
 * @param uploadedData uploadダイアログで取得されたテキストファイルの中身
 * @param apicall 更新系apiファンクション
 * @returns undefined
 */
export async function main (uploadedData: string, apicall: (request: updateDocument[]) => string): Promise<mainOutput> {
  try {
    if (uploadedData && uploadedData !== '') {
      console.log(uploadedData)
      const csvData = papaParse.parse(uploadedData, { header: false }).data as csvRow[]
      console.dir(csvData)
      if (csvData.length < 2) {
        throw new TypeError('ファイルの様式が腫瘍登録書き出しファイルとは異なります.')
      }
      const indexId = csvData[1].includes('患者No.') ? csvData[1].indexOf('患者No.') : csvData[1].indexOf('患者 No.')
      const indexHash = csvData[1].indexOf('ハッシュ値1')

      if (indexId === -1 || indexHash === -1) {
        throw new TypeError('ファイルの様式が腫瘍登録書き出しファイルとは異なります.')
      }

      csvData.splice(0, 2)
      const requests:updateDocument[] = []
      for (const record of csvData) {
        const hash = record[indexHash]
        const id = record[indexId]
        if (hash && hash !== '') {
          const request = makeRequest(hash, id)
          if (request) {
            requests.push(request)
          }
        }
      }
      await apicall(requests)
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e:any) {
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
    const matchResult = idString.match(/^(?<type>CC|EM|OV)\d{4}-\d+$/i)
    if (matchResult !== null) {
      const tumorType = matchResult?.groups?.type || ''
      console.log(`${hash} = /schema/${tumorType}/root <- ${idString}`)
      if (tumorType !== '') {
        const request = {
          hash,
          schema_id: `/schema/${tumorType}/root`,
          target: {
            '/腫瘍登録番号': idString
          }
        }
        console.dir(request)
        return request
      } else {
        throw new Error(`${tumorType}の認識標識には対応しておりません.`)
      }
    }
  }
  return undefined
}
