import { InjectionKey } from 'vue'
import { createStore, useStore as vuexUseStore, Store } from 'vuex'
import { ErrorObject, JsonObject, CsvObject, LogicRuleSet, configObject, LogicBlock, pulledDocument } from './types'
import { parseJesgo, dropNullValues, queryDocument } from './utilities'

export interface State {
  JsonDocument: JsonObject[],
  CsvDocument: CsvObject,
  CsvHeader: string[],
  ErrorDocument: ErrorObject[],
  RuleSetTitle: string,
  RuleSetConfig: configObject,
  RuleSet: LogicRuleSet[],
  // 表示の設定
  HighlightedPath: string,
  caseIndex: number,
  applyQuery: boolean,
  currentRulesetTitle: string
}

// eslint-disable-next-line symbol-description
export const key: InjectionKey<Store<State>> = Symbol()

export const store = createStore<State>({
  state: {
    JsonDocument: [],
    CsvDocument: [],
    CsvHeader: [],
    ErrorDocument: [],
    RuleSetTitle: '',
    RuleSetConfig: {},
    RuleSet: [],
    HighlightedPath: '',
    caseIndex: -1,
    applyQuery: false,
    currentRulesetTitle: ''
  },
  getters: {
    // 表示関連のステート
    // プレビューで表示しているカーソル
    caseIndex: (state):number => state.caseIndex,
    // ハイライト表示のパス
    highLightedPath: (state):string => state.HighlightedPath,
    // プレビューにクエリの適応をするか
    applyQuery: (state):boolean => state.applyQuery,
    // 編集中のルールセットタイトル
    currentRulesetTitle: (state):string => state.currentRulesetTitle,

    // 症例ドキュメント関連のgetters
    // マスタークエリをドキュメントに適用して取得・スキップはしない
    queriedDocument: (state) => {
      return queryDocument(state.JsonDocument as pulledDocument[], state.RuleSetConfig?.masterQuery, state.RuleSetConfig?.masterBasePointer)
    },
    documentLength: (state) => Array.isArray(state.JsonDocument) ? state.JsonDocument.length : 0,
    // indexを指定したドキュメント取得(表示用)
    document: (state, getters) => (index:number|undefined) => {
      const cursor = index === undefined ? state.caseIndex : index
      if (getters.documentLength > 0) {
        if (cursor >= 0 && cursor < getters.documentLength) {
          if (state.applyQuery) {
            return getters.queriedDocument[cursor]
          } else {
            return state.JsonDocument[cursor]
          }
        }
      }
      return {}
    },
    // ソースプレビュー用
    parseJesgoDocument: (_, getters) => (jsonpath:string|string[], index:number|undefined, resultType:'value'|'pointer' = 'value') => {
      const cursor:number = index === undefined ? getters.caseIndex : index
      return parseJesgo(
        getters.queriedDocument[cursor].documentList,
        jsonpath,
        resultType)
    },
    // ルールセット関係
    rules: (state):LogicRuleSet[] => state.RuleSet,
    ruleTitles: (state):string[] => state.RuleSet.map(rule => rule.title),
    rulesetConfig: (state):configObject => state.RuleSetConfig || {},
    rulesetTitle: (state):string => state.RuleSetTitle || '',
    documentVariables: (_, getters):string[] => (getters.rulesetConfig?.documentVariables || []),
    docuemntVariableCount: (_, getters) => (name:string) => {
      // 名前のチェック
      if (!name || name === '') {
        return -1
      }
      if (getters.documentVariables.indexOf(name) === -1) {
        return -1
      }
      // ルールセットから変数の利用をカウント
      let count = 0
      const rules:LogicRuleSet[] = getters.rules
      for (const rule of rules) {
        const logicblocks:LogicBlock[] = rule.procedure || []
        for (const block of logicblocks) {
          const args = block.arguments
          for (const arg of args) {
            if (arg === name) {
              count++
            }
          }
        }
      }
      return count
    },
    csvDocument: (state):CsvObject => state.CsvDocument,
    csvHeader: (state):string[] => state.CsvHeader,
    errorDocument: (state) => state.ErrorDocument
  },
  mutations: {
    setIndex (state, newValue) {
      if (newValue >= 0 && newValue < state.JsonDocument.length) {
        state.caseIndex = newValue
      }
    },
    setJsonDocument (state, jsonDocument) {
      // JESGOの初期Errataであるnullに対応：null要素を除去する
      state.JsonDocument = dropNullValues(jsonDocument) as JsonObject[]
    },
    setCsvDocument (state, newValue) {
      state.CsvDocument.splice(0)
      state.CsvDocument.splice(0, 0, ...newValue)
    },
    setCsvHeader (state, newValue) {
      state.CsvHeader.splice(0)
      state.CsvHeader.splice(0, 0, ...newValue)
    },
    clearCsvDocument (state) {
      state.CsvDocument.splice(0)
      state.CsvHeader.splice(0)
    },
    addCsvDocument (state, csvRow) {
      state.CsvDocument.push(csvRow)
    },
    clearErrorDocument (state) {
      state.ErrorDocument.splice(0, state.ErrorDocument.length)
    },
    addErrorDocument (state, errorObj:ErrorObject) {
      state.ErrorDocument.push(errorObj)
    },
    addRule (state, newValue) {
      state.RuleSet.push(newValue)
    },
    removeRule (state, setname) {
      const index = state.RuleSet.findIndex(element => element.title === setname)
      if (index !== -1) {
        state.RuleSet.splice(index, 1)
      }
    },
    reorderRuleSet (state, payload: { title:string, offset:number }) {
      const index = state.RuleSet.findIndex(element => element.title === payload.title)
      if (index >= 0) {
        const newIndex = index + payload.offset
        if (newIndex >= 0 || newIndex < state.RuleSet.length) {
          state.RuleSet.splice(newIndex, 0, ...state.RuleSet.splice(index, 1))
        }
      }
    },
    upsertRule (state, newValue: LogicRuleSet) {
      const index = state.RuleSet.findIndex(element => element.title === newValue.title)
      if (index >= 0) {
        state.RuleSet.splice(index, 1, newValue)
      } else {
        state.RuleSet.push(newValue)
      }
    },
    changeRuleTitle (state, title: {old: string, new: string}) {
      const index = state.RuleSet.findIndex(element => element.title === title.old)
      if (index >= 0) {
        const currentRuleSet = state.RuleSet[index]
        currentRuleSet.title = title.new
        state.RuleSet.splice(index, 1, currentRuleSet)
      }
    },
    setRuleSet (state, newRuleset: LogicRuleSet[]) {
      state.RuleSet.splice(0, state.RuleSet.length, ...newRuleset)
    },
    setRulesetTitle (state, newTitle: string) {
      state.RuleSetTitle = newTitle
    },
    setRulesetConfig (state, newConfig: configObject) {
      state.RuleSetConfig = newConfig
    },
    addDocumentVariable (state, name: string) {
      // 入力のチェック
      let newname:string
      if (name.charAt(0) === '$') {
        newname = name.slice(1).trim()
      } else {
        newname = name.trim()
      }
      if (newname === '') {
        return
      }
      newname = '$' + newname.replace(/[\s,.-@$;:\\'"]+/g, '_')
      if (newname in ['$hash', '$his_id', '$name', '$date_of_birth', '$now']) {
        throw new Error(`${newname}は予約語です.`)
      }
      // 変数の追加
      const config = state.RuleSetConfig
      const documentVariables = config?.documentVariables || []

      if (!(newname in documentVariables)) {
        documentVariables.push(newname)
        state.RuleSetConfig.documentVariables = documentVariables
      }
    },
    removeDocumentVariable (state, name: string) {
      if (name in ['$hash', '$his_id', '$name', '$date_of_birth', '$now']) {
        throw new Error(`${name}は予約語です.`)
      }

      const config = state.RuleSetConfig
      const documentVariables = config?.documentVariables || []

      const index = documentVariables.indexOf(name)
      if (index >= 0) {
        documentVariables.splice(index, 1)
        state.RuleSetConfig.documentVariables = documentVariables
      }
    },
    setHighlight (state, path = '') {
      state.HighlightedPath = path
    },
    setApplyQuery (state, newValue: boolean) {
      state.applyQuery = newValue
    },
    setCurrentRulesetTitle (state, newValue: string) {
      state.currentRulesetTitle = newValue
    }
  },
  actions: {
    clearRuleset ({ commit, getters }) {
      commit('setRulesetTitle', '')
      commit('setRulesetConfig', {
        masterQuery: ['$'],
        masterBasePointer: '/',
        skipUnmatchedRecord: false,
        csvOffset: 0,
        errorPointer: '/jesgo:error',
        errorTargetSchemaId: ''
      })
      getters.ruleTitles.forEach((ruleTitle:string) => {
        commit('removeRule', ruleTitle)
      })
    }
  }
})

export function useStore () {
  return vuexUseStore(key)
}
