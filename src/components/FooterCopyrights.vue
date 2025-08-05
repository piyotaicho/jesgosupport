<template>
  <div class="footer">
    <div>
      JESGOsupport version {{version}} / Copyright &copy; 2023-2025 by P4mohnet, releaed under the MIT license
    </div>
  </div>
</template>

<script setup lang="ts">
const version = import.meta.env.VITE_APP_VERSION || 'NA'
const licensefield = import.meta.env.LICENSE || 'MIT'


</script>

<style>
div.footer {
  flex: initial;
  box-sizing: border-box;
  position: relative;
  width: 100%;
  height: 1rem;
  font-size: 0.7rem;
  overflow: hidden;
}

div.footer > div {
  position: absolute;
  right: 2rem;
}
</style>
