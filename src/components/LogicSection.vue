<template>
  <div class="logic-section">
    <div class="logic-section-ruleset">
      <div class="logic-section-ruleset-selector">
        ルールの名称 :
        <el-select v-model="currentRulesetTitle"
          placeholder="ルールを選択"
          no-data-text="選択可能なルールがありません"
          >
          <el-option v-for="(title, index) in ruleTitles" :key="index"
            :value="title"
            :label="title" />
        </el-select>
      </div>
      <div class="logic-section-ruleset-controller">
        <el-button-group>
          <el-button type="primary" :icon="Plus" circle @click="createNewRule()"/>
          <el-button type="primary" :icon="EditPen" circle @click="renameRule()"/>
          <el-button type="primary" :icon="Delete" circle @click="deleteRule()"/>
        </el-button-group>
      </div>
    </div>
    <div class="logic-section-ruleset" v-show="currentRulesetTitle !== ''">
      <el-input v-model="description" placeholder="ルールの説明" type="textarea" />
    </div>

    <div class="logic-section-ruleset" v-show="currentRulesetTitle !== ''">
      <div style="width: 100%;">
        <LogicSource v-for="(block, index) in sources" :key="index" :index="index" :block="block" @updateblock="updateSource"/>
      </div>
    </div>
    <div class="logic-section-ruleset" v-show="currentRulesetTitle !== ''">
      <!-- ロジックエディタ -->
      <LogicEditor v-model:blocks="procedures"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, Ref, computed, ComputedRef, WritableComputedRef } from 'vue'
