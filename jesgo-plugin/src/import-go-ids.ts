// 腫瘍登録番号の書き戻し
import { scriptInfo, setterPluginArgument, mainOutput, updateDocument } from './types'
import { showModalDialog, createElementFromHtml } from './modal-dialog'
import { parse as papaparse } from 'papaparse'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: '腫瘍登録番号のインポート',
    plugin_version: '0.1',
    all_patient: true,
    attach_patient_info: false,
    show_upload_dialog: false,
    update_db: true,
    // 台帳を対象にして抽出
    target_schema_id_string: '/schema/*/root',
    explain: 'JESGOから一括登録後に、腫瘍登録システムからダウンロードしたCSVファイルから腫瘍登録番号を書き戻します.'
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function main (docData: setterPluginArgument[], apicall: (docData: updateDocument[]) => string, mode = false): Promise<mainOutput> {
  let updateRequests:updateDocument[]
  let csvData:string[][]
  let indexOfId = -1
  let indexOfHash = -1
  try {
    // FileAPIでCSVファイルを読み込む
    const csvString = await new Promise(resolve => {
      const inputFile = document.createElement('input') as HTMLInputElement
      inputFile.type = 'file'
      inputFile.accept = '.csv'
  
      // FileReaderをセットアップ
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        resolve(reader.result as string)
      },
      {
        once: true
      })
  
      // input type="file"のセットアップ
      const changeEvent = () => {
        const files = inputFile.files
        if (files && files.length > 0) {
          reader.readAsText(files[0])
        }
      }
      const cancelEvent = () => {
        inputFile.removeEventListener('change', changeEvent)
        resolve('')
      }
  
      inputFile.addEventListener('change', changeEvent, { once: true })
      inputFile.addEventListener('cancel', cancelEvent, { once: true })
  
      // input type=file発火
      inputFile.click()
    })

    // CSVのパース
    // ヘッダ行が2行あり3行目からデータがある
    csvData = papaparse(csvString as string, { header: false, dynamicTyping: false }) as unknown as string[][]
    if (csvData.length < 3) {
      throw new Error(undefined)
    }

    // ヘッダ（2行目）から腫瘍登録番号とハッシュ値を検索
    for (let index = 0; index < csvData[1].length; index++) {
      if (csvData[1][index] === '登録コード') {
        indexOfId = index
        continue
      }
      if (csvData[1][index] === 'ハッシュ値1') {
        indexOfHash = index
        continue
      }
    }

    if (indexOfHash === -1 || indexOfId === -1) {
      throw new Error(undefined)
    }
  } catch {
    window.alert('指定されたCSVファイルに問題があります.')
    return
  }

  // 書き込み用データを作成
  for (let index = 2; index < csvData.length; index++) {
    const hash = csvData[index][indexOfHash]
    const id = csvData[index][indexOfId]

    const typeIdentifier = id.substring(0, 2)
    if (typeIdentifier === 'CC' || typeIdentifier === 'EM' || typeIdentifier === 'OV') {
      const daicho = docData.find(item => {
        item.case_id
      })
      updateRequests.push({
        hash: hash,
        target: {

        }
      })
    }
  }
  return undefined
}
