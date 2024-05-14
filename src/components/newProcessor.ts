import { pulledDocument, processorOutput, JsonObject, LogicRuleSet, LogicBlock, BlockType } from './types'
import { parseJesgo, verbose } from './utilities'

interface instructionResult {
  success: boolean
  behavior: string
}

// 後方互換を保持してスクリプトコマンドを短縮
// type BlockType = 'Operators'|'Variables'|'Query'|'Translation'|'Sort'|'Period'|'Sets'|'Store'
type v1BlockType = 'oper' | 'var' | 'query' | 'tr' | 'sort' | 'period' | 'set' | 'put'
export type newBlockType = v1BlockType | BlockType

type commandValueTypes = 'value' | 'length' | 'count' | 'number'
type commandOperatorExpressions = 'eq' | '=' | 'gt' | '>' | 'ge' | '>=' | 'lt' | '<' | 'le' | '<=' | 'in' | 'incl' | 're' | 'regexp'
type commandSetsOperators = 'add' | 'union' | 'intersect' | 'difference' | 'xor'
type commandSortDirections = 'asc' | 'ascend' | 'desc' | 'descend'
type commandPeriodOperators = 'years' | 'years,roundup' | 'months' | 'months,roundup' | 'weeks' | 'weeks,roundup' | 'days'
type commandStoreFieldSeparators = 'first' | 'whitespace' | 'colon' | 'comma' | 'semicolon'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type instructionFunction = (...args: any[]) => instructionResult

type translationTableObject = {
  match: (value: string) => boolean
  func: (value: string) => string
}

/**
 * 変数保存クラス
 */
type VariableStore = {
  [key: string]: string[]
}
type VariableProxy = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any[]
}
/**
 * 変数保存オブジェクトのProxy handler
 */
