import { InjectionKey } from 'vue'
import { createStore, useStore as vuexUseStore, Store } from 'vuex'
import { ErrorObject, JsonObject, CsvObject, LogicRuleSet } from './types'
import { parseJesgo } from './utilities'

export interface State {
  JsonDocument: JsonObject,
  CsvDocument: CsvObject,
  ErrorDocument: ErrorObject[],
  RuleSet: LogicRuleSet[],
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
      const targetDocument = getters.jesgoDocumentRef(index)
      return parseJesgo(targetDocument, jsonpath, resultType)
    },
    rules: (state):LogicRuleSet[] => state.RuleSet,
    ruleTitles: (state):string[] => state.RuleSet.map(rule => rule.title),
    getRuleSetJson: (state) => JSON.stringify(state.RuleSet, null, 2)
  },
  mutations: {
    setIndex (state, newValue) {
      state.currentIndex = newValue
    },
    setJsonDocument (state, jsonDocument) {
      // 単独要素として null が存在するとき、状況に応じて情報を削除する: JESGO errata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function dropNullValues (sourceObject: any): any {
        const sourceType = Object.prototype.toString.call(sourceObject)
        if (sourceType === '[object Number]' || sourceType === '[object String]') {
          return sourceObject
        }
        if (sourceType === '[object Array]') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (sourceObject as any[])
            .filter(item => Object.prototype.toString.call(item) !== '[object Null]')
            .map(item => dropNullValues(item))
        }
        if (sourceType === '[object Object]') {
          const properties = Object.keys(sourceObject as object)
          const newObject: Record<string, string> = {}
          for (const property of properties) {
            if (Object.prototype.toString.call(sourceObject[property]) !== '[object Null]') {
              newObject[property] = dropNullValues(sourceObject[property])
            }
          }
          return newObject as object
        }
      }
      state.JsonDocument = dropNullValues(jsonDocument)
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
    reorderRuleSet (state, payload: { title:string, offset:number }) {
      const index = state.RuleSet.findIndex(element => element.title === payload.title)
      if (index >= 0) {
        const newIndex = index + payload.offset
        if (newIndex >= 0 || newIndex < state.RuleSet.length) {
          state.RuleSet.splice(newIndex, 0, ...state.RuleSet.splice(index, 1))
        }
      }
    },
    upsertRuleSet (state, newValue: LogicRuleSet) {
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
    setRuleSet (state, newRuleset: LogicRuleSet[]) {
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
