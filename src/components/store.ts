import { InjectionKey } from 'vue'
import { createStore, useStore as vuexUseStore, Store } from 'vuex'
import { ErrorObject, JsonObject, CsvObject, LogicRule } from './types'
import { JSONPath } from 'jsonpath-plus'

export interface State {
  JsonDocument: JsonObject,
  CsvDocument: CsvObject,
  ErrorDocument: ErrorObject[],
  RuleSet: LogicRule[],
  HighlightedPath: string,
  currentIndex: number
}

// eslint-disable-next-line symbol-description
export const key: InjectionKey<Store<State>> = Symbol()

export const store = createStore<State>({
  state: {
    JsonDocument: [],
    CsvDocument: [],
    ErrorDocument: [],
    RuleSet: [],
    HighlightedPath: '',
    currentIndex: -1
  },
  getters: {
    documentLength: (state) => Array.isArray(state.JsonDocument) ? state.JsonDocument.length : 0,
    documentRef: (state, getters) => (index:number|undefined) => {
      const cursor = index === undefined ? state.currentIndex : index
      if (getters.documentLength > 0) {
        if (cursor >= 0 && cursor < getters.documentLength) {
          return (state.JsonDocument as JsonObject[])[cursor]
        }
      }
      return {}
    },
    jesgoDocumentRef: (_, getters) => (index:number|undefined) => {
      if (getters.documentRef(index)?.documentList) {
        const documentLists = getters.documentRef(index)?.documentList as JsonObject[]
        return documentLists
      } else {
        return []
      }
    },
    parseJesgoDocument: (_, getters) => (jsonpath:string|string[], index:number|undefined, resultType:'value'|'pointer' = 'value') => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result:any
      try {
        // jsonpathが配列の場合は[0]がメイン
        const primarypath:string = Array.isArray(jsonpath) ? jsonpath[0] : jsonpath
        result = JSONPath({
          path: primarypath,
          json: getters.jesgoDocumentRef(index),
          resultType: resultType
        })

        // サブパスはvalueの時だけ有効
        if (resultType === 'value' && Array.isArray(jsonpath) && (jsonpath[1] || '') !== '') {
          result = JSONPath({
            path: jsonpath[1],
            json: result
          })
        }
      } catch (e) {
        console.error(e)
      }
      return result
    },
    getRuleSetJson: (state) => JSON.stringify(state.RuleSet, null, 2)
  },
  mutations: {
    setIndex (state, newValue) {
      state.currentIndex = newValue
    },
    setJsonDocument (state, newValue) {
      state.JsonDocument = newValue
    },
    setCsvDocument (state, newValue) {
      state.CsvDocument = newValue
    },
    clearCsvDocument (state) {
      state.CsvDocument.splice(0, state.CsvDocument.length)
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
    addNewRuleSet (state, newValue) {
      state.RuleSet.push(newValue)
    },
    removeFromRuleSet (state, setname) {
      const index = state.RuleSet.findIndex(element => element.title === setname)
      if (index !== -1) {
        state.RuleSet.splice(index, 1)
      }
    },
    upsertRuleSet (state, newValue: LogicRule) {
      const index = state.RuleSet.findIndex(element => element.title === newValue.title)
      if (index >= 0) {
        state.RuleSet.splice(index, 1, newValue)
      } else {
        state.RuleSet.push(newValue)
      }
    },
    changeRuleSetTitle (state, title: {old: string, new: string}) {
      const index = state.RuleSet.findIndex(element => element.title === title.old)
      if (index >= 0) {
        const currentRuleSet = state.RuleSet[index]
        currentRuleSet.title = title.new
        state.RuleSet.splice(index, 1, currentRuleSet)
      }
    },
    setRuleSet (state, newRuleset: LogicRule[]) {
      state.RuleSet.splice(0, state.RuleSet.length, ...newRuleset)
    },
    setHighlight (state, path = '') {
      state.HighlightedPath = path
    }
  }
})

export function useStore () {
  return vuexUseStore(key)
}
