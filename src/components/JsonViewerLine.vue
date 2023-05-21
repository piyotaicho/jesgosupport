<template>
  <div class="json-viewer-line" :class="[highlight ? 'highlight' : '']">
    <div class="json-viewer-index"><span v-if="props.lineNumber !== undefined">{{ props.lineNumber }}</span></div>
    <div class="json-viewer-content">
      <pre><span
      :style="paddingLeft"
      :class="[
        props?.pointer ? 'haspoint' : ''
      ]"
      @click="onclick()"
      >{{props.line.trimStart()}}</span></pre>
    </div>
  </div>
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
    const pointerElements = props.pointer.split('/')
    return props.highlights.find(item => {
      const itemElements = item.split('/')
      for (let index = 0; index < itemElements.length; index++) {
        if (pointerElements[index] !== itemElements[index]) {
          return false
        }
      }
      return true
    }) !== undefined
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
