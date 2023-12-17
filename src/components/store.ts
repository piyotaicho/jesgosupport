import { InjectionKey } from 'vue'
import { createStore, useStore as vuexUseStore, Store } from 'vuex'
import { ErrorObject, JsonObject, CsvObject, LogicRuleSet, configObject } from './types'
import { parseJesgo } from './utilities'

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
  caseIndex: number
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
    caseIndex: -1
  },
  getters: {
    // 表示関連のステート
    caseIndex: (state):number => state.caseIndex,
    highLightedPath: (state):string => state.HighlightedPath,
    // 症例ドキュメント関連のgetters
    filteredDocument: (state) => {
      /**
       * オブジェクトを生成する
       * @param path パス配列
       * @param value 最終的な値オブジェクト(JSONpathの出力なのでarray)
       * @returns 生成されたオブジェクト
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mountValue = (path:string[], value:any):any => {
        if (path.length === 0) {
          return value
        } else {
          return {
            [path[0]]: mountValue(path.slice(1), value)
          }
        }
      }
      const queries = state.RuleSetConfig?.masterQuery || []
      const mountPoint = state.RuleSetConfig?.masterBasePointer || '/'
      // 処理を必要としない場合はドキュメントをそのまま出力
      if (queries.length > 0 && !(queries.length === 1 && queries[0] === '$' && mountPoint === '/')) {
        const mountPath = mountPoint.split('/').filter(segment => segment !== '')
        const skipUnmatched = state.RuleSetConfig?.skipUnmatchedRecord || false

        const filteredDocuments:JsonObject[] = []

        for (const caseDocument of state.JsonDocument) {
          let documentList = (caseDocument as {documentList?: JsonObject[]})?.documentList
          if (documentList && documentList.length > 0) {
            documentList = parseJesgo(documentList, queries)
            if (!documentList || documentList.length === 0) {
              // クエリにマッチしない
              if (!skipUnmatched) {
                filteredDocuments.push(Object.assign(caseDocument, { documentList: [mountValue(mountPath, [])].flat() }))
              }
            } else {
              // マッチ
              filteredDocuments.push(Object.assign(caseDocument, { documentList: [mountValue(mountPath, documentList)].flat() }))
            }
          } else {
            if (!skipUnmatched) {
              filteredDocuments.push(Object.assign(caseDocument, { documentList: [mountValue(mountPath, [])].flat() }))
            }
          }
        }

        return filteredDocuments
      } else {
        return state.JsonDocument
      }
    },
    documentLength: (state, getters) => getters.filteredDocument.length, // Array.isArray(state.JsonDocument) ? state.JsonDocument.length : 0,
    document: (state, getters) => (index:number|undefined) => {
      const cursor = index === undefined ? state.caseIndex : index
      if (getters.documentLength > 0) {
        if (cursor >= 0 && cursor < getters.documentLength) {
          return getters.filteredDocument[cursor]
        }
      }
      return {}
    },
    jesgodocument: (_, getters) => (index:number|undefined) => {
      if (getters.document(index)?.documentList) {
        const documentLists = getters.document(index)?.documentList as JsonObject[]
        return documentLists
      } else {
        return []
      }
    },
    parseJesgoDocument: (_, getters) => (jsonpath:string|string[], index:number|undefined, resultType:'value'|'pointer' = 'value') => {
      const targetDocument = getters.jesgodocument(index)
      return parseJesgo(targetDocument, jsonpath, resultType)
    },
    rules: (state):LogicRuleSet[] => state.RuleSet,
    ruleTitles: (state):string[] => state.RuleSet.map(rule => rule.title),
    rulesetConfig: (state):configObject => state.RuleSetConfig || {},
    rulesetTitle: (state):string => state.RuleSetTitle || '',
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
    setHighlight (state, path = '') {
      state.HighlightedPath = path
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
