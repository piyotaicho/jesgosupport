import { pulledDocument, processorOutput, JsonObject, LogicRuleSet, LogicBlock, BlockType, SourceBlock } from './types'
import { parseJesgo, verbose } from './utilities'

export const processorVersion = '1.1.2'

interface instructionResult {
  success: boolean
  behavior: string
}

interface codeBuffer {
  title: string
  code: string[]
  source: SourceBlock[]
}

// 後方互換を保持してスクリプトコマンドを短縮
// type BlockType = 'Operators'|'Variables'|'Query'|'Translation'|'Sort'|'Period'|'Sets'|'Store'
type v1BlockType = 'oper' | 'var' | 'query' | 'tr' | 'sort' | 'period' | 'set' | 'put'
export type newBlockType = v1BlockType | BlockType

type commandValueTypes = 'value' | 'length' | 'count' | 'number'
type commandOperatorExpressions = 'eq' | '=' | 'gt' | '>' | 'ge' | '>=' | 'lt' | '<' | 'le' | '<=' | 'in' | 'incl' | 're' | 'regexp'
type commandSetsOperators = 'add' | 'union' | 'intersect' | 'difference' | 'xor'
type commandSortDirections = 'asc' | 'ascend' | 'desc' | 'descend'
type commandPeriodOperators = 'years' | 'years,roundup' | 'months' | 'months,roundup' | 'weeks' | 'weeks,roundup' | 'days' | 'age' | 'age,roundup'
type commandStoreFieldSeparators = 'array' | 'first' | 'whitespace' | 'colon' | 'comma' | 'semicolon'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type instructionFunction = (processor: Processor) => instructionResult

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

    if (property === '$error') {
      throw new TypeError('変数名"$error"は予約語のため使用できません.')
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
      // 入力は強制的にArrayに修正する
      const arrayedValue = [descriptor?.value || ''].flat(1)
      const isWritable = descriptor?.writable === undefined ? true : descriptor.writable
      const isEmumerable = descriptor?.enumerable === undefined ? true : descriptor.enumerable
      const isConfigurable = descriptor?.configurable === undefined ? true : descriptor.configurable
      Object.defineProperty(target, property,
        {
          enumerable: isEmumerable,
          writable: isWritable,
          configurable: isConfigurable,
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
  // 変数バッファ
  private variableStore: VariableStore
  private variables: VariableProxy

  // 出力バッファ
  private errorMessages: string[]
  private csvRow: string[]

  // トランスパイル済みルールを保持
  private compiling: boolean = false
  private transpiledRuleset: codeBuffer[]
  private disableLogging: boolean

  /**
   * コンストラクタ
   * @param ユーザ定義広域変数リスト
   * @param コンソールへのログ出力を抑制する boolean
   */
  constructor (globalVariables?: string[], disableLogging = false) {
    // 変数を初期化
    this.variableStore = {}
    this.variables = new Proxy(this.variableStore, storeProxyHandler)

    this.errorMessages = []
    this.csvRow = []

    this.disableLogging = disableLogging === true

    // コードバッファ ルールごとに各ステップをstring[]に格納
    // コードは function( processorであるこのオブジェクト自身 ) で、返り値は instructionResult
    this.transpiledRuleset = []
  
    // レジスタ変数とシステム変数の定義と初期化
    this.initVariables()

    // $now はプロセッサ定義時のみしか初期化されない
    Object.defineProperty(this.variables, '$now', {
      value: ((): string[] => {
        const now = new Date()
        const nowYear = now.getFullYear()
        const nowMonth = (now.getMonth() + 1).toString().padStart(2, '0')
        const nowDate = now.getDate().toString().padStart(2, '0')
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
   * レジスタ変数を初期化
   */
  private initRegister () {
    const numberOfRegister = 10
    for (let registerIndex = 0; registerIndex < numberOfRegister; registerIndex++) {
      const registerName = `$${registerIndex}`
      if (!(registerName in this.variables)) {
        Object.defineProperty(this.variables, registerName, {})
      }
      this.variables[registerName] = []
    }

  }

  /**
   * レジスタ変数とドキュメント変数 $~ を初期化
   * @param hash 
   * @param his_id 
   * @param name 
   * @param date_of_birth 
   */
  private initVariables (hash = '', his_id = '', name = '', date_of_birth = '') {
    // $で始まる変数を初期化する
    for (const variableName of Object.keys(this.variables)) {
      if (variableName.charAt(0) === '$') {
        if ([ '$hash', '$his_id', '$name', '$date_of_birth' ].includes(variableName)) {
          // ドキュメント変数は一旦削除する
          delete this.variables[variableName]
        } else {
          // レジスタ変数とグローバル変数を初期化する
          try {
            this.variables[variableName] = []
          } catch {}
        }
      }
    }

    // ドキュメント変数の再定義
    try {
      Object.defineProperties(this.variables, {
        $hash: {
          value: [hash || ''],
          writable: false
        },
        $his_id: {
          value: [his_id || ''],
          writable: false
        },
        $name: {
          value: [name || ''],
          writable: false
        },
        $date_of_birth: {
          value: [date_of_birth || ''],
          writable: false
        }
      })
    } catch {}
  }

  /**
   * ルールセットのコンパイル
   * @param ruleset ルールセットオブジェクトアレイ
   */
  public async compile (ruleset: LogicRuleSet[]) {
    verbose('** COMPILER **', false, this.disableLogging)
    this.compiling = true
  
    // コードバッファを初期化
    this.transpiledRuleset = []

    // 空の内容でレジスタ変数とドキュメント変数を定義
    this.initRegister()
    this.initVariables()

    // ルールセットを逐次処理
    for (let index = 0; index < ruleset.length; index++) {
      const currentRule = ruleset[index]
      const currentRuleTitle = currentRule.title

      const currentTranspiledRule: codeBuffer = {
        title: currentRuleTitle,
        code: [],
        source: currentRule?.source || []
      }

      verbose(`* ruleset '${currentRuleTitle}'`, false, this.disableLogging)
      try {
        // 空の内容でソースの初期化
        // 既にあるソース変数を削除
        Object.keys(this.variables).filter(name => name.charAt(0) === '@').forEach(
          name => delete this.variables[name]
        )
        // 設定された分だけを用意する
        if (currentRule?.source) {
          for (let sourceIndex = 0; sourceIndex < currentRule.source.length; sourceIndex++) {
            const sourceName = `@${sourceIndex + 1}`
            const path = currentRule.source[sourceIndex]?.path || ''
            if (path !== '') {
              Object.defineProperty(this.variables,
                sourceName, {
                value: [''],
                writable: false
              })
            }
          }
        }
      } catch (e) {
        throw new Error(`${currentRuleTitle} ソース定義にエラーがあります\n` + (e as Error).message)
      }

      // コード部分を逐次処理してコードバッファに保存する
      if (currentRule?.procedure) {
        const procedures: LogicBlock[] = currentRule.procedure

        for (let counter = 0; counter < procedures.length; counter++) {
          const procedure = procedures[counter]

          try {
            // パラメータの抽出 引数は参照では無く値をコピー
            const command = procedure.type as newBlockType
            const params: string[] = []

            for (const item of procedure.arguments) {
              params.push((item || '').toString())
            }

            // 結果の解釈文字列の生成
            if (
              (!isNaN(Number(procedure?.trueBehavior)) && Number(procedure.trueBehavior) <= 0) ||
              (!isNaN(Number(procedure?.falseBehavior)) && Number(procedure.falseBehavior) <= 0)
            ) {
              throw new SyntaxError(`${currentRuleTitle} [${counter + 1}]: 指定されたプログラムカウンタのインクリメント値が異常です.`)
            }

            const successBehavior: string = procedure.trueBehavior.toString() || '+1'
            const failureBehavior: string = (procedure?.falseBehavior || 'Abort').toString()

            let checkstr: string[], valuestr: string, valueAstr: string, valueBstr: string, codeStr: string[] = []

            switch (command) {
              case 'var':
              case 'Variables':
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  checkstr = this.variables[params[0]]
                  valuestr = `processor.variables['${params[0]}']`
                } else {
                  valuestr = JSON.stringify(parseStringToStringArray(params[0]))
                }

                if (params[2] && !['value', 'length', 'count', 'number'].includes(params[2])) {
                  throw new SyntaxError(`${params[2]} は不正な指示です.`)
                }

                codeStr.push(`processor.commandVariables(${valuestr}, '${params[1] || ''}', '${params[2] || 'value'}')`)
                break
              case 'oper':
              case 'Operators':
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  checkstr = this.variables[params[0]]
                  valueAstr = `processor.variables['${params[0]}']`
                } else {
                  valueAstr = JSON.stringify(parseStringToStringArray(params[0]))
                }

                if (params[1] && !['value', 'length', 'count', 'number'].includes(params[1])) {
                  throw new SyntaxError(`${params[1]} は不正な指示です.`)
                }

                if (params[2].charAt(0) === '$' || params[2].charAt(0) === '@') {
                  checkstr = this.variables[params[2]]
                  valueBstr = `processor.variables['${params[2]}']`
                } else {
                  valueBstr = JSON.stringify(parseStringToStringArray(params[2]))
                }

                if (!params[3]) {
                  throw new SyntaxError('比較演算子が指定されていません.')
                }
                if (!['eq', '=', 'gt', '>', 'ge', '>=', 'lt', '<', 'le', '<=', 'in', 'incl', 're', 'regexp'].includes(params[3])) {
                  throw new SyntaxError(`不正な比較演算子 ${params[3]} が指示されました.`)
                }

                codeStr.push(`processor.commandOperators(${valueAstr},  '${params[1] || 'value'}', ${valueBstr}, '${params[3]}')`)
                break
              case 'query':
              case 'Query':
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  checkstr = this.variables[params[0]]
                  valuestr = `processor.variables['${params[0]}']`
                } else {
                  valuestr = JSON.stringify(parseStringToStringArray(params[0]))
                }

                codeStr.push(`processor.commandQuery(${valuestr}, '${params[1]}', '${params[2]}')`)
                break
              case 'set':
              case 'Sets':
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  checkstr = this.variables[params[0]]
                  valueAstr = `processor.variables['${params[0]}']`
                } else {
                  valueAstr = JSON.stringify(parseStringToStringArray(params[0]))
                }

                if (params[1].charAt(0) === '$' || params[1].charAt(0) === '@') {
                  checkstr = this.variables[params[1]]
                  valueBstr = `processor.variables['${params[1]}']`
                } else {
                  valueBstr = JSON.stringify(parseStringToStringArray(params[1]))
                }

                if (params[2] && !['add', 'union', 'intersect', 'difference', 'xor'].includes(params[2])) {
                  throw new SyntaxError(`${params[2]} は不正な指示です.`)
                }

                this.variables[params[3]] = []

                codeStr.push(`processor.commandSets(${valueAstr}, ${valueBstr}, '${params[2] || 'add'}', '${params[3]}')`)
                break
              case 'sort':
              case 'Sort':
                this.variables[params[0]] = []

                if (params[2] && !['asc', 'ascend', 'desc', 'descend'].includes(params[2])) {
                  throw new SyntaxError(`${params[2]} は不正な指示です.`)
                }

                codeStr.push(`processor.commandSort('${params[0]}', '${params[1] || ''}',  '${params[2] || 'asc'}')`)
                break
              case 'tr':
              case 'Translation':
                this.variables[params[0]] = []
                try {
                  this.createTranslationTable(procedure?.lookup || [])
                } catch(e) {
                  console.error((e as Error).message)
                  throw new SyntaxError('置換テーブルに問題があります.')
                }

                codeStr.push(
                  `const table = processor.createTranslationTable(${ JSON.stringify(procedure.lookup || []) })`,
                  `processor.commandTranslation( '${params[0]}', table)`
                )
                break
              case 'period':
              case 'Period':
                if (params[3] == '') {
                  throw new SyntaxError('値の保存先が指定されていません.')
                }
                this.variables[params[3]] = []

                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  checkstr = this.variables[params[0]]
                  valueAstr = `processor.variables['${params[0]}']`
                } else {
                  valueAstr = JSON.stringify(parseStringToStringArray(params[0]))
                }

                if (params[1].charAt(0) === '$' || params[1].charAt(0) === '@') {
                  checkstr = this.variables[params[1]]
                  valueBstr = `processor.variables['${params[1]}']`
                } else {
                  valueBstr = JSON.stringify(parseStringToStringArray(params[1]))
                }

                if (params[2] && !['age', 'age,roundup', 'years', 'years,roundup', 'months', 'months,roundup', 'weeks', 'weeks,roundup', 'days'].includes(params[2])) {
                  throw new SyntaxError(`${params[2]} は不正な指示です.`)
                }

                codeStr.push(`processor.commandPeroid(${valueAstr}, ${valueBstr}, '${params[2] || 'months'}', '${params[3]}')`)
                break
              case 'put':
              case 'Store':
                if (params[0].charAt(0) === '$' || params[0].charAt(0) === '@') {
                  checkstr = this.variables[params[0]]
                  valuestr = `processor.variables['${params[0]}']`
                } else {
                  valuestr = JSON.stringify(parseStringToStringArray(params[0]))
                }

                if (params[1].charAt(0) === '$' || params[1].charAt(0) === '@') {
                  if (params[1] !== '$error') {
                    this.variables[params[1]] = []
                  }
                }

                if (params[2] && !['array', 'first', 'whitespace', 'colon', 'comma', 'semicolon'].includes(params[2])) {
                  throw new SyntaxError(`${params[2]} は不正な指示です.`)
                }

                codeStr.push(`processor.commandStore(${valuestr}, '${params[1] || '$error'}', '${params[2] || 'first'}')`)
                break
              default:
                throw new SyntaxError(`無効な命令: ${command}`)
            }
            // 関数コードを生成して保存
            currentTranspiledRule.code.push(codeStr.reduce((accum, value, currentIndex, originalArray):string => {
              if (currentIndex === (originalArray.length - 1)) {
                return accum + 'return ' + value + `\n? { success: true, behavior: '${successBehavior}' } : { success: false, behavior: '${failureBehavior}' }`
              } else {
                return accum + value + '\n'
              }
            }, ''))
          } catch (e) {
            console.error(e as Error)
            this.compiling = false
            throw new Error(`'${currentRuleTitle}' @${counter + 1} でコンパイルエラー\n` + (e as Error).message)
          }
        }

        // コードバッファを保存
        this.transpiledRuleset.push(currentTranspiledRule)
      } else {
        // コードのないルールセットは無視する
        verbose(`# Skipped empty ruleset '${currentRuleTitle}'`, false, this.disableLogging)
      }
    }
    this.compiling = false
  }

  /**
   * 逐次実行
   * @param content JESGO取得ドキュメント単体
   * @returns $.csv - csvの行アレイ $.errors - エラーメッセージアレイ
   */
  public async run (content: pulledDocument): Promise<processorOutput | undefined> {
    verbose('**** EXECUTOR ****', false, this.disableLogging)
    try {
      if (!content) {
        throw new Error('ドキュメントが指定されていません.')
      }

      if (this.transpiledRuleset.length === 0) {
        throw new Error('有効なルールセットがコンパイルされていません.')
      }

      // 出力をクリア
      this.errorMessages.splice(0)
      this.csvRow.splice(0)

      // レジスタ・ドキュメント・グローバル変数の再定義と初期化(ドキュメントごと)
      this.initRegister()
      this.initVariables( content?.hash, content?.his_id, content?.name, content?.date_of_birth)

    } catch (e) {
      console.error(e as Error)
      throw new Error('実行ユニット初期化中にエラー\n' + (e as Error).message)
    }

    // ルールを逐次処理
    // eslint-disable-next-line no-labels
    rulesetLoop: for (let index = 0; index < this.transpiledRuleset.length; index++) {
      const currentRuleTitle = this.transpiledRuleset[index].title
      const currentCodeBuffer = this.transpiledRuleset[index].code
      const currentSources = this.transpiledRuleset[index].source

      verbose(`* ruleset '${currentRuleTitle}'`, false, this.disableLogging)
      try {
        // レジスタ変数の初期化(ルールセットごと)
        this.initRegister()

        // ソースの初期化
        // 既にあるソース変数を削除
        Object.keys(this.variables).filter(name => name.charAt(0) === '@').forEach(
          name => delete this.variables[name]
        )
        // 設定された分だけを設定する
        for (let sourceIndex = 0; sourceIndex < currentSources.length; sourceIndex++) {
          // ソース名は@1～なので indexに+1する
          const sourceName = `@${sourceIndex + 1}`
          const path = currentSources[sourceIndex]?.path || ''
          const subpath = currentSources[sourceIndex]?.subpath
          switch (path) {
            case '':
              // 存在しないとは思われるが空白pathはソース未定義にする
              verbose(`# source @${sourceIndex + 1} is empty`, false, this.disableLogging)
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
              // パス文字列
              Object.defineProperty(this.variables, sourceName, {
                value: parseJesgo(content.documentList, subpath ? [path, subpath] : path),
                writable: false
              })
          }
        }

        if (!this.disableLogging) {
          verbose('# VARIABLES DUMP')
          Object.entries(this.variableStore).forEach(vars => verbose(` ${vars[0]} = ${JSON.stringify(vars[1])}`))
        }
      } catch (e) {
        console.error(e as Error)
        throw new Error(`ルールセット ${currentRuleTitle} 初期化中にエラー\n` + (e as Error).message)
      }

      // コードを実行
      // eslint-disable-next-line no-labels
      instructionLoop: for (let counter = 0; counter < currentCodeBuffer.length;) {
        try {
          verbose(`@${counter + 1}\n${currentCodeBuffer[counter]}`, false, this.disableLogging)

          let instruction: instructionFunction = new Function('processor', currentCodeBuffer[counter]) as instructionFunction

          // ステップの実行 - ロックアップ防止のためsetTimeout = 0でラップ
          const result: instructionResult = await new Promise(resolve => {
            setTimeout(() => { resolve(instruction(this)) }, 0)
          })

          // 次のステップへ
          verbose(`=> Behavior: ${result.behavior}`, false, this.disableLogging)
          switch (result.behavior) {
            case 'Exit':
              if (result.success) {
                // 症例に対する処理の中止は処理の不成立の場合のみなのでエラーとする
                throw new SyntaxError('不正な返り値を取得しました.')
              }
              break rulesetLoop
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
        }
      }
    }

    // Verbose出力 - 内容があったら出力する
    verbose('# EXECUTION END', false, this.disableLogging)
    verbose('** CSV ROW:', false, this.disableLogging || this.csvRow.length === 0)
    verbose(this.csvRow.join(','), false, this.disableLogging || this.csvRow.length === 0)
    verbose('** ERRORS:', false, this.disableLogging || this.errorMessages.length === 0)
    verbose(this.errorMessages.join('\n'), false, this.disableLogging || this.errorMessages.length === 0)

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
      default: // value
        newvalue = value
    }
    verbose(`* variable ${variableName} <- ${JSON.stringify(newvalue)}`, false, this.disableLogging)
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
    for (const sourceValue of this.variables[variableName]) {
      let replacedValue: string | undefined

      for (const translation of translationTable) {
        if (translation.match(sourceValue)) {
          replacedValue = translation.func(sourceValue)
          break
        }
      }

      if (replacedValue === undefined) {
        newValues.push(sourceValue)
      } else {
        newValues.push(replacedValue)
      }
    }

    return this.commandVariables(newValues, variableName)
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
      // パス未指定
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

    return this.commandVariables(resultArray, variableName)
  }

  /**
   * コマンド Period 日付間隔計算を行う
   * @param valueA [0]を基準日として扱う
   * @param valueB 目的日のアレイ
   * @param mode
   * @param variableName 目的日に対して計算した値を保存, 日付として認識出来ないものは-1
   */
  private commandPeroid = (valueA: string[], valueB: string[], operator: commandPeriodOperators = 'months', variableName = ''): boolean => {
    const result: string[] = []
    let formatErrorFlag = false

    // 日付フォーマットのパターンマッチ
    const datePattern = /(?<year>\d{4})[-/](?<month>1[0-2]|0?[1-9])[-/](?<date>[12][0-9]|3[01]|0?[1-9])/

    let baseDate: Date = new Date(1970, 0, 1) // 基準日を初期化
    try {
      // 基準値の検証
      const baseMatch = (valueA[0] || '').toString().match(datePattern)
      if (baseMatch === null) {
        throw new TypeError(`基準日 ${(valueA[0] || '').toString()} は有効な日付文字列ではありません.`)
      }
      baseDate = new Date(
        Number(baseMatch.groups?.year || '1970'),
        Number(baseMatch.groups?.month || '1') - 1,
        Number(baseMatch.groups?.date || '1')
      )
    } catch (e: any) {
      if (this.compiling) {
        throw e as Error
      }
      console.error(e.message)
      formatErrorFlag = true      
    }

    for (const targetValue of valueB) {
      if (formatErrorFlag) {
        // 基準日が不正な場合は全て-1を返す
        result.push('-1')
        continue
      }

      let difference = -1

      try {
        const targetMatch = (targetValue || '').toString().match(datePattern)
        if (targetMatch === null) {
          throw new TypeError(`比較対象 ${(targetValue || '').toString()} は有効な日付文字列ではありません.`)
        }

        const targetDate = new Date(
          Number(targetMatch.groups?.year || '1970'),
          Number(targetMatch.groups?.month || '1') - 1,
          Number(targetMatch.groups?.date || '1')
        )

        // 計算処理
        const roundup = operator.includes(',roundup')
        switch (operator) {
          case 'age': // 満年齢
          case 'age,roundup': // 数え年
            // 年齢計算
            difference = targetDate.getFullYear() - baseDate.getFullYear()
            if (roundup) {
              // 数え年なので単純に年計算に+1となる
              difference += 1
            } else {
              // 満年齢の丸め処理
              // 年齢計算は誕生日を過ぎているかどうかで決定
              // 誕生日を過ぎていればその年齢、過ぎていなければ前の年齢
              difference += (
                targetDate.getMonth() > baseDate.getMonth() ||
                (targetDate.getMonth() === baseDate.getMonth() && targetDate.getDate() >= baseDate.getDate())
              ) ? 0 : -1
            }

            if (difference < 0) {
              // 年齢がマイナスになった場合は0を返す
              difference = 0
            }
            break
          case 'years':
          case 'years,roundup':
            difference = targetDate.getFullYear() - baseDate.getFullYear()
            if (roundup) {
              // 年の丸め処理
              difference += (
                targetDate.getMonth() > baseDate.getMonth() ||
                (targetDate.getMonth() === baseDate.getMonth() && targetDate.getDate() >= baseDate.getDate())
              )
                ? 1 : 0
            }
            break
          case 'months':
          case 'months,roundup':
            difference = (targetDate.getFullYear() - baseDate.getFullYear()) * 12 +
              (targetDate.getMonth() - baseDate.getMonth())
            if (roundup) {
              // 月の丸め処理
              difference += (
                targetDate.getDate() >= baseDate.getDate() ||
                (targetDate.getDate() === baseDate.getDate() && targetDate.getTime() > baseDate.getTime())
              )
                ? 1 : 0
            }
            break
          case 'weeks':
          case 'weeks,roundup':
            if (roundup) {
              // 週の丸め処理
              difference = Math.ceil((targetDate.getTime() - baseDate.getTime()) / (604800000))
            } else {
              difference = Math.floor((targetDate.getTime() - baseDate.getTime()) / (604800000))
            }
            break
          case 'days':
            difference = Math.floor((targetDate.getTime() - baseDate.getTime()) / 86400000)
            break
          default:
            throw new Error(`無効なオペレータ ${operator} です.`)
        }

      } catch (e: any) {
        if (this.compiling) {
          throw e as Error
        }
        console.error((e as Error).message)
      }
      result.push(difference.toString())
    }
    return this.commandVariables(result, variableName)
  }

  /**
   * コマンド Store 出力バッファ(文字列)に値を出力する
   * @param values 値のアレイ
   * @param target CSVの桁指定もしくは変数, エラーバッファ CSV桁指定は MSExcel形式(A,B...Z,AA)のほかCells形式(1～)をサポート
   * @param mode アレイの出力様式指定
   */
  private commandStore = (values: JsonObject[], target: string = '$error', mode: commandStoreFieldSeparators = 'first'): boolean => {
    /**
     * エクセルスタイルの列フォーマットを列番号0~に変換
     * @param col
     * @returns
     */
    const collabelToNum = (col: string): number => {
      let num = Number(col)
      if (Number.isNaN(num)) {
        num = 0
        for (let pos = 0; pos < col.length; pos++) {
          num *= 26
          num += col.toUpperCase().charCodeAt(pos) - 64
        }
        return num - 1  
      } else {
        if (num > 0) {
          return num - 1
        }
        throw new SyntaxError(`列表記 ${col} は不正です.`)
      }
    }

    let colIndexes: number[] = []
    // 格納先の形式を確認する
    if (target.charAt(0) !== '$') {
      // 対象リストを作成する
      // カンマ区切りをまず分割
      const targets = target.split(',').map(item => item.replace(/\s/g, '').toUpperCase())
      for(let i = 0; i < targets.length; i++) {
        // コロン表記の抽出
        const targetParams = targets[i].match(/^([0-9A-Z]+)(:([0-9A-Z]+))?$/)
        if(targetParams === null) {
          throw new SyntaxError(`列表記 ${target} は不正です.`)
        }

        const start = collabelToNum(targetParams[1])
        if (targetParams[3] !== undefined) {
          // コロン表記の範囲指定
          const end = collabelToNum(targetParams[3])
          if (start <= end) {
            for (let index = start; index <= end; index++) {
              colIndexes.push(index)
            }
          } else {
            for (let index = start; index >= end; index--) {
              colIndexes.push(index)
            }
          }
        } else {
          colIndexes.push(start)
        }
      }
    }

    // 値をflattenし、オブジェクトはJSON文字列化する
    const colValues = values.flat(99).map(item => item.toString() !== '[object Object]' ? item.toString() : JSON.stringify(item))
    switch (mode) {
      case 'array': 
        break
      case 'whitespace':
        colValues.splice(0, 0, colValues.join(' '))
        colValues.splice(1)
        break
      case 'colon':
        colValues.splice(0, 0, colValues.join(':'))
        colValues.splice(1)
        break
      case 'comma':
        colValues.splice(0, 0, colValues.join(','))
        colValues.splice(1)
        break
      case 'semicolon':
        colValues.splice(0, 0, colValues.join(';'))
        colValues.splice(1)
        break
      case 'first':
      default:
        colValues.splice(1)
    }

    // 値を対象に保存する
    if (target.charAt(0) === '$') {
      if (target === '$error') {
        // エラーオブジェクト
        this.errorMessages.push(...colValues)
      } else {
        // 変数
        this.variables[target] = [...colValues]
      }
    } else {
      // カラムに値を設定
      for(let index = 0; index < colIndexes.length; index++) {
        this.csvRow[colIndexes[index]] = colValues[index] || ''
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

  // const delimiters = [' ', ',', '。', '、', '「', '」', '『', '』', '(', ')', '[', ']', '{', '}', '<', '>', '\t', '\r', '\n']
  const delimiters = [' ', ',', '\t', '\r', '\n']
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
export async function processor (content: pulledDocument, rules: LogicRuleSet[], documentVariables?:string[]): Promise<undefined | processorOutput> {
  const processor = new Processor(documentVariables)
  processor.compile(rules)

  return await processor.run(content)
}