import { Plus, EditPen, Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { useStore } from './store'
import { LogicBlock, SourceBlock, LogicRule } from './types'
import LogicSource from './LogicSource.vue'
import LogicEditor from './LogicEditor.vue'

const store = useStore()

/**
 * rules ルールセットすべて
 */
const rules = computed(() => store.state.RuleSet)

/**
 * ruleTitles ルールセットのタイトル一覧
 */
const ruleTitles: ComputedRef<string[]> = computed(
  () => Array.isArray(rules.value)
    ? rules.value.map(element => element.title)
    : []
)

/**
 * currentRulesetTitle 現在編集中のルールセットのタイトル
 * currentRulesetTitleComputed ルールセットの追加に対応
 */
const currentRulesetTitle:Ref<string> = ref('')
const currentRulesetTitleComputed: WritableComputedRef<string> = computed({
  get: () => currentRulesetTitle.value,
  set: (value: string) => {
    if (value !== '') {
      if (rules.value.findIndex(element => element.title === value) === -1) {
        store.commit('addNewRuleSet', { title: value })
      }
    }
    currentRulesetTitle.value = value
  }
})

/**
 * currentRuleset 現在編集中のルールセット
 */
const currentRuleset:Ref<LogicRule> = computed(() => {
  if (rules?.value) {
    const currentRule = rules.value.find(element => element.title === currentRulesetTitle.value)
    if (currentRule) {
      return currentRule
    }
  }
  return {
    title: ''
  }
})

/**
 * description ルールセットの説明 変更は適宜アップデートされる
 */
const description: WritableComputedRef<string> = computed({
  get: () => {
    if (currentRuleset?.value !== undefined) {
      return currentRuleset.value?.description || ''
    } else {
      return ''
    }
  },
  set: (text) => {
    if (currentRuleset.value !== undefined && text.trim() !== '') {
      const newRule = Object.assign(
        currentRuleset.value,
        { description: text.trim() }
      )
      store.commit('upsertRuleSet', newRule)
    }
  }
})

/**
 * sources ルールセットのソース配列
 */
const sources: WritableComputedRef<SourceBlock[]> = computed({
  get: () => {
    const sourcelist = [...(currentRuleset.value?.source || [])]
    for (let index = sourcelist.length; index > 0;) {
      --index
      if (sourcelist[index].path === '' && !sourcelist[index]?.subpath) {
        sourcelist.splice(index, 1)
      } else {
        break
      }
    }
    return [...sourcelist, { path: '' }].slice(0, 8) // 便宜上ソースは8個までとする
  },
  set: (newSources: SourceBlock[]) => {
    const newRule = Object.assign(
      currentRuleset?.value || {},
      { source: newSources }
    )
    store.commit('upsertRuleSet', newRule)
  }
})

function updateSource (index: number, value:SourceBlock) {
  const newBlock = [...sources.value]
  newBlock.splice(index, 1, value)
  sources.value = newBlock
}

/**
 * procedures ルールセットのコード配列
 */
const procedures: WritableComputedRef<LogicBlock[]> = computed({
  get: () => currentRuleset.value?.procedure || [],
  set: (newSets: LogicBlock[]) => {
    const newRule = Object.assign(
      currentRuleset?.value || {},
      { procedure: newSets }
    )
    store.commit('upsertRuleSet', newRule)
  }
})

/**
 * createNew() イベントハンドラ 新しいルールセットエントリを作成する
 */
async function createNewRule (): Promise<void> {
  try {
    do {
      // キャンセルは例外でループを抜ける.
      const newSetName = (await ElMessageBox.prompt('新しいルールセットの名称を入力してください.', '', {
        confirmButtonText: '作成',
        cancelButtonText: 'キャンセル',
        inputPattern: /\S/,
        inputErrorMessage: '正しく名称を入力してください'
      })).value.trim()
      if (newSetName !== undefined) {
        if (rules.value.find(element => element.title === newSetName)) {
          await ElMessageBox.alert(`${newSetName}は既に存在しています.別の名称を入力してください.`)
        } else {
          currentRulesetTitleComputed.value = newSetName
          break
        }
      }
    }
    while (true)
  } catch {
    // do nothing :)
  }
}

/**
 * renameRule 現在選択されているルールセットの名称を変更する
 */
async function renameRule (): Promise<void> {
  try {
    if (currentRulesetTitleComputed.value) {
      const newSetName = (await ElMessageBox.prompt('ルールセットの新しい名称を入力してください.', '', {
        confirmButtonText: '変更',
        cancelButtonText: 'キャンセル',
        inputPattern: /\S/,
        inputErrorMessage: '正しく名称を入力してください',
        inputValue: currentRulesetTitleComputed.value
      })).value.trim()
      if (newSetName !== undefined) {
        if (newSetName !== currentRulesetTitleComputed.value) {
          if (rules.value.find(element => element.title === newSetName)) {
            await ElMessageBox.alert(`${newSetName}は既に存在しています.別の名称を入力してください.`)
          } else {
            currentRuleset.value.title = newSetName
            store.commit('changeRuleSetTitle', { old: currentRulesetTitleComputed.value, new: newSetName })
            currentRulesetTitleComputed.value = newSetName
          }
        }
      }
    }
  } catch {
    // do notning :)
  }
}

/**
 * deleteRule 現在選択されているルールセットを削除する
 */
async function deleteRule (): Promise<void> {
  try {
    if (
      currentRulesetTitleComputed.value &&
      await ElMessageBox.confirm('現在編集中のルールセットを削除してよろしいですか', { confirmButtonText: '削除する', cancelButtonText: 'キャンセル' })
    ) {
      store.commit('removeFromRuleSet', currentRulesetTitleComputed.value)
    }
    currentRulesetTitleComputed.value = rules.value[0]?.title || ''
  } catch {
    // do notning :)
  }
}
</script>

<style>
div.logic-section {
  min-width: 40rem;
  max-width: 40rem;
  /* border: 1px solid cyan; */
  /* display: flex;
  flex-direction: column; */
  height: 100%;
  overflow-y: auto;
}

div.logic-section-ruleset {
  display: flex;
  flex-direction: row;
  padding: 0.8rem 0.5rem;
}

div.logic-section-ruleset-controller {
  padding-left: 1rem;
}

.logic-section-ruleset-selector .el-select {
  width: 25rem;
}
</style>
