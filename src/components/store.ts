import { InjectionKey } from 'vue'
import { createStore, useStore as vuexUseStore, Store } from 'vuex'

import { JsonObject, CsvObject } from './types'

export interface State {
  JsonDocument: JsonObject,
  CsvDocument: CsvObject,
  RuleSet: object[]
}

// eslint-disable-next-line symbol-description
export const key: InjectionKey<Store<State>> = Symbol()

export const store = createStore<State>({
  state: {
    JsonDocument: [],
    CsvDocument: [],
    RuleSet: [{}]
  }
})

export function useStore () {
  return vuexUseStore(key)
}
