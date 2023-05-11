<template>
  <div class="json-viewer">
    <ul>
      <JsonViewerLineVue v-for="(item, index) in jsonLines" :key="index"
        :lineNumber="index + 1"
        :line="item.text"
        :pointer="item.pointer"
        :highlights="jsonPointers"
        @click="setHighlight">
      </JsonViewerLineVue>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { JsonObject } from './types'
import { computed, ComputedRef } from 'vue'
import JsonViewerLineVue from './JsonViewerLine.vue'
import { JSONPath } from 'jsonpath-plus'
import { useStore } from './store'

const store = useStore()

interface jsonViewerProps {
  json?: JsonObject
}

const props = withDefaults(
  defineProps<jsonViewerProps>(),
  {
    json: () => { return [] }
  }
)

interface jsonComplex {
    text: string,
    pointer?: string
}

const jsonLines: ComputedRef<jsonComplex[]> = computed(() => {
  return toJsonComplex(props.json)
})

const jsonPointers: ComputedRef<string[]> = computed(() => {
  if (props.json && store.state.HighlightedPath !== '') {
    const pointers = JSONPath({ path: store.state.HighlightedPath, json: props.json, resultType: 'pointer' })
    return pointers
  } else {
    return []
  }
})

/**
 * toJsonComplex オブジェクトをjsonComplexアレイに変換する
 * @param {JsonObject} ソースオブジェクト
 * @param {string} JSON文字列のインデント
 * @param {string} JSONpointerの基底
 * @param {boolean} ソースオブジェクトの親が配列(keyのJSON文字列への反映を抑制)
 */
function toJsonComplex (obj: JsonObject, indent = '', basePath = '', arrayItem = false): jsonComplex[] {
  const jsonArray:jsonComplex[] = []

  if (basePath === '') {
    // トップレベルの処理
    switch (Object.prototype.toString.call(obj)) {
      case '[object Object]':
        jsonArray.push({
          text: '{', pointer: '/'
        })
        jsonArray.push(...toJsonComplex(obj, indent + '  ', '/'))
        jsonArray.push({
          text: '}'
        })
        break
      case '[object Array]':
        jsonArray.push({
          text: '[', pointer: '/'
        })
        jsonArray.push(...toJsonComplex(obj, indent + '  ', '/', true))
        jsonArray.push({
          text: ']'
        })
        break
      case '[object String]':
        jsonArray.push({
          text: `"${obj}"`,
          pointer: '/'
        })
        break
      case '[object Number]':
        jsonArray.push({
          text: `${obj}`,
          pointer: '/'
        })
    }
  } else {
    interface givenObj {
      [key: string]: unknown
    }
    const keys: string[] = Object.keys(obj as givenObj)
    for (const key of keys) {
      const currentBase = basePath + key.replaceAll('~', '~0').replaceAll('/', '~1')
      const separator = (key !== keys.slice(-1)[0]) ? ',' : ''
      const value = (obj as givenObj)[key] as JsonObject
      switch (Object.prototype.toString.call(value)) {
        case '[object Object]':
          jsonArray.push({
            text: (!arrayItem ? `${indent}"${key}": {` : `${indent}{`),
            pointer: currentBase
          })
          jsonArray.push(...toJsonComplex(value, indent + '  ', currentBase + '/'))
          jsonArray.push({
            text: `${indent}}${separator}`
          })
          continue
        case '[object Array]':
          jsonArray.push({
            text: (!arrayItem ? `${indent}"${key}": [` : `${indent}[`),
            pointer: currentBase
          })
          jsonArray.push(...toJsonComplex(value, indent + '  ', currentBase + '/', true))
          jsonArray.push({
            text: `${indent}]${separator}`
          })
          continue
        case '[object String]':
          jsonArray.push({
            text: (!arrayItem ? `${indent}"${key}": "${value}"${separator}` : `${indent}"${value}"${separator}`),
            pointer: currentBase
          })
          continue
        case '[object Number]':
          jsonArray.push({
            text: (!arrayItem ? `${indent}"${key}": ${value}${separator}` : `${indent}${value}${separator}`),
            pointer: currentBase
          })
      }
    }
  }
  return jsonArray
}

/**
 * setHighlight イベントハンドラ クリックされた行のポインタに基づきハイライトを設定する
 * @param {string} jsonpointer文字列
 */
function setHighlight (jsonpointer = ''):void {
  if (jsonpointer !== '') {
    const jsonPath = pointerToPath(jsonpointer)
    store.commit('setHighlight', jsonPath)
  }
}

/**
 * pointerToPath jsonポインタを簡易的にjsonPathに変換する
 * @param {string} jsonPointer文字列
 * @returns {string} jsonPath文字列
 */
function pointerToPath (jsonPointer: string): string {
  // 先頭のスラッシュを削除する
  jsonPointer = jsonPointer.replace(/^\//, '')

  // JSON PointerをJSONPathに変換する
  const jsonPath = jsonPointer
    .replace(/\//g, '.') // スラッシュをドットに置換
    .split('.')
    .map(segment => segment
      .replace(/~/g, '~0')
      .replace(/!/g, '~1'))
    .map(segment => /^\d+$/.test(segment) ? `[${segment}]` : segment)
    .join('.')

  return '$.' + jsonPath
}
</script>

<style>
div .json-viewer {
  position: relative;
  overflow: auto;
  height: 100%;
}

.json-viewer ul {
  list-style: none;
}

.json-viewer li {
  height: 1.3rem;
  box-sizing: content-box;
  width: 100%;
  margin: 0;
  padding: 0.16rem 0;
  display: flexbox;
  flex-direction: row;
  justify-content: flex-start;
  white-space: nowrap;
}

.json-viewer li span {
  display: inline-flex;
  margin: 0;
  margin-top: auto;
  margin-bottom: auto;
  padding: 0;
}

.json-viewer li pre {
  display: inline-flex;
  margin: 0;
  margin-top: auto;
  margin-bottom: auto;
  padding: 0;
}

.json-viewer li:nth-child(even) {
  background-color: #e2e2e2;
}

.json-viewer li .haspoint {
  cursor: pointer;
}

.json-viewer li.highlight {
  background-color: #b89bf3;
}

.json-viewer li:nth-child(even).highlight {
  background-color: #a588da;
}

.json-viewer li .haspoint:hover {
  text-decoration: underline;
}

span.json-viewer-index {
  display: inline-flex;
  padding: 0.1rem 0.3rem;
  width: 2rem;
}
</style>
