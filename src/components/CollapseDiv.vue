<script lang="ts" setup>
import { ref, Ref, defineProps, onMounted } from 'vue'

const props = defineProps<{
    state?: boolean
  }>()

const isOpenElement:Ref<boolean> = ref(props.state || false)
const titleSlot = ref()
const collapseDiv = ref()

onMounted(() => {
  const titleElement = titleSlot.value as HTMLDivElement
  if (titleElement.innerText.trim() === '') {
    // titleスロットに内容の指定が無い

  }
})

const switchState = () => {
  if (isOpenElement.value === true) {
    isOpenElement.value = false
  } else {
    isOpenElement.value = true
  }
}
</script>

<template>
  <div>
    <div ref="titleSlot">
      <slot name="title"></slot>
    </div>
    <slot></slot>
  </div>
</template>
