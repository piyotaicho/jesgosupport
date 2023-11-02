import { JsonObject, LogicRule, failableBlockTypes } from './types'
import { JSONPath } from 'jsonpath-plus'

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

  // ルールセットの逐次解析
  const rulesetLength = rules.length
  for (let ruleIndex = 0; ruleIndex < rulesetLength; ruleIndex++) {
    const rule = rules[ruleIndex]

    verbose(`Start ruleset ${ruleIndex}: ${rule.title}`)

    // ソースと変数はルールごとのスコープ
    // ソースの数は将来の拡張に備えて不定とする
    const sourceValues: (JsonObject|undefined)[][] = []
    // 変数は 1-9,0の10個と規程
    const variables: (JsonObject|undefined)[][] = [[], [], [], [], [], [], [], [], [], [], []]

    // 引数の実値への展開
    function parseArg (arg: string): JsonObject[] {
      if (arg !== undefined && arg !== null) {
        // @ソース値
        if (arg.charAt(0) === '@') {
          const index = Number(arg.charAt(1)) - 1
          return sourceValues[index] as JsonObject[] || ['']
        }

        // $変数
        if (arg.charAt(0) === '$') {
          if (arg === '$hash') {
            return [hash]
          }

          if (arg === '$now') {
            const now = new Date()
            const nowYear = now.getFullYear()
            const nowMonth = (now.getMonth() + 1).toString().padStart(2, '0')
            const nowDate = (now.getDate() + 1).toString().padStart(2, '0')
            return [`${nowYear}-${nowMonth}-${nowDate}`]
          }

          // $number - 変数
          const index = Number(arg.charAt(1))
          return variables[index] as JsonObject[] || ['']
        }

        // 文字列の場合はカンマもしくは空白文字区切りで切り出して配列にする
        const regex = /("[^"\\]*(?:\\.[^"\\]*)*"|\/(?:[^/\\]+|\\.)*\/[gimy]{0,4}|[^,\s]+)/g
        const removeQuotes = /^"((?:\\"|[^"])*)"$/
        return (arg.match(regex) || []).map(item => item.replace(removeQuotes, '$1'))
      } else {
        return ['']
      }
    }

    // JSONパスでJESGOドキュメントから値を取得
    function parseJesgo (jsonpath: string | string[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any
      try {
        // jsonpathが配列の場合は[0]がメイン
        const primarypath: string = Array.isArray(jsonpath) ? jsonpath[0] : jsonpath
        result = JSONPath({
          path: primarypath,
          json: jesgoDocument
        })

        // サブパスがあれば続いて処理する
        if (Array.isArray(jsonpath) && (jsonpath[1] || '') !== '') {
          result = JSONPath({
            path: jsonpath[1],
            json: result
          })
        }
      } catch (e) {
        verbose(`parseJesgo: JSONPath exception : ${e}`, true)
      }
      return result
    }

    // ソースを解析して値を設定する
    if (rule.source) {
      for (let sourceIndex = 0; sourceIndex < rule.source.length; sourceIndex++) {
        const path = rule.source[sourceIndex as number].path || ''
        if (path !== '') {
          switch (path) {
            case '$hash':
              sourceValues.splice(sourceIndex, 1, [hash])
              break
            case '$his_id':
              sourceValues.splice(sourceIndex, 1, [hisid])
              break
            case '$name':
              sourceValues.splice(sourceIndex, 1, [name])
              break
            case '$date_of_birth':
              sourceValues.splice(sourceIndex, 1, [dateOfBirth])
              break
            default:
              sourceValues.splice(sourceIndex, 1, parseJesgo(path))
          }
        }
        console.log(`Parse source[${sourceIndex}], assigned ${JSON.stringify(sourceValues[sourceIndex])}.`)
      }
    }

    // プロセス実体
    // ファンクション：比較
    function operators (op1: JsonObject[], op1type = 'value', op2: JsonObject[], oper = 'eq'): boolean {
      verbose(`Function <compare>: ${op1.join(',')}, ${op1type}, ${op2.join(',')}, ${oper}`)

      // 値1の値か数かを指定
      const op1value = op1type === 'value' ? op1 : [op1.length.toString()]

      switch (oper) {
        // 単純な比較演算子は先頭の要素のみ
        case 'eq':
          // eslint-disable-next-line eqeqeq
          return op1value[0] == op2[0]
        case 'gt':
          return op1value[0] > op2[0]
        case 'ge':
          return op1value[0] >= op2[0]
        case 'lt':
          return op1value[0] < op2[0]
        case 'le':
          return op1value[0] <= op2[0]
        // 集合演算
        case 'in':
          return op1value.some(item => op2.includes(item))
        case 'incl':
          return op2.some(item => op1value.includes(item))
        case 'regexp':
          return op1value.some(item => {
            const expression = op2[0].toString()
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

    // ファンクション：代入
    function vars (op1: JsonObject[], dst = ''): boolean {
      verbose(`Function <assign variables>: ${op1.join(',')} to "${dst}"`)

      if (dst !== '') {
        if (dst.charAt(0) === '@') {
          // 宛先にソースを指定
          const index = Number(dst.charAt(1)) - 1
          sourceValues[index] = op1
          return true
        }
        if (dst.charAt(0) === '$') {
          // 宛先に変数を指定
          const index = Number(dst.charAt(1))
          variables[index] = op1
          return true
        }
      }
      verbose(`Failed assigning vars to "${dst}".`, true)
      return false
    }

    // ファンクション：抽出
    function query (arg: JsonObject[], path = '', dst = ''): boolean {
      verbose(`Function <query>: ${arg.join(',')} by ${path} to "${dst}"`)

      try {
        if (dst === '') {
          throw new Error()
        }

        const returnValue:JsonObject[] = JSONPath({
          path: path,
          json: arg
        })

        if (dst.charAt(0) === '$') {
          // 宛先は変数のみ
          const index = Number(dst.charAt(1))
          variables[index] = returnValue
          return true
        }
      } catch {
        verbose(`Failed assigning vars to "${dst}".`, true)
      }
      return false
    }

    // ファンクション：置換
    function translator (arg = '', table: string[][]): boolean {
      verbose(`Function <translation>: ${arg}`)

      // 置換できない値が指定された場合はエラー
      if (['', '$hash', '$his_id', '$name', '$now'].includes(arg)) {
        verbose(`Translation: "${arg}" is not tanslatable value.`, true)
        return false
      }

      const originalValues:JsonObject[] = parseArg(arg)
      if (originalValues.toString() === '[object Object]') {
        verbose(`Translation: failure : ${arg} is object.`, true)
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
      if (result && arg.charAt(0) === '@') {
        const index = Number(arg.charAt(1)) - 1
        sourceValues.splice(index, 1, newValues)
      }
      if (result && arg.charAt(0) === '$') {
        const index = Number(arg.charAt(1))
        variables.splice(index, 1, newValues)
      }

      return result
    }

    // ファンクション：ソート
    function sortarray (arg = '', indexPath = '', mode = 'asc'): void {
      verbose(`Function <sort>: Sort "${arg}" by "${indexPath}" (${mode})`)

      // 置換できない値が指定された場合はなにもしない
      if (['', '$hash', '$his_id', '$name', '$now'].includes(arg)) {
        verbose(`Sort: "${arg}" is not changable value.`, true)
        return
      }

      const source = parseArg(arg)
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
          procedureFunction = () => operators(parseArg(args[0]), args[1] || 'value', parseArg(args[2]), args[3])
          // eslint-disable-next-line no-labels
          break operator
        case 'Variables':
          procedureFunction = () => {
            vars(parseArg(args[0]), args[1])
            return (true)
          }
          // eslint-disable-next-line no-labels
          break operator
        case 'Query':
          procedureFunction = () => {
            query(parseArg(args[0]), args[1], args[2])
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
          procedureFunction = () => dateCalc(parseArg(args[0]), parseArg(args[1]), args[2], args[3])
          // eslint-disable-next-line no-labels
          break operator
        case 'Sets':
          procedureFunction = () => {
            setOperation(parseArg(args[0]), parseArg(args[1]), args[2], args[3])
            return (true)
          }
          // eslint-disable-next-line no-labels
          break operator
        case 'Store':
          procedureFunction = () => assignvars(parseArg(args[0]), args[1] || '$error', args[2])
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

function verbose (message: string, isError = false): void {
  if (isError) {
    console.error(message)
  } else {
    console.log(message)
  }
}
