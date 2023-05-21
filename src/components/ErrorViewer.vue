<template>
  <div class="errorViewer">
    <dl>
      <template v-for="(errorReport, index) of errorDocuments" :key="index">
        <dt>hash: {{ errorReport.hash }} <span v-if="errorReport?.type">({{ errorReport.type }})</span></dt>
        <dd v-for="(errorLine, subindex) of errorReport.errors" :key="subindex">{{ errorLine }}</dd>
      </template>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { store } from './store'

const errorDocuments = computed(() => store.state.ErrorDocument)

</script>

<style>
div.errorViewer {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.errorViewer dt {
  padding-top: 0.5rem;
  font-weight: bold;
}
</style>
