<template>
  <li :class="[highlight ? 'highlight' : '']">
    <span class="json-viewer-index" v-if="props.lineNumber !== undefined">{{ props.lineNumber }}</span>
    <pre><span
      :style="paddingLeft"
      :class="[
        props?.pointer ? 'haspoint' : ''
      ]"
      @click="onclick()"
      >{{props.line.trimStart()}}</span></pre>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  line: string,
  lineNumber?: number,
  pointer?:string,
  highlights?:string[]
}>()

const emits = defineEmits<{
  (e: 'click', value: string): void
}>()

/**
 * paddingLeft prop.lineのインデントのみを抽出
 * @returns {string}
 */
const paddingLeft = computed((): string => {
  let i = 0
  for (; props.line.charAt(i) === ' '; i++) {
    // NOP
  }
  return `padding-left: ${i * 0.7}rem;`
})

/**
 * highlight prop.highlightsにポインタが含まれる
 * @returns {boolean}
 */
const highlight = computed((): boolean => {
  if (props.highlights && props.pointer) {
    return props.highlights.find(element => props.pointer?.indexOf(element) === 0) !== undefined
  } else {
    return false
  }
})

/**
 * onclick クリックイベントを親に発行する
 */
function onclick () {
  emits('click', props.pointer ? props.pointer : '')
}
</script>
