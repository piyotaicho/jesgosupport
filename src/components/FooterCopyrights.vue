<template>
  <div class="footer">
    JESGOsupport version {{version}} / Copyright &copy; 2023 by P4mohnet
  </div>
</template>

<script setup lang="ts">
const version = process.env.VUE_APP_VERSION || 'NA'
</script>

<style>
div.footer {
  flex: initial;
  position: relative;
  width: 100%;
  font-size: 0.8rem;
  margin-left: calc(80vw - 15rem);
  padding-right: 2rem;
  padding-bottom: 0;
  padding-top: 0.2rem;
  white-space: nowrap;
}
</style>
