<script setup lang="ts">
import { processorOutput } from './types'
import { CaretRight, Download, Upload } from '@element-plus/icons-vue'
import { ref, computed, nextTick } from 'vue'
import { useStore } from './store'
import { ElMessageBox } from 'element-plus'
// import { processor } from './processor'
import { processor } from './newProcessor'
import { userDownload, loadFile } from './utilities'
import RulesetConfig from './RulesetConfig.vue'
import ProgressBar from './ProgressBar.vue'

const store = useStore()

const openMenu = ref(false)
const processing = ref(false)
const caseIndex = ref(-1)
const totalCases = ref(0)

const rulesetTitle = computed({
  get: () => store.getters.rulesetTitle,
  set: (newvalue) => store.commit('setRulesetTitle', newvalue)
})

/**
 * ドロップダウンメニューハンドラ
 * @param command コマンド文字列'load'|'save'|'clear'|'menu'
 */
function commandHandler (command:string):void {
  switch (command) {
    case 'load':
      loadRuleset()
      break
    case 'save':
      saveRuleset()
      break
    case 'clear':
      clearRuleset()
      break
    case 'menu':
      openMenu.value = true
      break
    default:
      break
  }
}

/**
 * saveRuleset ルールセットのダウンロードリンクを作成
 */
function saveRuleset ():void {
  if (store.getters.rules.length > 0) {
    const data = {
      title: store.getters.rulesetTitle,
      config: store.getters.rulesetConfig,
      rules: store.getters.rules
    }
    userDownload(JSON.stringify(data, null, 2), 'ruleset.json')
  }
}

/**
 * loadRuleset FILE APIで読み込んだJSONファイルをルールセットに保存
 * @param {Event} HTMLイベントオブジェクト
 */
async function loadRuleset () {
  try {
    const content = await loadFile()
    if (content) {
      // version 0.1.0のtypoを強制的に排除
      const replacedContent = (content as string).replace(/([bB])ehaivior"/g, '$1ehavior"')
      const loadedRuleset = JSON.parse(replacedContent)

      if (Array.isArray(loadedRuleset) && loadedRuleset[0]?.title) {
        store.dispatch('clearRuleset')
        // version 0.x
        store.commit('setRuleSet', loadedRuleset)
        await ElMessageBox.alert(
          'このソフトウエアでは旧バージョンでの保存はできません.',
          '旧バージョンのルールセット',
          {
            confirmButtonText: 'OK'
          })
      } else if (
        loadedRuleset?.title !== undefined &&
        (loadedRuleset?.rules && Array.isArray(loadedRuleset.rules))
      ) {
        store.dispatch('clearRuleset')
        // version 1.x
        store.commit('setRulesetTitle', loadedRuleset.title)
        store.commit('setRulesetConfig', loadedRuleset?.config || {})
        store.commit('setRuleSet', loadedRuleset.rules)
      } else {
        throw new Error('このファイルは有効なルールセットが記載されたJSONファイルではないようです.')
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e:any) {
    ElMessageBox.alert(e.message)
  }
}

/**
 * ルールセットの設定を初期化
 */
async function clearRuleset () {
  await store.dispatch('clearRuleset')
  await nextTick()
}

/**
 * スクリプトの実行トリガ
 */
function performProcessing (command?:string): void {
  if (command === 'compile') {
    //
  }
  if (store.getters.documentLength === 0 || store.getters.rules.length === 0) {
    console.log('ドキュメントとスクリプトがありません')
  }

  store.commit('clearCsvDocument')
  store.commit('clearErrorDocument')

  const processBody = async () => {
    // 状態表示用reactiveの設定
    totalCases.value = store.getters.documentLength
    processing.value = true
    // ドキュメントの逐次処理
    for (let index = 0; index < store.getters.documentLength; index++) {
      if (processing.value) {
        caseIndex.value = index
        await processDocument(index)
      }
    }
    //
    caseIndex.value = -1
    processing.value = false
  }
  // asyncに処理を渡す
  processBody()
}

function cancel (): void {
  processing.value = false
}

/**
 * ドキュメントに対するスクリプトの実行
 * @param index
 */
async function processDocument (index:number) {
  const hash = store.getters.document(index)?.hash || ''

  let returnObject: processorOutput|undefined
  try {
    returnObject = (await processor(store.getters.document(index), store.getters.rules))
  } catch (e) {
    console.error(e)
  }

  // 処理済みデータを書き出し
  if (returnObject !== undefined) {
    const { csv: csvRow, errors: errorMessages } = returnObject
    store.commit('addCsvDocument', csvRow)
    const type = store.getters.jesgodocument(index)[0]?.患者台帳?.がん種
    console.log(type)
    store.commit('addErrorDocument', type
      ? {
          hash,
          type,
          errors: [...(errorMessages || [])]
        }
      : {
          hash,
          errors: [...(errorMessages || [])]
        }
    )
  }
}
</script>

<template>
  <div class="control-bar">
    <div>
      <el-dropdown split-button type="primary" @click="commandHandler('menu')" @command="commandHandler">
        ルールセットの設定
        <template #dropdown>
          <el-dropdown-item command="load"><el-icon><Upload/></el-icon> ルールセットの読み込み</el-dropdown-item>
          <el-dropdown-item command="save" :disabled="store.getters.rules.length === 0"><el-icon><download/></el-icon>ルールセットを保存</el-dropdown-item>
          <el-dropdown-item command="clear" divided>ルールセットを初期化</el-dropdown-item>
        </template>
      </el-dropdown>
    </div>
    <div>
      <el-input style="width: 20rem;" v-model="rulesetTitle" placeholder="ルールセットの名称未設定"/>
      <el-dialog title="ルールセットの詳細設定"
        v-model="openMenu" :show-close="false" :close-on-click-modal="false">
        <RulesetConfig v-if="openMenu" @close="openMenu = false"/>
      </el-dialog>
    </div>
    <div>
      <!-- <el-dropdown split-button type="primary" @click="performProcessing" :disabled="processing">
        実行<el-icon><CaretRight/></el-icon> -->
        <el-button type="primary" :icon="CaretRight" @click="performProcessing()" :loading="processing" :disabled="processing">実行</el-button>
        <!-- <template #dropdown>
          <el-dropdown-item :disabled="processing" command="compile">コンパイルのみ実行</el-dropdown-item>
          <el-dropdown-item disabled command="step">ステップ実行モード</el-dropdown-item>
        </template> -->
      <!-- </el-dropdown> -->
      <el-dialog
        :model-value="(processing || caseIndex >= 0)"
        :show-close="false"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :close-delay="caseIndex >= 0 ? 500 : 0"
        style="width: 20rem;"
        title="処理実行中">
        <ProgressBar :index="caseIndex" :length="totalCases" @cancel="cancel" />
      </el-dialog>
    </div>
  </div>
</template>

<style>
div.control-bar {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
</style>
