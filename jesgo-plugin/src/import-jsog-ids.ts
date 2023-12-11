import { scriptInfo, updateDocument, mainOutput } from './types'
import { showModalMessageBox } from './modal-dialog'
import Papa from 'papaparse'

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

type csvRow = {
  [key: string]: string
}

/**
 * プラグイン呼び出し
 * @param uploadedData uploadダイアログで取得されたテキストファイルの中身
 * @param apicall 更新系apiファンクション
 * @returns undefined
 */
export async function main (uploadedData: string, apicall: (request: updateDocument[]) => string): Promise<mainOutput> {
  try {
    if (uploadedData && uploadedData !== '') {
      const csvData = Papa.parse(uploadedData, { header: true }).data as csvRow[]
      if (csvData.length > 0) {
        const csvHeader = Object.keys(csvData[0])
        if (!(csvHeader.includes('登録コード') && csvHeader.includes('ハッシュ値1'))) {
          throw new TypeError('ファイルの様式が腫瘍登録書き出しファイルとは異なります.')
        }
        for (const record of csvData) {
          const hash = record['ハッシュ値1']
          const id = record['登録コード']
          if (hash && hash !== '') {
            await update(hash, id, apicall)
          }
        }
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e:any) {
    await showModalMessageBox(e?.message || 'エラーが発生しました.')
  }
  return undefined
}

async function update (hash: string, id: string, apicall?: (arg: updateDocument[]) => string) {
  if (id) {
    const matchResult = id.match(/^(?<type>CC|EM|OV)\d{4}-\d+$/i)
    if (matchResult !== null) {
      const tumorType = matchResult?.groups?.type || ''
      if (tumorType !== '') {
        const request = [{
          hash,
          schema_id: `/schema/${tumorType}/root`,
          target: {
            '/腫瘍登録番号': id
          }
        }]
        if (apicall) {
          await apicall(request as updateDocument[])
        }
      } else {
        throw new Error(`${tumorType}の認識標識には対応しておりません.`)
      }
    }
  }
}
