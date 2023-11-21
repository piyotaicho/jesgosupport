import { fa } from 'element-plus/es/locale'
import { JsonObject, LogicRule, failableBlockTypes } from './types'
import { JSONPath } from 'jsonpath-plus'

interface pulledDocument {
  decline: boolean
  documentList: object[]
  hash: string
  date_of_birth?: string
  his_id?: string
  name?: string
}

interface processorOutput {
  csv: string[],
  errors?: string[]
}

export type variableOperations = 'get'|'set'|'define'|'constant'|'enum'|'enumConstants'|'enumNonConstants'|'remove'|'release'

export type variableArgument = {
  operation: variableOperations
  name: string
  value?: JsonObject
  constant?: false
}

type variableDefinition = {
  name: string
  value: string[]
  writable: boolean
}

type variableDescriptor = {
  name?: string
  value?: string[]
  writable?: boolean
}

/**
 * 変数保存クラス
 */
class VariableStore {
  store:variableDefinition[]

  constructor () {
    this.store = []
  }

  public getIndex = (name:string, ignoreUndefined:boolean = false) => {
    const index = this.store.findIndex(variable => variable.name === name)
    if (!ignoreUndefined && index === -1) {
      throw new Error(`変数${name}が未定義です.`)
    }
    return index
  }
}

/**
 * 変数保存クラスのProxy handler
 */
const storeProxyHandler:ProxyHandler<VariableStore> = {
  has: (target:VariableStore, property:string) =>
    target.getIndex(property, true) !== -1,

  get: (target:VariableStore, property:string) =>
    target.store[target.getIndex(property)].value,

  set: (target:VariableStore, property:string, value:unknown) => {
    const index = target.getIndex(property)
    if (!target.store[index].writable) {
      throw new Error(`変数${property}は定数です.`)
      return false
    } else {
      target.store[index].value.splice(0)
      target.store[index].value.splice(0, 0, ...setValueAsStringArray(value))
      return true
    }
  },

  ownKeys: (target:VariableStore) => target.store.map(variable => variable.name),

  defineProperty: (target:VariableStore, property:string, descriptor?:variableDescriptor) => {
    if (property.charAt(0) !== '@' && property.charAt(0) !== '$') {
      throw new Error('変数名は$で開始されている必要があります.')
      return false
    }
    if (target.getIndex(property, true) !== -1) {
      throw new Error(`変数${property}は既に定義されています.`)
      return false
    }
    if (descriptor === undefined) {
      target.store.push({
        name: property,
        value: [],
        writable: true
      })
    } else {
      const arrayedValue = setValueAsStringArray(descriptor.value || [])
      const isWritable = descriptor?.writable === undefined ? true : descriptor.writable
      target.store.push({
        name: property,
        value: arrayedValue,
        writable: isWritable
      })
    }
    return true
  },

  deleteProperty: (target:VariableStore, property:string) => {
    const index = target.getIndex(property)
    target.store.splice(index, 1)
    return true
  },

  getOwnPropertyDescriptor: (target:VariableStore, property:string) => {
    const index = target.getIndex(property)
    return {
      writable: target.store[index].writable,
      value: target.store[index].value
    }
  }
}

/**
 * 変数を格納・操作するProxyオブジェクトを返す
 * @returns Variable-proxy
 */
export const Variables = ():ProxyHandler<VariableStore> => new Proxy(new VariableStore(), storeProxyHandler)

export class converterModule {
  private ruleCache:LogicRule[]
  private compiledRules:unknown[][]

  constructor (rules: LogicRule[]) {
    //
    this.ruleCache = rules
    this.compiledRules = [[]]
  }

