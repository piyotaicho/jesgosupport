<template>
  <div class="ruleset">
    <el-row :gutter="0" justify="space-around">
      <el-col :span="4" style="margin-top: 0.35rem;">ルール名称 : </el-col>
      <el-col :span="11">
        <el-select v-model="currentRulesetTitle"
          placeholder="ルールを選択"
          no-data-text="選択可能なルールがありません"
          >
          <el-option v-for="(title, index) in ruleTitles" :key="index"
            :value="title" :label="title" />
        </el-select>
      </el-col>
      <el-col :span="7">
        <div class="ruleset-controller">
          <el-button-group>
            <el-tooltip content="新しいルールを作成" placement="bottom" :show-after="500">
              <el-button type="primary" :icon="Plus" circle @click="createNewRule()"/>
            </el-tooltip>
            <el-tooltip content="現在のルールをひとつ前に移動" placement="bottom" :show-after="500">
              <el-button type="primary" :icon="CaretTop" :disabled="disableControles" circle @click="reorderRule(-1)"/>
            </el-tooltip>
            <el-tooltip content="現在のルールをひとつ後に移動" placement="bottom" :show-after="500">
              <el-button type="primary" :icon="CaretBottom" :disabled="disableControles" circle @click="reorderRule(+1)"/>
            </el-tooltip>
            <el-tooltip content="現在のルールの名称を変更" placement="bottom" :show-after="500">
              <el-button type="primary" :icon="EditPen" :disabled="disableControles" circle @click="renameRule()"/>
            </el-tooltip>
            <el-tooltip content="現在のルールを削除" placement="bottom" :show-after="500">
              <el-button type="primary" :icon="Delete" :disabled="disableControles" circle @click="deleteRule()"/>
            </el-tooltip>
          </el-button-group>
        </div>
      </el-col>
    </el-row>
    <el-row style="padding-top: 0.3rem;" v-show="!disableControles">
      <el-col>
        <el-input v-model="description" placeholder="ルールの説明" type="textarea" />
      </el-col>
    </el-row>
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
 * currentRulesetTitle ルールの追加に対応
 */
const currentRulesetTitle: WritableComputedRef<string> = computed({
  get: () => props.ruleTitle || '',
  set: (value: string) => {
    if (value !== '') {
      if (rules.value.findIndex(element => element.title === value) === -1) {
        store.commit('addRule', { title: value })
      }
    }
    emit('update:ruleTitle', value)
  }
})

/**
 * disabledControles 現在選択中のルールが無い
 */
const disableControles: ComputedRef<boolean> = computed(() => currentRulesetTitle.value === '')

/**
 * currentRuleset 現在編集中のルールオブジェクト
 */
const currentRuleset:Ref<LogicRuleSet> = computed(() => {
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
      store.commit('upsertRule', newRule)
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
          currentRulesetTitle.value = newSetName
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
    if (currentRulesetTitle.value) {
      const newSetName = (await ElMessageBox.prompt('ルールの新しい名称を入力してください.', '', {
        confirmButtonText: '変更',
        cancelButtonText: 'キャンセル',
        inputPattern: /\S/,
        inputErrorMessage: '正しく名称を入力してください',
        inputValue: currentRulesetTitle.value
      })).value.trim()
      if (newSetName !== undefined) {
        if (newSetName !== currentRulesetTitle.value) {
          if (ruleTitles.value.includes(newSetName)) {
            await ElMessageBox.alert(`${newSetName}は既に存在しています.別の名称を入力してください.`)
          } else {
            store.commit('changeRuleTitle', { old: currentRulesetTitle.value, new: newSetName })
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
      currentRulesetTitle.value &&
      await ElMessageBox.confirm('現在編集中のルールを削除してよろしいですか', { confirmButtonText: '削除する', cancelButtonText: 'キャンセル' })
    ) {
      store.commit('removeRule', currentRulesetTitle.value)
    }
    currentRulesetTitle.value = rules.value[0]?.title || ''
  } catch {
    // do notning :)
  }
}

async function reorderRule (offset: number): Promise<void> {
  try {
    store.commit('reorderRuleSet', { title: currentRulesetTitle.value, offset })
  } catch {
    // do nothing :)
  }
}
</script>

<style>
div.ruleset .el-select {
  width: 100%;
}
</style>
