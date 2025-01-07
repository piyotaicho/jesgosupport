import Papa from 'papaparse'

// papaParseをインポートする小技、その他のpapaParse一式もexportされている
export const papaParse = Papa

/**
 * JSONファイルをInput type="FILE"とFileReaderで読み込む
 * @returns string
 */
export async function loadJSONfile (): Promise<string> {
  return await new Promise(resolve => {
    const inputFile = document.createElement('input') as HTMLInputElement
    inputFile.type = 'file'
    inputFile.accept = 'application/json'

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
}

/**
 * saveCSV dataURLを使ってファイルにダウンロードさせる(CSV専用)
 * @param data CSVテーブルの2次元配列
 */
export function saveCSV (data:unknown[], offset = 0, filename = 'JESGO出力データ.csv') {
  if (data && Array.isArray(data) && data.length > 0) {
    const offsettedData = []
    for (let count = 0; count < offset; count++) {
      offsettedData.push([])
    }
    offsettedData.push(...data)

    const blob = new Blob([
      Papa.unparse(
        offsettedData,
        {
          header: false,
          delimiter: ',',
          quoteChar: '"'
        }
      )
    ], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchorElement = document.createElement('A') as HTMLAnchorElement
    anchorElement.href = url
    anchorElement.download = filename
    anchorElement.click()
  }
}
