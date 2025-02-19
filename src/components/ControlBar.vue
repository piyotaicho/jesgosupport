<script setup lang="ts">
import { pulledDocument, processorOutput } from './types'
import { Download, Upload } from '@element-plus/icons-vue'
import { ref, computed, nextTick } from 'vue'
import { useStore } from './store'
import { ElMessageBox } from 'element-plus'
import { Processor } from './newProcessor'
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
          'このソフトウエアでは旧バージョンでの保存はできません.また、旧バージョンのルールセットではエラーが出ることがあります.',
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
      // ルールセットを読み込んだら、編集のルール選択をクリアしておく
      store.commit('setCurrentRulesetTitle', '')
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
  // なにもやることがない
  if (store.getters.rules.length === 0) {
    ElMessageBox.alert('処理するルールセットがありません.')
    return
  }

  const processBody = async () => {
    try {
      // 処理中フラグを設定
      processing.value = true

      // ロギングフラグ
      let verbose = false
      if (command === 'verbose-run' || command === 'compile') {
        verbose = true
      }

      // 処理ユニットの準備
      let processor: Processor

      try {
        processor = new Processor(store.getters.documentVariables, !verbose)
        await processor.compile(store.getters.rules)
      } catch (e) {
        console.error(e)
        if ((e as Error)?.message) {
          const messages = ((e as Error).message as string).split('\n')
          ElMessageBox.alert(messages.slice(1).join('\n'), messages[0])
        }
        throw new Error()
      }

      if (command !== 'compile') {
        // 出力をクリア
        store.commit('clearCsvDocument')
        store.commit('clearErrorDocument')

        if (store.getters.documentLength > 0) {
          // 状態表示用reactiveの設定
          totalCases.value = store.getters.documentLength

          // ドキュメントの逐次処理
          for (let index = 0; index < store.getters.documentLength; index++) {
            if (processing.value) {
              // プログレスバーの更新
              caseIndex.value = index
      
              // ドキュメントの処理
              const jsonDocument:pulledDocument = store.getters.queriedDocument[index]

              // 空ドキュメントのスキップ機能を確認
              if (store.getters.rulesetConfig?.skipUnmatchedRecord) {
                if ((jsonDocument?.documentList || []).length === 0) {
                  continue
                }
              }

              try {
                // ドキュメントを処理
                const returnValues = await processor.run(jsonDocument)
                if (returnValues !== undefined) {
                  store.commit('addCsvDocument', [...returnValues.csv])
                  store.commit('addErrorDocument', {
                    hash: jsonDocument?.hash || '',
                    errors: [...(returnValues.errors || [])]
                  })
                }
              } catch (e) {
                console.error(e)
                if ((e as Error)?.message) {
                  const messages = ((e as Error).message as string).split('\n')
                  ElMessageBox.alert(messages.slice(1).join('\n'), messages[0])
                }
                throw new Error()
              }
            }
          }
        }
      }
    } finally {
      caseIndex.value = -1
      processing.value = false
    }
    //
  }

  // 処理実行中フラグを初期化
  processing.value = false
  // 非同期実行へ
  processBody()
}

function cancel (): void {
  processing.value = false
}

/**
 * ドキュメントに対するスクリプトの実行
 * @param index
 */
async function processDocument (index:number, processor: Processor) {
  // ドキュメントに処理を適用
  let returnObject: processorOutput|undefined
  // ドキュメントの直接取得
  const jsonDocument:pulledDocument = await store.getters.queriedDocument[index]

  // 空白ドキュメントのスキップ指示あり
  if (store.getters.rulesetConfig?.skipUnmatchedRecord === true) {
    if ((jsonDocument?.documentList || []).length === 0) {
      // ドキュメントがないのでスキップ
      return undefined
    }
  }

  try {
    returnObject = await processor.run(jsonDocument)
  } catch (e) {
    console.error(e)
    if ((e as Error)?.message) {
      const messages = ((e as Error).message as string).split('\n')
      ElMessageBox.alert(messages.slice(1).join('\n'), messages[0])
    }
    throw new Error()
  }

  // 処理済みデータを書き出し
  if (returnObject !== undefined) {
    const hash = jsonDocument?.hash || ''
    const { csv: csvRow, errors: errorMessages } = returnObject
    store.commit('addCsvDocument', csvRow)
    store.commit('addErrorDocument', {
      hash,
      errors: [...(errorMessages || [])]
    })
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
        <RulesetConfig v-if="openMenu" @close="() => openMenu = false"/>
      </el-dialog>
    </div>
    <div>
      <el-dropdown split-button type="primary" @click="performProcessing" @command="performProcessing" :disabled="processing">
        実行
        <template #dropdown>
          <el-dropdown-item :disabled="processing" command="verbose-run">コンソール出力付きで実行</el-dropdown-item>
          <el-dropdown-item :disabled="processing" command="compile">コンパイルのみ実行</el-dropdown-item>
          <!-- <el-dropdown-item disabled command="step">ステップ実行モード</el-dropdown-item> -->
        </template>
      </el-dropdown>
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