const storeProxyHandler: ProxyHandler<VariableStore> = {
  has: (target: VariableStore, property: string) => property in target,

  get: (target: VariableStore, property: string) => {
    if (!(property in target)) {
      throw new TypeError(`変数"${property}"は未定義です.`)
    }
    return (target[property] || [])
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (target: VariableStore, property: string, value: any[]) => {
    if (!(property in target)) {
      throw new TypeError(`変数"${property}"は未定義です.`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(target, property)
    if (!(descriptor?.writable || false)) {
      throw new TypeError(`変数"${property}"は定数です.`)
    }

    // 値は実態にstring[]として保存される、object/arrayはJSON文字列化する
    target[property].splice(0, Infinity, ...value.map(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        return item.toString()
      } else if (typeof item === 'object') {
        return JSON.stringify(item)
      } else {
        throw new TypeError(`${typeof item}は変数に代入出来ません.`)
      }
    }))
    return true
  },

  defineProperty: (target: VariableStore, property: string, descriptor?: PropertyDescriptor) => {
    if (property in target) {
      throw new TypeError(`変数"${property}"は既に定義されています.`)
    }

    const propertyHeader = property.charAt(0)
    if (propertyHeader !== '@' && propertyHeader !== '$') {
      throw new SyntaxError('変数名は$で開始されている必要があります.')
    }

    if (descriptor === undefined) {
      Object.defineProperty(target, property,
        {
          enumerable: true,
          writable: true,
          configurable: true,
          value: []
        }
      )
    } else {
      const arrayedValue = setValueAsStringArray(descriptor?.value || [])
      const isWritable = descriptor?.writable === undefined ? true : descriptor.writable
      Object.defineProperty(target, property,
        {
          enumerable: true,
          writable: isWritable,
          configurable: true,
          value: arrayedValue
        }
      )
    }
    return true
  },

  deleteProperty: (target: VariableStore, property: string) => {
    if (!(property in target)) {
      throw new TypeError(`変数"${property}"は未定義です.`)
    }
    delete target[property]
    return true
  }
}

/*
  変換プロセッサ
*/
export class Processor {
  // private sourceDefinitions:SourceBlock[][]
  // private compiledRules:instructionFunction[][]

  private variableStore: VariableStore
  private variables: VariableProxy

  public errorMessages: string[]
  public csvRow: string[]

  /**
   * コンストラクター = コンパイラを実行
   * @param ユーザ定義広域変数リスト
   */
  constructor (globalVariables?: string[]) {
    // 変数を初期化
    this.variableStore = {}
    this.variables = new Proxy(this.variableStore, storeProxyHandler)
    // this.sourceDefinitions = []
    // this.compiledRules = []

    this.errorMessages = []
    this.csvRow = []

    // レジスタ変数の用意
    for (let registerIndex = 0; registerIndex < 10; registerIndex++) {
      const registerName = `$${registerIndex}`
      Object.defineProperty(this.variables, registerName, {})
    }

    // システム変数の定義
    Object.defineProperty(this.variables, '$hash', { writable: false })
    Object.defineProperty(this.variables, '$his_id', { writable: false })
    Object.defineProperty(this.variables, '$name', { writable: false })
    Object.defineProperty(this.variables, '$date_of_birth', { writable: false })
    Object.defineProperty(this.variables, '$now', {
      value: ((): string[] => {
        const now = new Date()
        const nowYear = now.getFullYear()
        const nowMonth = (now.getMonth() + 1).toString().padStart(2, '0')
        const nowDate = (now.getDate() + 1).toString().padStart(2, '0')
        return [`${nowYear}-${nowMonth}-${nowDate}`]
      })(),
      writable: false
    })

    // ユーザ定義広域変数の定義
    if (globalVariables) {
      for (const globalVariableName of globalVariables) {
        if (globalVariableName.charAt(0) === '$') {
          Object.defineProperty(this.variables, globalVariableName, { writable: true })
        }
      }
    }
  }

  /**
   * 逐次実行
   * @param content JESGO取得ドキュメント単体
   * @param ruleset
   * @returns $.csv - csvの行アレイ $.errors - エラーメッセージアレイ
   */
  public async run (content: pulledDocument, ruleset: LogicRuleSet[]): Promise<processorOutput | undefined> {
    verbose('* PROCESSOR *')
    try {
      if (!content) {
        throw new Error('ドキュメントが指定されていません.')
      }

      // 出力をクリア
      this.errorMessages.splice(0)
      this.csvRow.splice(0)

      // ドキュメント変数の再定義
      try {
        // eslint-disable-next-line dot-notation
        delete this.variables['$hash']
        // eslint-disable-next-line dot-notation
        delete this.variables['$his_id']
        // eslint-disable-next-line dot-notation
        delete this.variables['$name']
        // eslint-disable-next-line dot-notation
        delete this.variables['$date_of_birth']
      } catch { }

      Object.defineProperties(this.variables, {
        $hash: {
          value: [content?.hash || ''],
          writable: false
        },
        $his_id: {
          value: [content?.his_id || ''],
          writable: false
        },
        $name: {
          value: [content?.name || ''],
          writable: false
        },
        $date_of_birth: {
          value: [content?.date_of_birth || ''],
          writable: false
        }
      })
    } catch (e) {
      console.error(e as Error)
      throw new Error('実行ユニット初期化でエラー\n' + (e as Error).message)
    }

    // ルールを逐次処理
    for (let index = 0; index < ruleset.length; index++) {
      const currentRule = ruleset[index]
      const currentRuleTitle = currentRule.title
      verbose(`* ruleset '${currentRuleTitle}'`)
      try {
        // レジスタ変数の初期化
        for (let registerIndex = 0; registerIndex < 10; registerIndex++) {
          const registerName = `$${registerIndex}`
          if (registerName in this.variables) {
            this.variables[registerName] = []
          }
        }

        // ソースの初期化
        // 既にあるソース変数を削除
        Object.keys(this.variables).filter(name => name.charAt(0) === '@').forEach(
          name => delete this.variables[name]
        )
        // 設定された分だけを設定する
        if (currentRule?.source) {
          for (let sourceIndex = 0; sourceIndex < currentRule.source.length; sourceIndex++) {
            // ソース名は@1～なので indexに+1する
            verbose(`** parse source @${sourceIndex + 1}`)
            const sourceName = `@${sourceIndex + 1}`
            const path = currentRule.source[sourceIndex]?.path || ''
            const subpath = currentRule.source[sourceIndex]?.subpath
            switch (path) {
              case '':
                // 存在しないとは思われるが空白pathはソース未定義にする
                break
              case '$hash':
              case '$his_id':
              case '$name':
              case '$date_of_birth':
                // ドキュメント変数の代入
                Object.defineProperty(this.variables, sourceName, {
                  value: this.variables[path],
                  writable: false
                })
                break
              default:
                Object.defineProperty(this.variables, sourceName, {
                  value: parseJesgo(content.documentList, subpath ? [path, subpath] : path),
                  writable: false
                })
            }
          }
        }

        verbose('** variable definition:')
        console.dir(this.variables)
      } catch (e) {
        console.error(e as Error)
        throw new Error(`${currentRuleTitle} 初期化中にエラー\n` + (e as Error).message)
        // ElMessageBox.alert((e as Error).message, `${currentRuleTitle} 初期化中にエラー`)
        // return undefined
      }

      // コード部分を処理
      if (currentRule?.procedure) {
        const procedures: LogicBlock[] = currentRule.procedure

        // eslint-disable-next-line no-labels
        instructionLoop: for (let counter = 0; counter < procedures.length;) {
          const procedure = procedures[counter]

          try {
            // パラメータの抽出 引数は参照では無く値をコピー
            const command = procedure.type as newBlockType
            const params: string[] = []

            verbose(`** step ${counter + 1} directive ${command}`)

            for (const item of procedure.arguments) {
              params.push((item || '').toString())
            }

            let instruction: instructionFunction

            let operator: string = ''
            let valueType: string = ''
            let variableName: string = ''

            const success: instructionResult = {
              success: true,
              behavior: procedure.trueBehavior.toString() || '+1'
            }
            const failed: instructionResult = {
              success: false,
              behavior: (procedure?.falseBehavior || 'Abort').toString()
            }

            switch (command) {
              case 'var':
              case 'Variables':
                valueType = params[2] || 'value' // 拡張
                variableName = params[1] || ''
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  instruction = () => {
                    const values = this.variables[params[0]]
                    return this.commandVariables(values, variableName, valueType as commandValueTypes)
                      ? success
                      : failed
                  }
                } else {
                  instruction = () => {
                    const values = parseStringToStringArray(params[0])
                    return this.commandVariables(values, variableName, valueType as commandValueTypes)
                      ? success
                      : failed
                  }
                }
                break
              case 'oper':
              case 'Operators':
                valueType = params[1]
                operator = params[3]
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  if (params[2].charAt(0) === '$' || params[2].charAt(0) === '@') {
                    instruction = () => {
                      const valueA = this.variables[params[0]]
                      const valueB = this.variables[params[2]]
                      return this.commandOperators(valueA, valueType as commandValueTypes, valueB, operator as commandOperatorExpressions)
                        ? success
                        : failed
                    }
                  } else {
                    instruction = () => {
                      const valueA = this.variables[params[0]]
                      const valueB = setValueAsStringArray(params[2])
                      return this.commandOperators(valueA, valueType as commandValueTypes, valueB, operator as commandOperatorExpressions)
                        ? success
                        : failed
                    }
                  }
                } else {
                  if (params[2].charAt(0) === '$' || params[2].charAt(0) === '@') {
                    instruction = () => {
                      const valueA = setValueAsStringArray(params[0])
                      const valueB = this.variables[params[2]]
                      return this.commandOperators(valueA, valueType as commandValueTypes, valueB, operator as commandOperatorExpressions)
                        ? success
                        : failed
                    }
                  } else {
                    instruction = () => {
                      const valueA = setValueAsStringArray(params[0])
                      const valueB = setValueAsStringArray(params[2])
                      return this.commandOperators(valueA, valueType as commandValueTypes, valueB, operator as commandOperatorExpressions)
                        ? success
                        : failed
                    }
                  }
                }
                break
              case 'query':
              case 'Query':
                operator = params[1]
                variableName = params[2]
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  instruction = () => {
                    const values = this.variables[params[0]]
                    return this.commandQuery(values, operator, variableName)
                      ? success
                      : failed
                  }
                } else {
                  instruction = () => {
                    return this.commandQuery(setValueAsStringArray(params[0]), operator, variableName)
                      ? success
                      : failed
                  }
                }
                break
              case 'set':
              case 'Sets':
                operator = params[2]
                variableName = params[3]
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  if (params[2].charAt(0) === '$' || params[2].charAt(0) === '@') {
                    instruction = () => {
                      const valueA = this.variables[params[0]]
                      const valueB = this.variables[params[1]]
                      return this.commandSets(valueA, valueB, operator as commandSetsOperators, variableName)
                        ? success
                        : failed
                    }
                  } else {
                    instruction = () => {
                      const valueA = this.variables[params[0]]
                      return this.commandSets(valueA, setValueAsStringArray(params[1]), operator as commandSetsOperators, variableName)
                        ? success
                        : failed
                    }
                  }
                } else {
                  if (params[2].charAt(0) === '$' || params[2].charAt(0)) {
                    instruction = () => {
                      const valueB = this.variables[params[1]]
                      return this.commandSets(setValueAsStringArray(params[0]), valueB, operator as commandSetsOperators, variableName)
                        ? success
                        : failed
                    }
                  } else {
                    instruction = () => {
                      return this.commandSets(setValueAsStringArray(params[0]), setValueAsStringArray(params[1]), operator as commandSetsOperators, variableName)
                        ? success
                        : failed
                    }
                  }
                }
                break
              case 'sort':
              case 'Sort':
                instruction = () => {
                  const valiableName = params[0] || ''
                  const path = params[1] || ''
                  const operator = params[2] || 'asc'
                  return this.commandSort(valiableName, path, operator as commandSortDirections)
                    ? success
                    : failed
                }
                break
              case 'tr':
              case 'Translation':
                instruction = () => {
                  const vaiableName = params[0] || ''
                  const table = this.createTranslationTable(procedure.lookup || [])
                  return this.commandTranslation(vaiableName, table)
                    ? success
                    : failed
                }
                break
              case 'period':
              case 'Period':
                variableName = params[3]
                operator = params[2] || 'months'
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  if (params[1].charAt(0) === '$' || params[1].charAt(0) === '@') {
                    instruction = () => {
                      const valueA = this.variables[params[0]]
                      const valueB = this.variables[params[1]]
                      return this.commandPeroid(valueA, valueB, operator as commandPeriodOperators, variableName)
                        ? success
                        : failed
                    }
                  } else {
                    instruction = () => {
                      const valueA = this.variables[params[0]]
                      return this.commandPeroid(valueA, setValueAsStringArray(params[1]), operator as commandPeriodOperators, variableName)
                        ? success
                        : failed
                    }
                  }
                } else {
                  if (params[1].charAt(0) === '$' || params[1].charAt(0) === '@') {
                    instruction = () => {
                      const valueB = this.variables[params[2]]
                      return this.commandPeroid(setValueAsStringArray(params[0]), valueB, operator as commandPeriodOperators, variableName)
                        ? success
                        : failed
                    }
                  } else {
                    instruction = () => {
                      return this.commandPeroid(setValueAsStringArray(params[0]), setValueAsStringArray(params[1]), operator as commandPeriodOperators, variableName)
                        ? success
                        : failed
                    }
                  }
                }
                break
              case 'put':
              case 'Store':
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  const value = this.variables[params[0]]
                  instruction = () => {
                    return this.commandStore(value, params[1] || '$error', params[2] as commandStoreFieldSeparators)
                      ? success
                      : failed
                  }
                } else {
                  instruction = () => {
                    return this.commandStore(setValueAsStringArray(params[0]), params[1] || '$error', params[2] as commandStoreFieldSeparators)
                      ? success
                      : failed
                  }
                }
                break
              default:
                throw new SyntaxError(`無効な命令: ${command}`)
            }

            // ステップの実行 - ロックアップ防止のためsetTimeout = 0でラップ
            await new Promise(resolve => {
              setTimeout(() => { resolve(undefined) }, 0)
            })
            const result: instructionResult = instruction()

            // 次のステップへ
            verbose(`=> result: ${result.behavior}`)
            switch (result.behavior) {
              case 'Exit':
                if (!result.success) {
                  // 症例に対する処理の中止は処理の不成立の場合のみ
                  return undefined
                }
              // Abortと同義になる
              // eslint-disable-next-line no-fallthrough
              case 'Abort':
                // 現在のルール処理を終了
                // eslint-disable-next-line no-labels
                break instructionLoop
              default:
                if (!Number.isNaN(Number(result.behavior))) {
                  counter += Number(result.behavior)
                } else {
                  counter++
                }
            }
          } catch (e) {
            console.error(e as Error)
            throw new Error(`'${currentRuleTitle}' @${counter + 1} でエラー\n` + (e as Error).message)
            // ElMessageBox.alert((e as Error).message, `'${currentRuleTitle}' @${counter + 1} でエラー`)
            // return undefined
          }
        }
      }
    }
    return {
      csv: this.csvRow,
      errors: this.errorMessages
    }
  }

  /**
   * コマンド Variables 指定された値を変数に代入する
   * @param value
   * @param variableName
   * @returns {boolean}
   */
  private commandVariables = (value: JsonObject[] = [], variableName = '', variableType: commandValueTypes = 'value'): boolean => {
    if (!variableName || variableName === '') {
      throw new SyntaxError('変数名が未指定です.')
    }

    let newvalue:JsonObject[] = []
    switch (variableType) {
      case 'length':
      case 'count':
        newvalue = [value.length.toString()]
        break
      case 'number':
        newvalue = value.map(item => Number(item).toString())
        break
      default:
        newvalue = value
    }
    console.log(`Set ${variableName} = ${newvalue}(${newvalue.length})`)
    this.variables[variableName] = newvalue
    return true
  }

  /**
   * コマンド Operators valueAとvalueBの比較演算をする
   * @param valueA
   * @param valueAtype
   * @param valueB
   * @param operator
   * @returns {boolean}
   */
  private commandOperators = (valueA: string[] = [], valueAtype: commandValueTypes = 'value', valueB: string[] = [], operator: commandOperatorExpressions): boolean => {
    let valueOfA: JsonObject[]
    let valueOfB: JsonObject[]
    switch (valueAtype) {
      case 'value':
        valueOfA = valueA
        valueOfB = valueB
        break
      case 'length':
      case 'count':
        valueOfA = [valueA.length]
        valueOfB = valueB.map(item => Number(item)).filter(item => !Number.isNaN(item))
        break
      case 'number':
        valueOfA = valueA.map(item => Number(item)).filter(item => !Number.isNaN(item))
        valueOfB = valueB.map(item => Number(item)).filter(item => !Number.isNaN(item))
        break
      default:
        throw new SyntaxError(`不正な型指定${valueAtype}です.`)
    }

    switch (operator) {
      // 単純な比較演算子は先頭要素のみ(Number-Stringの型は自動変換に任せる)
      case 'eq':
      case '=':
        // eslint-disable-next-line eqeqeq
        return valueOfA[0] == valueOfB[0]
      case 'gt':
      case '>':
        return valueOfA[0] > valueOfB[0]
      case 'ge':
      case '>=':
        return valueOfA[0] >= valueOfB[0]
      case 'lt':
      case '<':
        return valueOfA[0] < valueOfB[0]
      case 'le':
      case '<=':
        return valueOfA[0] <= valueOfB[0]
      // 集合演算
      case 'in':
        return valueOfA.some(item => valueOfB.includes(item))
      case 'incl':
        return valueOfB.some(item => valueOfA.includes(item))
      case 're':
      case 'regexp':
        return valueOfA.some(item => {
          // 数値が入っていることを想定してtoStringでマップする
          const source = item.toString()
          const expression = valueB[0].toString()

          // /.../オプション 形式の正規表現にも対応、ただしgは使用できない
          const patternMatch = expression.match(/^\/((?:[^/\\]+|\\.)*)\/([gimy]{0,4})$/)
          if (patternMatch) {
            return RegExp(patternMatch[1], patternMatch[2].replace('g', '')).test(source)
          } else {
            return RegExp(expression).test(source)
          }
        })
      default:
        throw new SyntaxError(`不正な演算子${operator}です.`)
    }
  }

  /**
   * commandQuery query文字列で値を処理してその結果をvariableNameに保存する
   * @param value
   * @param query
   * @param variableName
   * @returns
   */
  private commandQuery = (values: string[], query = '', variableName = ''): boolean => {
    if (!query || query === '') {
      // クエリがなければコピーのみ
      return this.commandVariables(values, variableName)
    }

    // 可能であれば値の中のJSONをパースしてオブジェクト階層化する
    const sourceValues:string[] = values.map(item => {
      try {
        return JSON.parse(item)
      } catch {
        return item
      }
    })
    return this.commandVariables(parseJesgo(sourceValues, query), variableName)
  }

  /**
   * commandTranslation 変換テーブルを用いて変数の中身を置換する
   * ※version 0.xからの破壊的変更:
   *  - ソースの書き換え不可～変数のみ
   *  - 置換できなかった場合空白では無く元の値のままになる
   *  - 置換できなかった値があった場合に失敗を返す
   *  - 置換できた値については置換された値が保存される
   * @param variableName
   * @param translationTable
   * @returns
   */
  private commandTranslation = (variableName = '', translationTable: translationTableObject[]): boolean => {
    const newValues: string[] = []
    let replacedAll = true
    for (const sourceValue of this.variables[variableName]) {
      let replacedValue: string | undefined

      for (const translation of translationTable) {
        if (translation.match(sourceValue)) {
          replacedValue = translation.func(sourceValue)
          break
        }
      }

      try {
        if (replacedValue === undefined) {
          replacedAll = false
          throw new Error()
        }

        newValues.push(replacedValue)
      } catch {
        // 置換できなかった場合は元の値のまま
        newValues.push(sourceValue)
      }
    }

    return replacedAll && this.commandVariables(newValues, variableName)
  }

  /**
   * 変換用のテーブルオブジェクトを作成する
   * @param table 変換テーブルアレイ2xn
   * @returns
   */
  private createTranslationTable = (table: string[][]): translationTableObject[] => {
    const tableObject: translationTableObject[] = []

    for (const [pattern, newvalue] of table) {
      // eslint-disable-next-line no-new-wrappers
      const unquotedNewValue = newvalue.replace(/^(?<quote>["'`])(.*)\k<quote>$/, '$2')
      const patternMatch = pattern.match(/^\/((?:[^/\\]+|\\.)*)\/([gimy]{0,4})$/)

      if (patternMatch) {
        const re = new RegExp(patternMatch[1], patternMatch[2])
        if (unquotedNewValue.includes('$')) {
          tableObject.push({
            match: (value: string) => value.search(re) !== -1,
            func: (value: string) => value.replace(re, unquotedNewValue)
          })
        } else {
          tableObject.push({
            match: (value: string) => value.search(re) !== -1,
            func: () => unquotedNewValue
          })
        }
      } else {
        const unquotedPattern = pattern.replace(/^(?<quote>["'`])(.*)\k<quote>$/, '$2')
        tableObject.push({
          // eslint-disable-next-line eqeqeq
          match: (value: string) => value === unquotedPattern,
          func: () => unquotedNewValue
        })
      }
    }

    return tableObject
  }

  /**
   * コマンド Sort 変数の値のソートを行う
   * ※version 0.xからの破壊的変更:
   *  - ソースの書き換え不可～変数のみ
   * @param vaiableName
   * @param indexPath
   * @param mode
   * @returns
   */
  private commandSort = (variableName = '', indexPath = '', mode: commandSortDirections = 'asc'): boolean => {
    if (indexPath.trim() === '') {
      // パス未指定 - 単純比較を行う
      return this.commandVariables(
        mode === 'asc' || mode === 'ascend'
          ? this.variables[variableName].sort()
          : this.variables[variableName].sort().reverse(),
        variableName
      )
    } else {
      const sortedItems = [...this.variables[variableName]]
        .map(item => {
          try {
            return JSON.parse(item)
          } catch {
            return item
          }
        })
        .sort((a, b) => {
          const keya = JSON.stringify(parseJesgo([a], indexPath))
          const keyb = JSON.stringify(parseJesgo([b], indexPath))
          return keya === keyb ? 0 : ((keya > keyb) ? 1 : -1)
        })
        .map(item => JSON.stringify(item))

      return this.commandVariables(
        mode === 'asc' || mode === 'ascend'
          ? sortedItems
          : sortedItems.reverse(),
        variableName
      )
    }
  }

  /**
   * コマンド Sets 集合演算を行い値を変数に保存する
   * @param valueA
   * @param valueB
   * @param operator
   * @param vaiableName
   * @returns
   */
  private commandSets = (valueA: string[], valueB: string[], operator: commandSetsOperators = 'add', variableName = ''): boolean => {
    let resultArray: string[]
    switch (operator) {
      case 'union':
        resultArray = valueB.reduce(
          (accum, item) => [...accum, ...(accum.includes(item) ? [] : [item])],
          [...valueA]
        )
        break
      case 'intersect':
        resultArray = valueA.filter(item => valueB.includes(item))
        break
      case 'difference':
        resultArray = valueA.reduce(
          (accum, item) => [...accum, ...(valueB.includes(item) ? [] : [item])],
          [] as string[]
        )
        break
      case 'xor':
        resultArray = [...valueA, ...valueB].reduce(
          (accum, item, _index, original) => [
            ...accum,
            ...(original.filter(value => value === item).length > 1 ? [] : [item])
          ],
          [] as string[]
        )
        break
      default: // add
        resultArray = [...valueA, ...valueB]
    }

    return this.commandVariables(resultArray.map(item => JSON.parse(item)), variableName)
  }

  /**
   * コマンド Period 日付間隔計算を行う
   * @param valueA [0]を基準日として扱う
   * @param valueB 目的日のアレイ
   * @param mode
   * @param variableName 目的日に対して計算した値を保存, 日付として認識出来ないものは-1
   */
  private commandPeroid = (valueA: string[], valueB: string[], operator: commandPeriodOperators = 'months', variableName = ''): boolean => {
    // 日付フォーマットのパターンマッチ
    const datePattern = /(?<year>\d{4})[-/](?<month>0?[1-9]|1[0-2])[-/](?<date>0?[1-9]|[12][0-9]|3[01])/

    // 値の検証
    const baseMatch = valueA[0].toString().match(datePattern)
    if (baseMatch === null) {
      throw new TypeError(`${valueA[0].toString()}は有効な日付文字列ではありません.`)
    }
    const baseDate = new Date(
      Number(baseMatch.groups?.year || '1970'),
      Number(baseMatch.groups?.month || '1') - 1,
      Number(baseMatch.groups?.date || '1')
    )

    const result: string[] = []
    for (const targetValue of valueB) {
      const targetMatch = targetValue.toString().match(datePattern)
      if (targetMatch === null) {
        result.push('-1')
        break
      }

      const targetDate = new Date(
        Number(targetMatch.groups?.year || '1970'),
        Number(targetMatch.groups?.month || '1') - 1,
        Number(targetMatch.groups?.date || '1')
      )

      // 計算処理
      let difference = 0
      const roundup = operator.includes(',roundup')
      switch (operator) {
        case 'years':
        case 'years,roundup':
          difference = targetDate.getFullYear() - baseDate.getFullYear() +
            (roundup && (targetDate.getTime() > baseDate.getTime()) ? 1 : 0)
          break
        case 'months':
        case 'months,roundup':
          difference = (targetDate.getFullYear() - baseDate.getFullYear()) * 12 +
            (targetDate.getMonth() - baseDate.getMonth()) +
            (roundup && (targetDate.getTime() > baseDate.getTime()) ? 1 : 0)
          break
        case 'weeks':
        case 'weeks,roundup':
        case 'days':
          difference = (targetDate.getTime() - baseDate.getTime()) / (86400000) | 1
          if (operator !== 'days') {
            difference = difference / 7 | 1 + (roundup && difference % 7 !== 0 ? 1 : 0)
          }
          break
        default:
          difference = -1
      }
      result.push(difference.toString())
    }

    return this.commandVariables(result, variableName) && result.includes('-1')
  }

  /**
   * コマンド Store 出力バッファ(文字列)に値を出力する
   * @param values 値のアレイ
   * @param target CSVの桁もしくはエラーバッファ
   * @param mode アレイの出力様式
   */
  private commandStore = (values: JsonObject[], target: string = '$error', mode: commandStoreFieldSeparators = 'first'): boolean => {
    /**
     * エクセルスタイルの列フォーマットを列番号0~に変換
     * @param col
     * @returns
     */
    const xlcolToNum = (col: string): number => {
      let num = 0
      for (let pos = 0; pos < col.length; pos++) {
        num *= 26
        num += col.toUpperCase().charCodeAt(pos) - 64
      }
      return num - 1
    }

    // 値をflattenし、オブジェクトはJSON文字列化する
    const flattenValues = values.flat(99).map(item => item.toString() !== '[object Object]' ? item.toString() : JSON.stringify(item))
    let cellValue = ''
    switch (mode) {
      case 'first':
        cellValue = flattenValues[0] || ''
        break
      case 'whitespace':
        cellValue = flattenValues.join(' ')
        break
      case 'colon':
        cellValue = flattenValues.join(':')
        break
      case 'comma':
        cellValue = flattenValues.join(',')
        break
      case 'semicolon':
      default:
        cellValue = flattenValues.join(';')
    }

    if (target === '$error') {
      this.errorMessages.push(cellValue)
    } else {
      if (/^[A-Z]+$/i.test(target)) {
        const columnIndex = xlcolToNum(target)
        this.csvRow[columnIndex] = cellValue
      } else {
        const columnIndex = Number(target)
        if (Number.isNaN(columnIndex) || columnIndex <= 0) {
          throw new TypeError('桁番号の指定が異常です.')
        }
        this.csvRow[columnIndex] = cellValue
      }
    }
    return true
  }
}

/**
 * 引数を全て文字列配列化して返す
 * @param argValue
 * @returns
 */
function setValueAsStringArray (argValue: unknown | unknown[]): string[] {
  const value: string[] = []
  let source: unknown | unknown[] = argValue

  const regex = /("[^"\\]*(?:\\.[^"\\]*)*"|\/(?:[^/\\]+|\\.)*\/[gimy]{0,4}|[^,\s]+)/g
  const removeQuotes = /^"((?:\\"|[^"])*)"$/

  if (source === undefined) {
    return []
  }

  if (!Array.isArray(source)) {
    source = [source]
  }
  for (let index = 0; index < (source as unknown[]).length; index++) {
    if ((source as unknown[])[index] === null) {
      // null値は問答無用でスキップする
      continue
    }
    if (typeof (source as unknown[])[index] === 'object') {
      // オブジェクトはJSON文字列に変換
      value.push(JSON.stringify((source as unknown[])[index]))
    } else {
      // その他文字列は切り出して配列化する
      const sourceString = ((source as unknown[])[index] as string | number).toString()
      const tokenisedString = (sourceString.match(regex) || []).map(item => item.replace(removeQuotes, '$1'))
      value.push(...tokenisedString)
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
const parseVariableValueArray = (values: string[]): JsonObject[] => values.map(value => {
  // JSON形式で保存されていないものは例外を起こすので、文字列として返す
  // クオートした文字列としてJSONを記載することでオブジェクトを生成出来る
  try { return JSON.parse(value) } catch { return value }
})

/**
 * 文字列を切り出し文字で切り出して配列に変換
 * @param {string} value 文字列
 * @returns {string[]}
 */
export function parseStringToStringArray (value: string): string[] {
  const result: string[] = []
  let quoteType: string = ''
  let currentToken: string = ''

  const delimiters = [' ', ',', '。', '、', '「', '」', '『', '』', '(', ')', '[', ']', '{', '}', '<', '>', '\t', '\r', '\n']
  for (const char of value.trim()) {
    // 非クオート状態で区切り文字(全角スペースも区切り文字扱い)
    if (quoteType === '' && delimiters.includes(char)) {
      // スペースでの区切りが連続した場合は1つの区切りと看做す
      if (char === ',' || currentToken !== '') {
        result.push(currentToken)
        currentToken = ''
      }
      continue
    }

    // クオート処理 シングル・ダブル・バックおよび全角全て可能とする
    const quoteChars = '"\'`“”’｀'
    if (quoteChars.indexOf(char) >= 0) {
      if (quoteType === '') { // クオートイン
        quoteType = char
        // クオートも区切りとして扱う
        if (currentToken !== '') {
          result.push(currentToken)
          currentToken = ''
        }
        continue
      } else { // クオートアウト 全角の “～” 形式にも対応する
        if (char === quoteType || (quoteType === '“' && char === '”')) {
          quoteType = ''
          result.push(currentToken)
          currentToken = ''
          continue
        }
      }
    }

    currentToken += char
  }
  if (currentToken !== '') {
    result.push(currentToken)
  }

  return result
}

/**
 * 後方互換マクロ実行ユニット
 * @param {pulledDocument} 1症例分のオブジェクト
 * @param {LogicRuleSet[]} ルールセット配列
 * @returns {csv: string[], errors: string[]}
 */
// eslint-disable-next-line camelcase
export async function processor (content: pulledDocument, rules: LogicRuleSet[]): Promise<undefined | processorOutput> {
  const processor = new Processor()

  return await processor.run(content, rules)
}
