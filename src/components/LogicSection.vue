<template>
  <div class="logic-section">
    <div class="logic-section-ruleset">
      <LogicRules v-model:ruleTitle="currentRulesetTitle"/>
    </div>

    <!-- ロジックエディタ -->
    <div class="logic-section-ruleset" v-show="currentRulesetTitle !== '' && currentRulesetTitle !== '変数宣言'">
      <div style="width: 100%; margin-right: 0.8rem;">
        <LogicSource v-for="(block, index) in sources" :key="index" :index="index" :block="block" @updateblock="updateSource"/>
      </div>
      <LogicEditor v-model:blocks="procedures" :sourceCount="sourceCount"/>
    </div>

    <!-- ユーザ定義のドキュメント変数 -->
    <div class="logic-section-ruleset" v-show="currentRulesetTitle === '変数宣言'">
      <VariableEditor/>
    </div>
</div>
</template>

<script setup lang="ts">
import { ref, Ref, computed, WritableComputedRef, ComputedRef } from 'vue'
import { useStore } from './store'
import { LogicBlock, SourceBlock, LogicRuleSet } from './types'
import LogicSource from './LogicSource.vue'
import LogicEditor from './LogicEditor.vue'
import LogicRules from './LogicRules.vue'
import VariableEditor from './VariableEditor.vue'

const store = useStore()

/**
 * rules ルールすべて
 */
const rules:ComputedRef<LogicRuleSet[]> = computed(() => store.getters.rules)

/**
 * currentRulesetTitle 現在編集中のルールのタイトル
 */
const currentRulesetTitle:Ref<string> = ref('')

/**
 * currentRuleset 現在編集中のルール
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
 * sources ルールのソース配列
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
    return [...sourcelist, { path: '' }] // ソースは無制限 .slice(0, 8) // 便宜上ソースは8個までとする
  },
  set: (newSources: SourceBlock[]) => {
    const newRule = Object.assign(
      currentRuleset?.value || {},
      { source: newSources }
    )
    store.commit('upsertRule', newRule)
  }
})

/**
 * ルールのソース数 @1..
 */
const sourceCount: ComputedRef<number> = computed(() => (currentRuleset.value?.source || []).length)

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
    store.commit('upsertRule', newRule)
  }
})

</script>

<style>
div.logic-section {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 630px;
  height: 100%;
  overflow-y: auto;
}

div.logic-section-ruleset {
  padding-left: 0.5rem;
  padding-top: 0.3rem;
}
</style>
