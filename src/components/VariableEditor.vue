<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { useStore } from './store'
import VariableItems from './VariableItems.vue'
import { ElMessageBox } from 'element-plus'

const store = useStore()

async function addDocumentVariable () {
  try {
    const { value: name } = await ElMessageBox.prompt('新しいドキュメント変数名', 'ドキュメント変数')
    console.log(`COMP: Add document variable ${name}`)

    if ((name as string).trim() !== '') {
      store.commit('addDocumentVariable', name)
    }
  } catch {}
}

function deleteDocumentVariable (name: string) {
  store.commit('removeDocumentVariable', name)
}
</script>

<template>
  <div class="logic-controler">
    <div style="margin: 0.3rem 8rem;">
      <ElButton type="primary" :icon="Plus" @click="addDocumentVariable">ドキュメント変数を追加</ElButton>
    </div>
  </div>

  <div>
    <template v-for="name in store.getters.documentVariables" :key="name">
      <VariableItems :name="name" @delete="deleteDocumentVariable(name)"/>
    </template>
  </div>
</template>