  /**
   * コンパイル済みコードを実行する
   * @param content JESGO取得ドキュメント単体
   */
  public run = (content:pulledDocument) => {
    if (!content) {
      throw new Error('ドキュメントが指定されていません.')
    }

    const variables = new Proxy(new VariableStore(), storeProxyHandler)
    // ドキュメント内広域変数を設定
    Object.defineProperty(variables, '$hash',
      {
        value: [content?.hash || ''],
        writable: false
      })
    Object.defineProperty(variables, '$his_id',
      {
        value: [content?.his_id || ''],
        writable: false
      })
    Object.defineProperty(variables, '$name',
      {
        value: [content?.name || ''],
        writable: false
      })
    Object.defineProperty(variables, '$date_of_birth',
      {
        value: [content?.date_of_birth || ''],
        writable: false
      })

    const now = new Date()
    const nowYear = now.getFullYear()
    const nowMonth = (now.getMonth() + 1).toString().padStart(2, '0')
    const nowDate = (now.getDate() + 1).toString().padStart(2, '0')
    Object.defineProperty(variables, '$now',
      {
        value: [`${nowYear}-${nowMonth}-${nowDate}`],
        writable: false
      })

    // 実行ユニット
    const ruleLength = this.ruleCache.length
    const sourceDocument:JsonObject[] = content.documentList

    // ブロックループ
    for (let ruleIndex = 0; ruleIndex < ruleLength; ruleIndex++) {
      // ローカル変数の初期化
      const sourveValueDefinitions = this.ruleCache[ruleIndex].source
      if (sourveValueDefinitions) {
        for (let sourceIndex = 0; sourceIndex < sourveValueDefinitions.length; sourceIndex++) {
          const path = sourveValueDefinitions[sourceIndex].path
          const sourceName = `@${sourceIndex}`
          if (path !== '') {
            switch (path) {
              case '$hash':
              case '$his_id':
              case '$name':
              case '$date_of_birth':
                Object.defineProperty(variables, path, {
                  value: variables[path]
                })
                variables.next({
                  operation: 'constant',
                  name: sourceName,
                  value: variables.next({
                    operation: 'get',
                    name: path
                  }).value()
                })
                break
              default:
                variables.next({
                  operation: 'constant',
                  name: sourceName,
                  value: extractJsonDocumentByPath(content.documentList as JsonObject, path)
                })
            }
          }
        }
      }
    }
    

    }

}




/**
 * 引数を全て文字列配列化して返す
 * @param argValue
 * @returns
 */
function setValueAsStringArray (argValue: unknown|unknown[]): string[] {
  const value:string[] = []
  let source:unknown|unknown[] = argValue

  if (argValue !== undefined) {
    if (!Array.isArray(source)) {
      source = [source]
    }
    for (let index = 0; index < (source as unknown[]).length; index++) {
      if ((source as unknown[])[index] === null) {
        // null値は問答無用でスキップする
        continue
      }
      if (typeof (source as unknown[])[index] === 'object') {
        value.push(JSON.stringify((source as unknown[])[index]))
      } else {
        value.push(((source as unknown[])[index] as string|number).toString())
      }
    }
  }
  return value
}

/**
 * 文字列配列を文字列もしくは何らかのオブジェクト配列に変換
 * @param {string} values 文字列配列
 * @returns {unknown[]}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseVariableValueArray (values: string[]): unknown[] {
  const results:unknown[] = []
  for (const value of values) {
    try {
      const parsed = JSON.parse(value)
      results.push(parsed)
    } catch {
      results.push(value)
    }
  }
  return results
}

/**
 * 文字列を切り出し文字で切り出して配列に変換
 * @param {string} value 文字列
 * @returns {string[]}
 */
export function parseStringToStringArray (value: string): string[] {
  const result:string[] = []
  let quoteType:string = ''
  let chrrentItem:string = ''

  for (const char of value.trim()) {
    // 非クオート状態で区切り文字(全角スペースも区切り文字扱い)
    if (quoteType === '' && (char === ' ' || char === '　' || char === ',')) {
      // スペースでの区切りが連続した場合は1つの区切りと看做す
      if (char === ',' || chrrentItem !== '') {
        result.push(chrrentItem)
        chrrentItem = ''
      }
      continue
    }

    // クオート処理 シングル・ダブル・バック全て可能とする
    if (char === '"' || char === '\'' || char === '`') {
      if (quoteType === '') { // クオートイン
        quoteType = char
        // クオートも区切りとして扱う
        if (chrrentItem !== '') {
          result.push(chrrentItem)
          chrrentItem = ''
        }
        continue
      } else { // クオートアウト
        if (char === quoteType) {
          quoteType = ''
          result.push(chrrentItem)
          chrrentItem = ''
          continue
        }
      }
    }

    chrrentItem += char
  }

  return result
}
