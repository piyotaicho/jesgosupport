import { InjectionKey } from 'vue'
import { createStore, useStore as vuexUseStore, Store } from 'vuex'

import { JsonObject, CsvObject, LogicRule } from './types'

export interface State {
  JsonDocument: JsonObject,
  CsvDocument: CsvObject,
  RuleSet: LogicRule[],
  SelectedPointer: string,
  HighlightedPath: string
}

// eslint-disable-next-line symbol-description
export const key: InjectionKey<Store<State>> = Symbol()

export const store = createStore<State>({
  state: {
    JsonDocument: [],
    CsvDocument: [],
    RuleSet: [],
    SelectedPointer: '',
    HighlightedPath: ''
  },
  mutations: {
    setJsonDocument (state, newValue) {
      state.JsonDocument = newValue
    },
    setCsvDocument (state, newValue) {
      state.CsvDocument = newValue
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
    updateRuleSet (state, newValue: LogicRule) {
      const index = state.RuleSet.findIndex(element => element.title === newValue.title)
      if (index >= 0) {
        state.RuleSet.splice(index, 1, newValue)
      }
    },
    setPointer (state, pointer = '') {
      state.SelectedPointer = pointer
    },
    setHighlight (state, path = '') {
      state.HighlightedPath = path
    }
  }
})

export function useStore () {
  return vuexUseStore(key)
}
