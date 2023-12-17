<template>
  <div>変数に値を割り当てます</div>
  <div style="display: flex; flex-direction: row">
    <div style="flex: 1">
      <DropdownCombo
        placeholder="値を入力もしくは選択"
        v-model="argument1stTranslated"
        largetext
      >
        <el-option
          v-for="(element, index) in optionsLabelValue"
          :key="index"
          :label="element.label"
          :value="element.value"
        />
      </DropdownCombo>
    </div>
    <div style="flex: initial">を</div>
  </div>
  <div>
    <el-select v-model="argument2nd" placeholder="変数を選択">
      <template v-for="(element, index) in optionsLabelValue" :key="index">
        <el-option
          v-if="element.label.slice(0, 2) === '変数'"
          :label="element.label"
          :value="element.value"
        />
      </template>
    </el-select>
    に代入する
  </div>
</template>

<script setup lang="ts">

</script>
