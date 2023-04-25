<template>
  <li>
    <span class="json-viewer-index" v-if="props.lineNumber !== undefined">{{ props.lineNumber }}</span>
    <pre><span
      :style="paddingLeft"
      :class="[
        props?.pointer ? 'haspoint' : '',
        props?.highlight ? 'highlighted' : ''
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
  highlight?:boolean
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
  return `padding-left: ${i}rem;`
})

/**
 * onclick クリックイベントを親に発行する
 */
function onclick () {
  emits('click', props.pointer ? props.pointer : '')
}
</script>
