import { JsonObject, LogicRuleSet, SourceBlock, LogicBlock, BlockType } from './types'
import { parseJesgo, verbose } from './utilities'

interface pulledDocument {
  decline: boolean
  documentList: object[]
  hash: string
  date_of_birth?: string
  his_id?: string
  name?: string
}

interface processorOutput {
  csv: string[]
  errors?: string[]
}

interface instructionResult {
  success: boolean
  behavior: string
}

// 後方互換を保持してスクリプトコマンドを短縮
// type BlockType = 'Operators'|'Variables'|'Query'|'Translation'|'Sort'|'Period'|'Sets'|'Store'
type v1BlockType = 'oper'|'var'|'query'|'tr'|'sort'|'period'|'set'|'put'
export type newBlockType = v1BlockType | BlockType

type commandValueTypes = 'value'|'length'
type commandOperatorExpressions = 'eq'|'='|'gt'|'>'|'ge'|'>='|'lt'|'<'|'le'|'<='|'in'|'incl'|'re'|'regexp'
type commandSetsOperators = 'add'|'union'|'intersect'|'difference'|'xor'
type commandSortDirections = 'asc'|'ascend'|'desc'|'descend'
type commandPeriodOperators = 'years'|'years,roundup'|'months'|'months,roundup'|'weeks'|'weeks,roundup'|'days'
type commandStoreFieldSeparators = 'first'|'whitespace'|'colon'|'comma'|'semicolon'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type instructionFunction = (...args:any[]) => instructionResult

type translationTableObject = {
  match: (value:string) => boolean
  func: (value:string) => string
}

/**
 * 変数保存クラス
 */
type VariableStore = {
  [key: string]: string[]
}
type VariableProxy = {
  [key: string]: JsonObject[]
}
/**
 * 変数保存オブジェクトのProxy handler
 */
