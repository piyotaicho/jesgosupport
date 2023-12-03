<template>
  <div style="display: flex; flex-direction: row;">
    <div class="ruleset-selector">
      <span>ルール名称 : </span>
        <el-select v-model="currentRulesetTitleComputed"
          placeholder="ルールを選択"
          no-data-text="選択可能なルールがありません"
          >
          <el-option v-for="(title, index) in ruleTitles" :key="index"
            :value="title" :label="title" />
        </el-select>
    </div>
    <div class="ruleset-controller">
      <el-button-group>
        <el-button type="primary" :icon="Plus" circle @click="createNewRule()"/>
        <el-button type="primary" :icon="CaretTop" circle @click="reorderRule(-1)"/>
        <el-button type="primary" :icon="CaretBottom" circle @click="reorderRule(+1)"/>
        <el-button type="primary" :icon="EditPen" circle @click="renameRule()"/>
        <el-button type="primary" :icon="Delete" circle @click="deleteRule()"/>
      </el-button-group>
    </div>
  </div>
  <div class="ruleset-section" style="padding-top: 0.3rem;" v-show="currentRulesetTitleComputed !== ''">
    <el-input v-model="description" placeholder="ルールの説明" type="textarea" />
  </div>
</template>

<script setup lang="ts">
import { Ref, computed, ComputedRef, WritableComputedRef, defineProps, defineEmits } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Plus, CaretTop, CaretBottom, EditPen, Delete } from '@element-plus/icons-vue'
import { LogicRuleSet } from './types'
import { useStore } from './store'

const store = useStore()
const props = defineProps<{ ruleTitle: string }>()
const emit = defineEmits(['update:ruleTitle'])

/**
 * rules ルールすべて
 */
const rules:ComputedRef<LogicRuleSet[]> = computed(() => store.getters.rules)

/**
 * ruleTitles ルールのタイトル一覧
 */
const ruleTitles: ComputedRef<string[]> = computed(() => store.getters.ruleTitles)

/**
 * currentRulesetTitleComputed ルールの追加に対応
 */
const currentRulesetTitleComputed: WritableComputedRef<string> = computed({
  get: () => props.ruleTitle || '',
  set: (value: string) => {
    if (value !== '') {
      if (rules.value.findIndex(element => element.title === value) === -1) {
        store.commit('addNewRuleSet', { title: value })
      }
    }
    emit('update:ruleTitle', value)
  }
})

/**
 * currentRuleset 現在編集中のルール
 */
const currentRuleset:Ref<LogicRuleSet> = computed(() => {
  if (rules?.value) {
    const currentRule = rules.value.find(element => element.title === currentRulesetTitleComputed.value)
    if (currentRule) {
      return currentRule
    }
  }
  return {
    title: ''
  }
})

/**
 * description ルールの説明 変更は適宜アップデートされる
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
 * createNew() イベントハンドラ 新しいルールセットエントリを作成する
 */
async function createNewRule (): Promise<void> {
  try {
    do {
      // キャンセルは例外でループを抜ける.
      const newSetName = (await ElMessageBox.prompt('新しいルールの名称を入力してください.', '', {
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
      const newSetName = (await ElMessageBox.prompt('ルールの新しい名称を入力してください.', '', {
        confirmButtonText: '変更',
        cancelButtonText: 'キャンセル',
        inputPattern: /\S/,
        inputErrorMessage: '正しく名称を入力してください',
        inputValue: currentRulesetTitleComputed.value
      })).value.trim()
      if (newSetName !== undefined) {
        if (newSetName !== currentRulesetTitleComputed.value) {
          if (ruleTitles.value.includes(newSetName)) {
            await ElMessageBox.alert(`${newSetName}は既に存在しています.別の名称を入力してください.`)
          } else {
            store.commit('changeRuleSetTitle', { old: currentRulesetTitleComputed.value, new: newSetName })
            emit('update:ruleTitle', newSetName)
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
      await ElMessageBox.confirm('現在編集中のルールを削除してよろしいですか', { confirmButtonText: '削除する', cancelButtonText: 'キャンセル' })
    ) {
      store.commit('removeFromRuleSet', currentRulesetTitleComputed.value)
    }
    currentRulesetTitleComputed.value = rules.value[0]?.title || ''
  } catch {
    // do notning :)
  }
}

async function reorderRule (offset: number): Promise<void> {
  try {
    store.commit('reorderRuleSet', { title: currentRulesetTitleComputed.value, offset })
  } catch {
    // do nothing :)
  }
}
</script>

<style>
div.ruleset-controller {
  padding-left: 1rem;
}

.ruleset-selector .el-select {
  width: 18rem;
}
</style>
