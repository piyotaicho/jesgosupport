<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from './store'
import { ElMessageBox } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'

const store = useStore()

const props = defineProps<{
  name: string
}>()

const emits = defineEmits<{
  (e: 'delete'): void,
}>()

const counts = computed(() => store.getters.docuemntVariableCount(props.name) as number)

function deleteItem () {
  if (counts.value > 0) {
    ElMessageBox.alert('変数がルールで使用されているため削除出来ません.', 'ユーザ定義変数')
  } else {
    emits('delete')
  }
}

async function copyVariableName (): Promise<void> {
  await navigator.clipboard.writeText(props.name)
}

</script>

<template>
  <div style="width: 520px; padding: 0.15rem 0; ">
    <el-row style="margin: 0 1rem; padding: 0.7rem 0; border: 1px solid black; border-radius: 0.2rem;">
      <el-col :span="19" :offset="1" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;" @click="copyVariableName">
        <span style="font-weight: bold;">変数<el-icon><CopyDocument /></el-icon>
          : </span>
        <span>{{ props.name }}</span>
      </el-col>
      <el-col :span="4">
        <el-badge class="item" :hidden="false" :value="counts">
          <el-button @click="deleteItem()">削除</el-button>
        </el-badge>
      </el-col>
    </el-row>
  </div>
</template>
