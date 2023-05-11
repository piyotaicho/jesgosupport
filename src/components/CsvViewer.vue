<template>
  <div>
    <table class="csvViewer">
      <tr v-for="(line, lineIndex) in csvData" :key="lineIndex">
        <template v-if="lineIndex === 0">
          <th><el-icon><Delete/></el-icon></th>
          <th v-for="(cell, columnIndex) in line" :key="columnIndex" @click="columnClick(columnIndex)">
            {{ cell }}
          </th>
        </template>
        <template v-else>
          <th>{{ lineIndex }}</th>
          <td v-for="(cell, columnIndex) in line" :key="columnIndex" @click="columnClick(columnIndex)">
            {{ cell }}
          </td>
        </template>
      </tr>
    </table>
  </div>
</template>

<script setup lang="ts">
import { CsvObject } from './types'
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'

const props = defineProps<{
  csv: CsvObject
}>()

const emits = defineEmits<{
  (e: 'click', value: number): void
}>()

const csvData = computed(() => {
  if (props.csv && props.csv.length > 0 && props.csv[0].length > 0) {
    const header: string[] = props.csv[0].map((_, index) => base26(index + 1))
    return [header, ...props.csv]
  } else {
    return [[]]
  }
})
/**
 * columnClick カラム値のクリックを親に発火する
 * @param {number} カラムのインデックス値
 */
function columnClick (columnIndex: number) {
  emits('click', columnIndex)
}

function base26 (value: number): string {
  let carry = value / 26 | 0
  let remain = value % 26
  if (remain === 0 && carry !== 0) {
    remain = 26
    carry--
  }
  return (remain === 0 && carry === 0) ? '' : base26(carry) + String.fromCharCode(64 + remain)
}
</script>

<style>
table.csvViewer {
  font-size: 0.9rem;
  border-collapse: collapse;
  overflow: auto;
}

.csvViewer th {
  background-color: #e2e2e2;
  font-weight: bold;
  border: 1px solid #ccc;
  padding: 8px;
}

.csvViewer td {
  border: 1px solid #ccc;
  padding: 8px 1.5rem;
}

.csvViewer tr:nth-child(even) {
  background-color: #f2f2f2;
}
</style>
