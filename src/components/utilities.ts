import { JsonObject, pulledDocument } from './types'
import { JSONPath } from 'jsonpath-plus'

/**
* userDownload ブラウザでダウンロードさせる
* @param {string} data
* @param {string} filename
*/
export function userDownload (data: string, filename: string): void {
  const blob = filename.toLowerCase().includes('.csv')
    // Excelがアレ過ぎるのでCSVにはBOMをつける
    ? new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), data], { type: 'text/csv' })
    : new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.setAttribute('download', filename)
  a.setAttribute('href', url)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * loadFile FILE APIでファイルをテキストとして読み込む
 * @param {string} ファイル拡張子パターン
 */
export async function loadFile (acceptPattern:string = '.json'): Promise<string|null> { // (event: Event): Promise<string|null> {
  return await new Promise((resolve) => {
    const inputElement = document.createElement('input') as HTMLInputElement
    inputElement.type = 'file'
    inputElement.accept = acceptPattern
    inputElement.style.display = 'none'

    const eventHandler = () => {
      const files = inputElement.files as FileList
      if (files.length > 0) {
        const reader = new FileReader()
        try {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsText(files[0])
        } catch {
          verbose('指定されたファイルにアクセス出来ません.', true)
          resolve(null)
        }
      }
    }
    inputElement.addEventListener('input', eventHandler)
    inputElement.click()
  })
}

/**
 * JSONパスでドキュメントを抽出
 * @param jesgoDocument
 * @param jsonpath
 * @param mode
 * @returns
 */
export function parseJesgo (jesgoDocument: JsonObject, jsonpath: string | string[], mode:'value'|'pointer' = 'value') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any
  const paths = Array.isArray(jsonpath) ? jsonpath : [jsonpath]
  try {
    let path = ''
    // pathが配列を対象としているかチェック
    if (/^\$(\.\[|\[|\.\.|$)/.test(paths[0])) {
      path = paths[0]
    } else {
      if (paths[0].charAt(0) !== '$') {
        // トップオブジェクト指定の省略形
        path = '$[*].' + paths[0]
      } else {
        path = '$[*].' + paths[0].slice(2)
      }
    }
    // JSONpath-plusが.[*]でオブジェクトのvalueを展開してしまうため一段階depthを誤るため[*]に置換する
    path = path.replace('.[*]', '[*]')

    result = JSONPath({
      path,
      json: jesgoDocument,
      resultType: mode
    })

    if (mode === 'value') {
      // このまま結果にするとArray in arrayになるのでflatする
      result = result.flat()
      // value modeのとき、サブパスがあれば続いて再帰的に処理する
      if (paths.length > 1 && paths[1] !== '') {
        result = parseJesgo(result, paths.slice(1), 'value')
      }
    }
  } catch (e) {
    verbose(`parseJesgo: JSONPath exception : ${e}`, true)
  }
  return result || []
}

/**
 * ソースドキュメントアレイにjsonPathでクエリをかけマウントポインタにマウントする
 * @param source ソースドキュメント配列
 * @param path クエリjsonPath配列
 * @param mountPoint 結果のマウントポイント
 */
export function queryDocument (source: pulledDocument[], path: string[]|undefined, mountPointer = '/'): pulledDocument[] {
  /**
   * オブジェクトをpathにマウントしてあたらしいオブジェクトを生成する
   * @param path パス配列
   * @param value 最終的な値オブジェクト(JSONpathの出力なのでarray)
   * @returns 生成されたオブジェクト
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mountValue = (path:string[], value:any):any => {
    if (path.length === 0) {
      return value
    } else {
      if (path[0] === '-') {
        // アレイとして下位を保持するのでここはスルーする
        return mountValue(path.slice(1), value)
      } else {
        return {
          [path[0]]: mountValue(path.slice(1), value)
        }
      }
    }
  }

  const queries = (path || []).filter(item => item !== '' && item !== '$')
  const mountPoint = mountPointer || '/'

  if (queries.length === 0 && mountPoint === '/') {
    // クエリもマウントポイントも無い場合はスルー(旧スクリプト)
    return source || []
  } else {
    const mountPath = mountPoint.split('/').filter(segment => segment !== '')
    const filteredDocuments:JsonObject[] = []

    for (const caseDocument of source) {
      const modifiedDocument: JsonObject = JSON.parse(JSON.stringify(caseDocument))
      let documentList = ((modifiedDocument as {documentList?: JsonObject[]})?.documentList || [])
      if (queries.length > 0) {
        documentList = parseJesgo(documentList, queries)
      }
      // 抽出ドキュメントがあればマウント、なければドキュメントは空白とする
      if (documentList.length !== 0) {
        filteredDocuments.push(Object.assign(modifiedDocument, { documentList: [mountValue(mountPath, documentList)].flat() }))
      } else {
        filteredDocuments.push(Object.assign(modifiedDocument, { documentList: [] }))
      }
    }
    return filteredDocuments as pulledDocument[]
  }
}

/**
 * 要素中にnullがあった場合にその要素を削除する(JESGO errata対応)
 * @param source any
 * @returns nullを除去したもの
 */
export function dropNullValues (source: unknown): unknown {
  const sourceType = Object.prototype.toString.call(source)
  if (sourceType === '[object Number]' || sourceType === '[object String]') {
    return source
  }
  if (sourceType === '[object Array]') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (source as any[])
      .filter(item => Object.prototype.toString.call(item) !== '[object Null]')
      .map(item => dropNullValues(item))
  }
  if (sourceType === '[object Object]') {
    const properties = Object.keys(source as object)
    const sourceObject = source as Record<string, string>
    const newObject: Record<string, string> = {}
    for (const property of properties) {
      if (Object.prototype.toString.call(sourceObject[property]) !== '[object Null]') {
        newObject[property] = dropNullValues(sourceObject[property]) as string
      }
    }
    return newObject as object
  }
}
/**
 * console log のラッパー(開発者ツールが開いているときはダンプする)
 * @param message
 * @param isError エラーとして表示
 */
export function verbose (message: string, isError = false): void {
  if (isError) {
    console.error(message)
  } else {
    if (window.console) {
      console.log(message)
    }
  }
}