const storeProxyHandler:ProxyHandler<VariableStore> = {
  has: (target:VariableStore, property:string) => property in target,

  get: (target:VariableStore, property:string) => {
    if (!(property in target)) {
      throw new TypeError(`変数"${property}"は未定義です.`)
    }
    return parseVariableValueArray(target[property] || [])
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (target:VariableStore, property:string, value:any) => {
    if (!(property in target)) {
      throw new TypeError(`変数"${property}"は未定義です.`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(target, property)
    if (!(descriptor?.writable || false)) {
      throw new TypeError(`変数"${property}"は定数です.`)
      return false
    }

    target[property]?.splice(0)
    target[property]?.splice(0, 0, ...setValueAsStringArray(value))
    return true
  },

  defineProperty: (target:VariableStore, property:string, descriptor?:PropertyDescriptor) => {
    if (property in target) {
      throw new TypeError(`変数"${property}"は既に定義されています.`)
      return false
    }

    const propertyHeader = property.charAt(0)
    if (propertyHeader !== '@' && propertyHeader !== '$') {
      throw new SyntaxError('変数名は$で開始されている必要があります.')
      return false
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

  deleteProperty: (target:VariableStore, property:string) => {
    if (!(property in target)) {
      throw new TypeError(`変数"${property}"は未定義です.`)
    }
    delete target[property]
    return true
  }
}

export class Converter {
  private sourceDefinitions:SourceBlock[][]
  private compiledRules:instructionFunction[][]

  private variableStore:VariableStore
  private variables:VariableProxy

  public errorMessages:string[]
  public csvRow:string[]

  /**
   * コンストラクター = コンパイラを実行
   * @param ruleset
   */
  constructor (ruleset: LogicRuleSet[]) {
    if (!ruleset) {
      throw new TypeError('ロジックが指定されていません.')
    }

    // 変数を初期化
    this.variableStore = {}
    this.variables = new Proxy(this.variableStore, storeProxyHandler)
    this.sourceDefinitions = []
    this.compiledRules = []

    this.errorMessages = []
    this.csvRow = []

    this.compiler(ruleset)
  }

  /**
   * コードコンパイラ本体
   * @param ruleset
   */
  private compiler (ruleset: LogicRuleSet[]) {
    // ルールを処理
    const rulesCount = ruleset.length
    for (let index = 0; index < rulesCount; index++) {
      const currentRule = ruleset[index]

      // ソース定義をコピー
      if (currentRule?.source) {
        this.sourceDefinitions.push([...currentRule.source])
      } else {
        this.sourceDefinitions.push([])
      }

      // コード部分を処理
      if (currentRule?.procedure) {
        const procedures:LogicBlock[] = currentRule.procedure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compiledRule:((...args:any[]) => instructionResult)[] = []

        for (let counter = 0; counter < procedures.length; counter++) {
          const procedure = procedures[counter]

          // パラメータの抽出 引数は参照では無く値をコピー
          const command = procedure.type as newBlockType
          const params:string[] = []

          for (const item of procedure.arguments) {
            params.push(item.toString())
          }

          let instruction:instructionFunction
          let operator:string = ''
          let valueType:string = ''
          let variableName:string = ''

          const success:instructionResult = {
            success: true,
            behavior: procedure.trueBehavior.toString() || '+1'
          }
          const failed:instructionResult = {
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
                  const values = parseVariableValueArray(parseStringToStringArray(params[0])) as JsonObject[]
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
                if (params[2].charAt(0) === '$' || params[2].charAt(0)) {
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
                if (params[2].charAt(0) === '$' || params[2].charAt(0)) {
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
                if (params[2].charAt(0) === '$' || params[2].charAt(0)) {
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
                if (params[1].charAt(0) === '$' || params[1].charAt(0)) {
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
                if (params[1].charAt(0) === '$' || params[1].charAt(0)) {
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
          }
          compiledRule.push(instruction)
        }
      }
    }
  }

  /**
   * コマンド Variables 指定された値を変数に代入する
   * @param value
   * @param variableName
   * @returns {boolean}
   */
  private commandVariables = (value: JsonObject[] = [], variableName = '', variableType:commandValueTypes = 'value'): boolean => {
    try {
      if (!variableName || variableName === '') {
        throw new SyntaxError('変数名が未指定です.')
      }

      switch (variableType) {
        case 'length':
          this.variables[variableName] = [value.length]
          break
        default:
          this.variables[variableName] = value
      }
      return true
    } catch (e: unknown) {
      verbose(`Variables: ${(e as Error).message}`, true)
      return false
    }
  }

  /**
   * コマンド Operators valueAとvalueBの比較演算をする
   * @param valueA
   * @param valueAtype
   * @param valueB
   * @param operator
   * @returns {boolean}
   */
  private commandOperators = (valueA: JsonObject[] = [], valueAtype:commandValueTypes = 'value', valueB: JsonObject[] = [], operator:commandOperatorExpressions) :boolean => {
    try {
      let valueOfA:JsonObject[]
      switch (valueAtype) {
        case 'value':
          valueOfA = valueA
          break
        case 'length':
          valueOfA = [valueA.length]
          break
        default:
          throw new SyntaxError(`不正な型指定${valueAtype}です.`)
      }

      switch (operator) {
        // 単純な比較演算子は先頭要素のみ(Number-Stringの型は自動変換に任せる)
        case 'eq':
        case '=':
          // eslint-disable-next-line eqeqeq
          return valueOfA[0] == valueB[0]
        case 'gt':
        case '>':
          return valueOfA[0] > valueB[0]
        case 'ge':
        case '>=':
          return valueOfA[0] >= valueB[0]
        case 'lt':
        case '<':
          return valueOfA[0] < valueB[0]
        case 'le':
        case '<=':
          return valueOfA[0] <= valueB[0]
        // 集合演算
        case 'in':
          return valueOfA.some(item => valueB.includes(item))
        case 'incl':
          return valueB.some(item => valueOfA.includes(item))
        case 're':
        case 'regexp':
          return valueOfA.some(item => {
            const expression = valueB[0].toString()
            // /.../オプション 形式の正規表現にも対応、ただしgは使用できない
            const patternMatch = expression.match(/^\/((?:[^/\\]+|\\.)*)\/([gimy]{0,4})$/)
            if (patternMatch) {
              return RegExp(patternMatch[1], patternMatch[2].replace('g', '')).test(item.toString())
            } else {
              return RegExp(expression).test(item.toString())
            }
          })
        default:
          throw new SyntaxError(`不正な演算子${operator}です.`)
      }
    } catch (e:unknown) {
      verbose(`Operators: ${(e as Error).message}`, true)
      return false
    }
  }

  /**
   * commandQuery query文字列で値を処理してその結果をvariableNameに保存する
   * @param value
   * @param query
   * @param variableName
   * @returns
   */
  private commandQuery = (value: JsonObject[], query = '', variableName = ''): boolean => {
    try {
      if (!query || query === '') {
        return this.commandVariables(value, variableName)
      }
      return this.commandVariables(parseJesgo(value, query), variableName)
    } catch (e:unknown) {
      verbose(`Query: ${(e as Error).message}`, true)
      return false
    }
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
    try {
      const newValues:JsonObject[] = []
      let replacedAll = true
      for (const item of (this.variables[variableName] as JsonObject[])) {
        let sourceValue:string = ''
        let replacedValue:string|undefined

        switch (typeof item) {
          case 'string':
            sourceValue = item as string
            break
          case 'object':
            sourceValue = JSON.stringify(item)
            break
          default:
            sourceValue = item.toString()
        }

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

          switch (typeof item) {
            case 'object':
              newValues.push(JSON.parse(replacedValue))
              break
            default:
              newValues.push(replacedValue)
          }
        } catch {
          // 置換できなかった場合は元の値を設定する
          newValues.push(item)
        }
      }

      return replacedAll && this.commandVariables(newValues, variableName)
    } catch (e:unknown) {
      verbose(`Translation: ${(e as Error).message}`, true)
      return false
    }
  }

  /**
   * 変換用のテーブルオブジェクトを作成する
   * @param table 変換テーブルアレイ2xn
   * @returns
   */
  private createTranslationTable = (table:string[][]): translationTableObject[] => {
    const tableObject:translationTableObject[] = []

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
          match: (value:string) => value === unquotedPattern,
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
  private commandSort = (vaiableName = '', indexPath = '', mode:commandSortDirections = 'asc'): boolean => {
    try {
      if (indexPath.trim() === '' || indexPath.trim() === '$') {
        return this.commandVariables(
          mode === 'asc' || mode === 'ascend'
            ? (this.variables[vaiableName] as JsonObject[])
                .map(item => JSON.stringify(item))
                .sort()
                .map(item => JSON.parse(item))
            : (this.variables[vaiableName] as JsonObject[])
                .map(item => JSON.stringify(item))
                .sort()
                .reverse()
                .map(item => JSON.parse(item)),
          vaiableName
        )
      } else {
        const sortedItems = (this.variables[vaiableName] as JsonObject[])
          .sort((a, b) => {
            const keya = JSON.stringify(parseJesgo(a, indexPath))
            const keyb = JSON.stringify(parseJesgo(b, indexPath))
            return keya === keyb ? 0 : ((keya > keyb) ? 1 : -1)
          })

        return this.commandVariables(
          mode === 'asc' || mode === 'ascend'
            ? sortedItems
            : sortedItems.reverse(),
          vaiableName
        )
      }
    } catch (e:unknown) {
      verbose(`Sort: ${(e as Error).message}`, true)
      return false
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
  private commandSets = (valueA: JsonObject[], valueB: JsonObject[], operator:commandSetsOperators = 'add', valiableName = ''):boolean => {
    try {
      const jsonsA:string[] = valueA.map(item => JSON.stringify(item))
      const jsonsB:string[] = valueB.map(item => JSON.stringify(item))

      let resultArray:string[]
      switch (operator) {
        case 'union':
          resultArray = jsonsB.reduce(
            (accum, item) => [...accum, ...(accum.includes(item) ? [] : [item])],
            [...jsonsA]
          )
          break
        case 'intersect':
          resultArray = jsonsA.filter(item => jsonsB.includes(item))
          break
        case 'difference':
          resultArray = jsonsA.reduce(
            (accum, item) => [...accum, ...(jsonsB.includes(item) ? [] : [item])],
            [] as string[]
          )
          break
        case 'xor':
          resultArray = [...jsonsA, ...jsonsB].reduce(
            (accum, item, _index, original) => [
              ...accum,
              ...(original.filter(value => value === item).length > 1 ? [] : [item])
            ],
            [] as string[]
          )
          break
        default: // add
          resultArray = [...jsonsA, ...jsonsB]
      }

      return this.commandVariables(resultArray.map(item => JSON.parse(item)), valiableName)
    } catch (e:unknown) {
      verbose(`Set operation: ${(e as Error).message}`, true)
      return false
    }
  }

  /**
   * コマンド Period 日付間隔計算を行う
   * @param valueA [0]を基準日として扱う
   * @param valueB 目的日のアレイ
   * @param mode
   * @param variableName 目的日に対して計算した値を保存, 日付として認識出来ないものは-1
   */
  private commandPeroid = (valueA: JsonObject[], valueB: JsonObject[], operator:commandPeriodOperators = 'months', variableName = ''): boolean => {
    try {
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

      const result:JsonObject[] = []
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
    } catch (e:unknown) {
      verbose(`Period: ${(e as Error).message}`, true)
      return false
    }
  }

  /**
   * コマンド Store 出力バッファ(文字列)に値を出力する
   * @param values 値のアレイ
   * @param target CSVの桁もしくはエラーバッファ
   * @param mode アレイの出力様式
   */
  private commandStore = (values: JsonObject[], target: string = '$error', mode:commandStoreFieldSeparators = 'first'): boolean => {
    try {
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
    } catch (e:unknown) {
      verbose(`Store: ${(e as Error).message}`, true)
      return false
    }
  }

  /**
   * コンパイル済みコードを実行する
   * @param content JESGO取得ドキュメント単体
   * @returns $.csv - csvの行アレイ $.errors - エラーメッセージアレイ
   */
  public run = async (content:pulledDocument) :Promise<processorOutput|undefined> => {
    if (!content) {
      throw new Error('ドキュメントが指定されていません.')
    }

    // 出力をクリア
    this.errorMessages.splice(0)
    this.csvRow.splice(0)

    // ドキュメント内広域変数を設定
    // システム変数
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
      },
      $now: {
        value: () => {
          const now = new Date()
          const nowYear = now.getFullYear()
          const nowMonth = (now.getMonth() + 1).toString().padStart(2, '0')
          const nowDate = (now.getDate() + 1).toString().padStart(2, '0')
          return [`${nowYear}-${nowMonth}-${nowDate}`]
        },
        writable: false
      }
    })

    // ユーザ変数 - 未実装だけどこっちでは余裕

    // レジスタ変数の用意
    for (let registerIndex = 0; registerIndex < 10; registerIndex++) {
      const registerName = `${registerIndex}`
      if (registerName in this.variables) {
        Object.defineProperty(this.variables, registerName, {})
      }
    }

    const ruleLength = this.compiledRules.length
    const sourceDocument:JsonObject[] = content.documentList

    // ブロックループ
    // eslint-disable-next-line no-labels
    blockLoop: for (let ruleIndex = 0; ruleIndex < ruleLength; ruleIndex++) {
      // ローカル定数の初期化
      Object.keys(this.variables).filter(name => name.charAt(0) === '@').forEach(
        name => delete this.variables[name]
      )
      const sourveValueDefinitions = this.sourceDefinitions[ruleIndex]
      if (sourveValueDefinitions) {
        for (let sourceIndex = 0; sourceIndex < sourveValueDefinitions.length; sourceIndex++) {
          const sourceName = `@${sourceIndex}`
          const path = sourveValueDefinitions[sourceIndex]?.path || ''
          switch (path) {
            case '':
              Object.defineProperty(this.variables, sourceName, {})
              break
            case '$hash':
            case '$his_id':
            case '$name':
            case '$date_of_birth':
              Object.defineProperty(this.variables, sourceName, {
                value: this.variables[path],
                writable: false
              })
              break
            default:
              Object.defineProperty(this.variables, sourceName, {
                value: parseJesgo(sourceDocument, path),
                writable: false
              })
          }
        }
      }

      // レジスタ変数の初期化
      for (let registerIndex = 0; registerIndex < 10; registerIndex++) {
        const registerName = `${registerIndex}`
        if (registerName in this.variables) {
          this.variables[registerName] = []
        }
      }

      // 実行ユニット
      let programCounter:number = 0
      const instructions = this.compiledRules[ruleIndex]
      const maxCount = instructions.length

      // インストラクションループ
      // eslint-disable-next-line no-labels
      instructionLoop: for (;programCounter < maxCount;) {
        const instruction:instructionFunction = instructions[programCounter]

        const result:instructionResult = await new Promise(resolve => {
          setTimeout(() => {
            resolve(instruction())
          }, 0)
        })

        switch (result.behavior) {
          case 'Exit':
            if (!result.success) {
              // 症例に対する処理の中止は処理の不成立にしかない
              return undefined
            }
          // eslint-disable-next-line no-fallthrough
          case 'Abort':
            // 現在のルール処理を終了
            // eslint-disable-next-line no-labels
            break instructionLoop
          default:
            if (Number.isNaN(Number(result.behavior))) {
              programCounter += Number(result.behavior)
            } else {
              programCounter++
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
   * スクリプトの引数文字列が変数であるかをチェック
   * @param value
   * @returns
   */
  // eslint-disable-next-line no-useless-escape
  private isVariableName = (value: string):boolean => /^(@\d+|\$[^.\[])/.test(value)
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
  const result:string[] = []
  let quoteType:string = ''
  let currentItem:string = ''

  const splitters = ' 　,\t'
  for (const char of value.trim()) {
    // 非クオート状態で区切り文字(全角スペースも区切り文字扱い)
    if (quoteType === '' && splitters.indexOf(char) >= 0) {
      // スペースでの区切りが連続した場合は1つの区切りと看做す
      if (char === ',' || currentItem !== '') {
        result.push(currentItem)
        currentItem = ''
      }
      continue
    }

    // クオート処理 シングル・ダブル・バックおよび全角全て可能とする
    const quoteChars = '"\'`“”’｀'
    if (quoteChars.indexOf(char) >= 0) {
      if (quoteType === '') { // クオートイン
        quoteType = char
        // クオートも区切りとして扱う
        if (currentItem !== '') {
          result.push(currentItem)
          currentItem = ''
        }
        continue
      } else { // クオートアウト 全角の “～” 形式にも対応する
        if (char === quoteType || (quoteType === '“' && char === '”')) {
          quoteType = ''
          result.push(currentItem)
          currentItem = ''
          continue
        }
      }
    }

    currentItem += char
  }

  return result
}
