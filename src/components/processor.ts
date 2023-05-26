import { JsonObject, LogicRule } from './types'
import { JSONPath } from 'jsonpath-plus'

/**
 * マクロ実行ユニット
 * @param {JsonObject} 1症例分のオブジェクト
 * @param {LogicRule[]} ルールセット配列
 * @returns {csv: string[][], errors: string[]}
 */
// eslint-disable-next-line camelcase
export function processor (content: { hash?: string, his_id?: string, name?: string, documentList: JsonObject }, rules: LogicRule[]): undefined | { csv: string[], errors: string[] } {
  const hash = content?.hash || ''
  const hisid = content?.his_id || ''
  const name = content?.name || ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jesgoDocument = (content.documentList as JsonObject[]).filter(element => (element as any)?.患者台帳)

  // 結果バッファ
  const csvRow: string[] = []
  const errorMessages: string[] = []

  verbose('** JSON-CSV macro processor **')

  // ルールセットの逐次解析
  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
    const rule = rules[ruleIndex]

    verbose(`Start ruleset ${ruleIndex}: ${rule.title}`)

    // ソースと変数はルールごとのスコープ
    // ソースの数は将来の拡張に備えて不定とする(最大10)
    const sourceValues: (JsonObject|undefined)[][] = []
    // 変数は 1-9,0の10個と規程
    const variables: (JsonObject|undefined)[][] = [[], [], [], [], [], [], [], [], [], [], []]

    // 引数の実値への展開
    function parseArg (arg: string): JsonObject[] {
      if (arg !== undefined && arg !== null) {
        if (arg.charAt(0) === '@') {
          const index = Number(arg.charAt(1)) - 1
          return sourceValues[index] as JsonObject[] || ['']
        }

        if (arg.charAt(0) === '$') {
          if (arg === '$hash') {
            return [hash]
          } else {
            const index = Number(arg.charAt(1))
            return variables[index] as JsonObject[] || ['']
          }
        }

        // 文字列の場合はカンマ区切りで切り出して配列にする
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

    // ソースを解析
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
            default:
              sourceValues.splice(sourceIndex, 1, parseJesgo(path))
          }
        }
        console.log(`Parse source[${sourceIndex}], assigned ${JSON.stringify(sourceValues[sourceIndex])}.`)
      }
    }

    // プロセス実体
    // ファンクション：比較
    function operators (op1: JsonObject[], op1type: string, op2: JsonObject[], oper: string): boolean {
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
    function vars (op1: JsonObject[], dst: string): boolean {
      verbose(`Function <assign variables>: ${op1.join(',')}, ${dst}`)

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
      verbose(`Assigning vars failed to ${dst}.`, true)
      return false
    }

    // ファンクション：抽出
    function query (arg: JsonObject[], path: string, dst: string): boolean {
      verbose(`Function <query>: ${arg.join(',')} by ${path} to ${dst}`)

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
        verbose(`Assigning vars failed to ${dst}.`, true)
      }
      return false
    }

    // ファンクション：置換
    function translator (arg: string, table: string[][]): boolean {
      verbose(`Function <translation>: ${arg}`)

      // 置換できない値が指定された場合はエラー
      if (['$hash', '$his_id', '$name'].includes(arg)) {
        verbose(`Translation: ${arg} is not translationTableObjects value.`, true)
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

    // ファンクション：出力
    function assignvars (op1: JsonObject[], dst: string): boolean {
      verbose(`Function <assign>: ${op1.join(',')} to ${dst}`)

      const xlcolToNum = (col: string): number => {
        let num = 0
        for (let pos = 0; pos < col.length; pos++) {
          num *= 26
          num += col.toUpperCase().charCodeAt(pos) - 64
        }
        return num - 1
      }

      // Arrayはflattenされ、オブジェクトは除外して文字列化
      const value = op1.flat(99).filter(item => item.toString() !== '[object Object]').toString()

      if (dst === '$error') {
        // エラーメッセージとして出力
        errorMessages.push(value)
      } else {
        if (/^[A-Z]+$/.test(dst)) {
          // Excel風の列番号で指定
          const colindex = xlcolToNum(dst)
          csvRow[colindex] = value
        } else {
          // 不正な指定
          verbose(`Assign: illegal column name "${dst}".`, true)
          return false
        }
      }
      return true
    }

    // マクロを逐次実行
    for (let step = 0; step < (rule.procedure || []).length;) {
      const procedure = (rule.procedure || [])[step]
      let result = true
      const args = procedure.arguments
      switch (procedure.type) {
        case 'Operators': // 条件分岐
          result = operators(parseArg(args[0]), args[1] || 'value', parseArg(args[2]), args[3])
          break
        case 'Variables':
          vars(parseArg(args[0]), args[1])
          break
        case 'Query':
          query(parseArg(args[0]), args[1], args[2])
          break
        case 'Translation':
          result = translator(args[0], procedure.lookup || [['', '']])
          break
        case 'Store':
          assignvars(parseArg(args[0]), args[1] || '$error')
      }

      // 結果からの分岐処理
      if (result) {
        // 正常終了
        if (procedure.trueBehavior === 'Abort') {
          step = (rule.procedure || []).length // 処理ループから抜ける
        } else {
          if (typeof procedure.trueBehavior === 'number') {
            console.log(`Proceed next ${procedure.trueBehavior} steps.`)
            // move steps forward
            step += procedure.trueBehavior
          } else {
            step++
          }
        }
      } else {
        // eslint-disable-next-line no-labels
        if (procedure.type === 'Operators' || procedure.type === 'Translation') {
          if (procedure.falseBehavior === 'Exit') {
            // 症例に対する処理の中止
            return undefined
          }
          if (procedure.falseBehavior === 'Abort') {
            step = (rule.procedure || []).length // 処理ループから抜ける
          }
          if (typeof procedure.falseBehavior === 'number') {
            // move steps forward
            step += procedure.falseBehavior
          }
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
