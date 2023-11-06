import { JsonObject, LogicRule, failableBlockTypes } from './types'
import { JSONPath } from 'jsonpath-plus'

class ProcessorVariable {
  // properties
  protected variableName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected variableValues: any[]
  protected constant = false

  // methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor (name: string, values: any[], constant = false) {
    if (!name) {
      throw new TypeError('Proper name is required.')
    }
    this.variableName = name
    this.variableValues = this.arraiseValues(values)
    this.constant = constant
  }

  get name (): string {
    return this.variableName
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get value (): any[] {
    return this.variableValues
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set value (newValue: any[]) {
    if (this.constant) {
      throw new TypeError(`Assignment to constant variable ${this.name}`)
    } else {
      this.variableValues = this.arraiseValues(newValue)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected arraiseValues (newValue: any[]): any[] {
    // perform deepcopy
    if (Array.isArray(newValue)) {
      return JSON.parse(JSON.stringify(newValue))
    } else {
      return JSON.parse(JSON.stringify([newValue]))
    }
  }

  public toString (): string {
    return this.name
  }

  public isWriteable (): boolean {
    return !this.constant
  }
}

/**
 * JSONPathラッパー
 * @param data
 * @param jsonpath
 * @returns [any]
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyJsonpath (data: any, jsonpath: string|string[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any[] = []
  if (data) {
    // 基本的にソースはすべて配列として扱うので非配列は配列化する
    const source = Array.isArray(data) ? data : [data]
    if (jsonpath) {
      // 変数から配列としてjsonpathが渡った場合に対応
      let path = Array.isArray(jsonpath) ? jsonpath[0] : jsonpath
      if (path !== '') {
        // ソースは配列だが、それを意識しないで利用できるようにパスを修正する
        if (path.substring(0, 2) !== '$[' && path.substring(0, 3) !== '$.[') {
          path = '$[0]' + path.substring(1)
        }
        result = JSONPath({
          path,
          json: source
        })
      }
    }
  }
  return result
}

/**
 * 文字列を区切り文字(,もしくはwhitespance)で区切る、連続した区切り文字は一つと数える.ダブルクオートでエスケープ可能
 * @param string
 * @returns string[]
 */
function stringSplitter (source: string): stgring[] {
  const regex = /("[^"\\]*(?:\\.[^"\\]*)*"|\/(?:[^/\\]+|\\.)*\/[gimy]{0,4}|[^,\s]+)/g
  const removeQuotes = /^"((?:\\"|[^"])*)"$/
  return (source.match(regex) || []).map(item => item.replace(removeQuotes, '$1'))
}

/**
 * マクロ実行ユニット
 * @param {JsonObject} 1症例分のオブジェクト
 * @param {LogicRule[]} ルールセット配列
 * @returns {csv: string[], errors: string[]}
 */
// eslint-disable-next-line camelcase
export async function processor (content: { hash?: string, his_id?: string, name?: string, date_of_birth?: string, documentList: JsonObject }, rules: LogicRule[]): Promise<undefined | { csv: string[], errors: string[] }> {
  const hash = content?.hash || ''
  const hisid = content?.his_id || ''
  const name = content?.name || ''
  const dateOfBirth = content?.date_of_birth || ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jesgoDocument = (content.documentList as JsonObject[]).filter(element => (element as any)?.患者台帳)

  // 結果バッファ
  const csvRow: string[] = []
  const errorMessages: string[] = []

  verbose('** JSON-CSV macro processor **')

  // 文書グローバル変数
  const globalVariables: ProcessorVariable[] = []

  globalVariables.push(new ProcessorVariable('$hash', [hash], true))
  globalVariables.push(new ProcessorVariable('$his_id', [hisid], true))
  globalVariables.push(new ProcessorVariable('$name', [name], true))
  globalVariables.push(new ProcessorVariable('$date_of_birth', [dateOfBirth], true))
  globalVariables.push(new ProcessorVariable('$now', (() => {
    const now = new Date()
    const nowYear = now.getFullYear()
    const nowMonth = (now.getMonth() + 1).toString().padStart(2, '0')
    const nowDate = (now.getDate() + 1).toString().padStart(2, '0')
    return [`${nowYear}-${nowMonth}-${nowDate}`]
  })(), true))

  // ルールセットの逐次解析
  const rulesetLength = rules.length
  for (let ruleIndex = 0; ruleIndex < rulesetLength; ruleIndex++) {
    const rule = rules[ruleIndex]

    verbose(`Start ruleset ${ruleIndex}: ${rule.title}`)

    // ソースと変数はルールごとのスコープ
    const variables: ProcessorVariable[] = []

    /**
     * 変数名を列挙
     * @returns string[]
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function enumVariableNames (): string[] {
      const globals = globalVariables.map(item => item.name)
      const locals = variables.map(item => item.name)
      return [...globals, ...locals]
    }

    /**
     * 変数の値を抽出
     * @param string 変数名
     * @returns JsonObject[]
     */
    function getVariableValueByName (name: string): JsonObject[] {
      if (name !== undefined && name !== null) {
        let index = globalVariables.findIndex(item => item.name === name)
        if (index >= 0) {
          return globalVariables[index].value
        }

        index = variables.findIndex(item => item.name === name)
        if (index >= 0) {
          return variables[index].value
        }
      }
      return ['']
    }

    /**
     * 文字列の値か変数名かで適当な値を返す
     * @param string
     * @return JsonObject[]
     */
    function getArgumentValues (str: string): JsonObject[] {
      if (str.charAt(0) === '@' || str.charAt(0) === '$') {
        return getVariableValueByName(str)
      } else {
        return stringSplitter(str)
      }
    }

    /**
     * 変数に値を設定
     * @param string 変数名
     * @param JsonObject[] 値
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function setVariableValueByName (name: string, values: JsonObject[]) {
      if (name !== undefined && name !== null && name !== '') {
        let newValues: JsonObject[] = []
        if (values.length === 1 && typeof values[0] === 'string') {
          // 値が単独の文字列の場合はカンマもしくは空白文字区切りで切り出して配列にする
          newValues = stringSplitter(values[0] as string)
        } else {
          newValues = values
        }

        let index = -1
        // ローカル変数 $[0-9]
        if (/^\$\d$/.test(name)) {
          index = variables.findIndex(item => item.name === name)
          if (index === -1) {
            variables.push(new ProcessorVariable(name, newValues))
          } else {
            variables[index].value = values
          }
          return
        }

        index = globalVariables.findIndex(item => item.name === name)
        if (index >= 0) {
          globalVariables[index].value = newValues
          return
        }

        // 基本的にあり得ないが例外を発生するために用意
        index = variables.findIndex(item => item.name === name)
        if (index >= 0) {
          variables[index].value = newValues
          return
        }

        throw new TypeError(`Invalid variable name ${name}.`)
      }
    }

    // JSONパスでJESGOドキュメントから値を抽出
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function extractFromDocument (jsonpath: string[], source = jesgoDocument): any[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any[] = []
      try {
        // ソースの指定ではjsonpath[0]がメインパス、jsonpath[1]がサブパス
        // 後方互換でjsonpathが配列でない場合はメインパスのみ
        const primarypath: string = jsonpath[0]
        const secondarypath: string = jsonpath[1] || ''

        result = applyJsonpath(source, primarypath)
        if (secondarypath !== '' && result.length > 0) {
          result = applyJsonpath(result, secondarypath)
        }
      } catch (e) {
        verbose(`extractFromDocument: JSONPath exception : ${e}`, true)
      }
      return result
    }

    //
    // ルールセットセットアップ
    //

    // ソース(変更できない)を解析して値を設定する
    if (rule.source) {
      for (let sourceIndex = 0; sourceIndex < rule.source.length; sourceIndex++) {
        let path: string[]
        if (Array.isArray(rule.source[sourceIndex as number].path)) {
          path = [...rule.source[sourceIndex as number].path]
        } else {
          path = [rule.source[sourceIndex as number].path as string || '']
        }
        switch (path[0]) {
          // グローバル変数にも設定されているが後方互換として残す
          case '$hash':
            variables.push(new ProcessorVariable(`@${sourceIndex}`, [hash], true))
            break
          case '$his_id':
            variables.push(new ProcessorVariable(`@${sourceIndex}`, [hisid], true))
            break
          case '$name':
            variables.push(new ProcessorVariable(`@${sourceIndex}`, [name], true))
            break
          case '$date_of_birth':
            variables.push(new ProcessorVariable(`@${sourceIndex}`, [dateOfBirth], true))
            break
          // ドキュメントのパース path = '' はパースする必要がないので定数で返す
          case '':
            variables.push(new ProcessorVariable(`@${sourceIndex}`, [''], true))
            break
          default:
            variables.push(new ProcessorVariable(`@${sourceIndex}`, extractFromDocument(path), true))
        }
      }
    }

    //
    // プロセス実体
    //

    /**
     * ファンクション：比較
     * @param op1 変数名か値
     * @param op1type op1の値抽出タイプ
     * @param op2 変数名か値
     * @param oper 演算子
     * @returns boolean
     */
    function operators (op1: string, op1type = 'value', op2: string, oper = 'eq'): boolean {
      verbose(`Function <compare>: ${op1}, ${op1type}, ${op2}, ${oper}`)

      // 値の設定
      const op1value = op1type === 'value'
        ? getArgumentValues(op1)
        : [getArgumentValues(op1).length.toString()]
      const op2value = getArgumentValues(op2)

      switch (oper) {
        // 単純な比較演算子は先頭の要素のみ
        case 'eq':
          // eslint-disable-next-line eqeqeq
          return op1value[0] == op2value[0]
        case 'gt':
          return op1value[0] > op2value[0]
        case 'ge':
          return op1value[0] >= op2value[0]
        case 'lt':
          return op1value[0] < op2value[0]
        case 'le':
          return op1value[0] <= op2value[0]
        // 集合演算
        case 'in':
          return op1value.some(item => op2value.includes(item))
        case 'incl':
          return op2value.some(item => op1value.includes(item))
        case 'regexp':
          return op1value.some(item => {
            const expression = op2value[0].toString()
            // /.../オプション 形式の正規表現にも対応、ただしgは使用できない
            const patternMatch = expression.match(/^\/((?:[^/\\]+|\\.)*)\/([gimy]{0,4})$/)
            if (patternMatch) {
              return RegExp(patternMatch[1], patternMatch[2].replace('g', '')).test(item.toString())
            } else {
              return RegExp(expression).test(item.toString())
            }
          })
        default:
          verbose(`Illegal operator "${oper}"`, true)
          return false
      }
    }

    /**
     * ファンクション：代入
     * @param src 元の値(変数名もしくは実の値)
     * @param dst 保存先の名前
     * @returns boolean
     */
    function vars (src: string, dst: string): boolean {
      verbose(`Function <assign variables>: ${src} to "${dst}"`)

      try {
        setVariableValueByName(dst, getArgumentValues(src))
        return true
      } catch (e) {
        verbose(`Failed assigning vars to "${dst}".`, true)
        return false
      }
    }

    /**
     * ファンクション：抽出
     * @param src 元の値(変数名もしくは実の値)
     * @param path 指定パス
     * @param dst 保存先の名前
     * @returns boolean
     */
    function query (src: JsonObject[], path = '', dst = ''): boolean {
      verbose(`Function <query>: ${src} by ${path} to "${dst}"`)

      try {
        setVariableValueByName(dst, extractFromDocument([path], src))
        return true
      } catch {
        verbose(`Failed assigning vars to "${dst}".`, true)
      }
      return false
    }

    /**
     * ファンクション：置換 - 元の値はstring[]である事が必須
     * @param src 元の値(変数名もしくは実の値)
     * @param table 置換テーブル 2列複数行の二次元配列
     * @returns boolean
     */
    function translator (src = '', table: string[][]): boolean {
      verbose(`Function <translation>: ${src}`)

      const originalValues = getArgumentValues(src)

      if (originalValues.findIndex(item => typeof item !== 'string') >= 0) {
        verbose(`Translation: failure : ${src} contains other than strings.`, true)
        return false
      }

      verbose(`Translation: input values are ${(originalValues as string[]).join(',')}.`)

      let result = true

      // 変換テーブルの作成
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const translationTableObjects: {match: any, func: any}[] = []
      for (const translationRule of table) {
        // 元の値が空白の場合は対処しない
        if (translationRule[0] === '') {
          continue
        }

        const newValue = translationRule[1].replace(/^"((?:\\"|[^"])*)"$/, '$1')

        const patternMatch = translationRule[0].match(/^\/((?:[^/\\]+|\\.)*)\/([gimy]{0,4})$/)
        // if (/^\/(?:[^/\\]+|\\.)*\/[gimy]{0,4}$/g.test(translationRule[0])) {
        if (patternMatch) {
          // 元の値として 正規表現クエリ が与えられた
          const re = RegExp(patternMatch[1], patternMatch[2])
          translationTableObjects.push({
            match: (value: string) => {
              verbose(`Translation: test ${re}`)
              return value.search(re) !== -1
            },
            func: (value: string) => {
              if (newValue.includes('$')) {
                // 正規表現パターンマッチを利用する置換文字列が指定
                verbose('Translation: match and replace regexp.')
                return value.replace(re, newValue)
              } else {
                verbose('Translation: match regexp.')
                return newValue
              }
            }
          })
        } else {
          // 元の値が文字列 クオートを除去
          const matchString = translationRule[0].replace(/^"((?:\\"|[^"])*)"$/, '$1')
          translationTableObjects.push({
            match: (value: string) => {
              verbose(`Translation: test ${matchString}`)
              return value === matchString
            },
            func: () => {
              verbose('Translation: simple match.')
              return newValue
            }
          })
        }
      }

      verbose(`Translation: created ${translationTableObjects.length} translation rule(s).`)

      // 入力データは配列なので逐次処理
      const newValues:string[] = []
      for (const index in originalValues as string[]) {
        verbose(`Translation: input "${originalValues[index]}" as ${index + 1} of ${(originalValues as string[]).length}`)
        let replaced = false

        // eslint-disable-next-line no-labels
        translationLoop:
        for (const translation of translationTableObjects) {
          if (translation.match(originalValues[index] as string)) {
            newValues[index] = translation.func(originalValues[index] as string)
            replaced = true
            // eslint-disable-next-line no-labels
            break translationLoop
          }
        }

        if (!replaced) {
          verbose('Translation: input does not match any translation rules.')
          result = false
        }
      }

      // 全て置換できたら元のデータを書き換える
      try {
        if (result) {
          setVariableValueByName(src, newValues)
        }
        return result
      } catch {
        return false
      }
    }

    // ファンクション：ソート
    function sortarray (arg = '', indexPath = '', mode = 'asc'): void {
      verbose(`Function <sort>: Sort "${arg}" by "${indexPath}" (${mode})`)

      // 置換できない値が指定された場合はなにもしない
      if (['', '$hash', '$his_id', '$name', '$now'].includes(arg)) {
        verbose(`Sort: "${arg}" is not changable value.`, true)
        return
      }

      const source = getVariableValueByName(arg)
      let result = []
      if (indexPath.trim() === '' || indexPath.trim() === '$') {
        // argの中身で単純にソートする
        result = mode === 'desc'
          ? source.map(item => JSON.stringify(item)).sort().reverse().map(item => JSON.parse(item))
          : source.map(item => JSON.stringify(item)).sort().map(item => JSON.parse(item))
      } else {
        // argの中身に対してJsonpathで抽出された内容をkeyにしてソートする
        // Jsonpathにエラーがあると全ての結果は '' になるので順列は変化しない
        result = source.sort((a, b) => {
          const keya = JSON.stringify(JSONPath({ path: indexPath, json: a }))
          const keyb = JSON.stringify(JSONPath({ path: indexPath, json: b }))
          return keya === keyb ? 0 : ((keya > keyb) ? 1 : -1)
        })
        if (mode === 'desc') {
          result = result.reverse()
        }
      }

      // 元のデータを書き換える
      if (result && arg.charAt(0) === '@') {
        const index = Number(arg.charAt(1)) - 1
        sourceValues.splice(index, 1, result)
      }
      if (result && arg.charAt(0) === '$') {
        const index = Number(arg.charAt(1))
        variables.splice(index, 1, result)
      }
    }

    // ファンクション：日付計算
    function dateCalc (op1: JsonObject[], op2: JsonObject[], mode: string, dst: string): boolean {
      verbose(`Function <dateCalc>: ${op2} to "${dst}"`)

      // 日付フォーマットの確認
      const dateRegexp = /(?<year>\d{4})[-/](?<month>0?[1-9]|1[0-2])[-/](?<date>0?[1-9]|[12][0-9]|3[01])/

      // 基準値の設定
      const op1value: string = op1[0].toString()
      const dateMatch = op1value.match(dateRegexp)
      if (dateMatch === null) {
        verbose(`DateCalc: "${op1}" is not in correct date format.`, true)
        return false
      }

      const baseDate = new Date(
        Number(dateMatch.groups?.year || '1970'),
        Number(dateMatch.groups?.month || '1') - 1,
        Number(dateMatch.groups?.date || '1')
      )

      const results:string[] = []
      for (const target of op2) {
        const targetMatch = target.toString().match(dateRegexp)
        if (targetMatch === null) {
          verbose(`DateCalc: "${target}" is not in correct date format.`, true)
          // 日付計算できない内容が含まれている場合は -1 を出力
          results.push('-1')
        } else {
          const targetDate = new Date(
            Number(targetMatch.groups?.year || '1970'),
            Number(targetMatch.groups?.month || '1') - 1,
            Number(targetMatch.groups?.date || '1')
          )

          let difference = 0
          const roundup = mode.includes(',roundup')
          switch (mode) {
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
              if (mode !== 'days') {
                difference = difference / 7 | 1 + (roundup && difference % 7 !== 0 ? 1 : 0)
              }
              break
            default:
              difference = -1
          }
          results.push(difference.toString())
        }
      }

      // エラーがあったらfalse
      if (results.indexOf('-1') !== -1) {
        return false
      }

      if (
        dst !== '' &&
        ['$hash', '$his_id', '$name', '$now'].indexOf(dst) === -1 &&
        dst.charAt(0) === '$') {
        // 変数に結果を格納
        const index = Number(dst.charAt(1))
        variables[index] = results
        return true
      } else {
        verbose(`DateCals: "${dst}" is not assinable.`)
        return false
      }
    }

    // ファンクション：集合理論演算
    function setOperation (op1: JsonObject[], op2: JsonObject[], mode = 'add', dst = ''): void {
      verbose(`Function <translation>: ${mode} of ${op1} and ${op2} into "${dst}"`)

      // 配列の要素を利用して理論演算を行うのでelementをJSON文字列に一度変換する
      const op1values:string[] = op1.map(element => JSON.stringify(element))
      const op2values:string[] = op2.map(element => JSON.stringify(element))

      let results:string[] = []
      switch (mode) {
        case 'union':
          results = op2values.reduce(
            (accum, item) => [...accum, ...(accum.includes(item) ? [] : [item])],
            [...op1values]
          )
          break
        case 'intersect':
          results = op1values.filter(item => op2values.includes(item))
          break
        case 'difference':
          results = op1values.reduce(
            (accum, item) => [...accum, ...(op2values.includes(item) ? [] : [item])],
            [] as string[]
          )
          break
        case 'xor':
          results = [...op1values, ...op2values].reduce(
            (accum, item, _, orig) => [...accum, ...(orig.filter(value => value === item).length > 1 ? [] : [item])],
            [] as string[]
          )
          break
        case 'add':
        default:
          results = [...op1values, ...op2values]
      }

      if (
        dst !== '' &&
        ['$hash', '$his_id', '$name', '$now'].indexOf(dst) === -1 &&
        dst.charAt(0) === '$') {
        // 変数に結果を格納
        const index = Number(dst.charAt(1))
        variables[index] = results.map(item => JSON.parse(item))
      } else {
        verbose(`DateCals: "${dst}" is not assinable.`)
      }
    }

    // ファンクション：出力
    function assignvars (op1: JsonObject[], dst = '$error', mode = 'semicolon'): boolean {
      verbose(`Function <assign>: "${op1.join(',')}" to "${dst}"`)

      const xlcolToNum = (col: string): number => {
        let num = 0
        for (let pos = 0; pos < col.length; pos++) {
          num *= 26
          num += col.toUpperCase().charCodeAt(pos) - 64
        }
        return num - 1
      }

      // Arrayはflattenされ、オブジェクトは除外して文字列化
      const values = op1.flat(99).filter(item => item.toString() !== '[object Object]')
      let value = ''
      if (values.length > 1) {
        switch (mode) {
          case 'first':
            value = values[0].toString()
            break
          case 'whitespace':
            value = values.join(' ')
            break
          case 'colon':
            value = values.join(':')
            break
          case 'comma':
            value = values.join(',')
            break
          case 'semicolon':
          default:
            value = values.join(';')
        }
      } else {
        value = values.toString()
      }

      if (dst === '$error') {
        // エラーメッセージとして出力
        errorMessages.push(value)
      } else {
        if (/^[A-Z]+$/.test(dst)) {
          // Excel風の列番号で指定
          const colindex = xlcolToNum(dst)
          csvRow[colindex] = value
        } else {
          if (/^([1-9]|[1-9]+[0-9])$/.test(dst)) {
            // 1～の数字で指定
            const colindex = Number(dst) - 1
            csvRow[colindex] = value
          } else {
            // 不正な指定
            verbose(`Assign: illegal column name "${dst}".`, true)
            return false
          }
        }
      }
      return true
    }

    //
    // マクロを逐次実行
    //
    const macroCodes = rule?.procedure || []
    const macroCodeLength = macroCodes.length
    // eslint-disable-next-line no-labels
    steploop: for (let step = 0; step < macroCodeLength;) {
      const procedure = (rule.procedure || [])[step]
      let result = true
      const args = procedure.arguments
      let procedureFunction: () => boolean
      // eslint-disable-next-line no-labels
      operator: switch (procedure.type) {
        case 'Operators': // 条件分岐
          procedureFunction = () => operators(getVariableValueByName(args[0]), args[1] || 'value', getVariableValueByName(args[2]), args[3])
          // eslint-disable-next-line no-labels
          break operator
        case 'Variables':
          procedureFunction = () => {
            vars(getVariableValueByName(args[0]), args[1])
            return (true)
          }
          // eslint-disable-next-line no-labels
          break operator
        case 'Query':
          procedureFunction = () => {
            query(getVariableValueByName(args[0]), args[1], args[2])
            return (true)
          }
          // eslint-disable-next-line no-labels
          break operator
        case 'Translation':
          procedureFunction = () => translator(args[0], procedure.lookup || [['', '']])
          // eslint-disable-next-line no-labels
          break operator
        case 'Sort':
          procedureFunction = () => {
            sortarray(args[0], args[1], args[2])
            return (true)
          }
          // eslint-disable-next-line no-labels
          break operator
        case 'Period':
          procedureFunction = () => dateCalc(getVariableValueByName(args[0]), getVariableValueByName(args[1]), args[2], args[3])
          // eslint-disable-next-line no-labels
          break operator
        case 'Sets':
          procedureFunction = () => {
            setOperation(getVariableValueByName(args[0]), getVariableValueByName(args[1]), args[2], args[3])
            return (true)
          }
          // eslint-disable-next-line no-labels
          break operator
        case 'Store':
          procedureFunction = () => assignvars(getVariableValueByName(args[0]), args[1] || '$error', args[2])
          // eslint-disable-next-line no-labels
          break operator
      }
      result = await new Promise(resolve => setTimeout(() => resolve(procedureFunction()), 0))

      // 結果からの分岐処理
      if (result) {
        // 正常終了
        if (procedure.trueBehavior === 'Abort') {
          // eslint-disable-next-line no-labels
          break steploop // 現在のルールの処理を終了
        } else {
          if (typeof Number(procedure.trueBehavior) === 'number') {
            console.log(`Proceed next ${procedure.trueBehavior} steps.`)
            // move steps forward
            step += procedure.trueBehavior || 1
          } else {
            step++
          }
        }
      } else {
        // 不成功時の対応が設定できる動作であるかを確認
        if (failableBlockTypes.indexOf(procedure.type) !== -1) {
          if (procedure.falseBehavior === 'Exit') {
            // 症例に対する処理の中止
            return undefined
          }
          if (procedure.falseBehavior === 'Abort') {
            // eslint-disable-next-line no-labels
            break steploop // 現在のルールの処理を終了
          }
          if (typeof Number(procedure.falseBehavior) === 'number') {
            // move steps forward
            step += procedure.falseBehavior || 1
          } else {
            step++
          }
        } else {
          step++
        }
      }
    }
  }

  // 返り値の処理
  return {
    csv: csvRow,
    errors: errorMessages
  }
}

function controlUnit () {

}

function verbose (message: string, isError = false): void {
  if (isError) {
    console.error(message)
  } else {
    console.log(message)
  }
}
