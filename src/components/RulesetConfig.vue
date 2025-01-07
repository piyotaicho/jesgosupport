<script setup lang="ts">
import { ref, Ref, computed, ComputedRef, onMounted } from 'vue'
import { useStore } from './store'
import { configObject } from './types'
import { configulationPresets } from './presets'

const store = useStore()
const emit = defineEmits<{
  close: []
}>()

const presetNames:ComputedRef<string[]> = computed(() => configulationPresets.map(preset => preset.title))

const rulesetName = ref('')

const selectedPreset = ref('')

const masterQuery:Ref<string[]> = ref([])
let removingQuery:boolean = false
const masterBasePointer = ref('')
const skipUnmatchedRecord = ref(false)
const csvOffset = ref(0)
const csvSJIS = ref(true)
const errorPointer = ref('')
const errorTargetId = ref('')

const documentVariables:string[] = []

onMounted(() => {
  // 値をストアから取得
  const config:configObject = store.getters.rulesetConfig
  const title:string = store.getters.rulesetTitle

  rulesetName.value = title

  masterQuery.value = config?.masterQuery?.map(query => query.charAt(0) === '$' ? query.slice(1) : query) || ['']
  masterBasePointer.value = config?.masterBasePointer?.charAt(0) === '/' ? config.masterBasePointer.slice(1) : ''
  skipUnmatchedRecord.value = config?.skipUnmatchedRecord || false

  documentVariables.push(...(config?.documentVariables || []))

  csvOffset.value = config?.csvOffset || 0
  csvSJIS.value = !(config?.csvUnicode || false)
  errorPointer.value = config?.errorPointer?.charAt(0) === '/' ? config.errorPointer.slice(1) : 'jesgo:error'
  errorTargetId.value = config?.errorTargetSchemaId || ''
})

function applyPreset () {
  const index = configulationPresets.findIndex(item => item.title === selectedPreset.value)

  if (index >= 0) {
    masterQuery.value = [...configulationPresets[index]?.masterQuery?.map(query => query.charAt(0) === '$' ? query.slice(1) : query) || [], '']
    masterBasePointer.value = configulationPresets[index]?.masterBasePointer || '/'
    masterBasePointer.value = masterBasePointer.value.charAt(0) === '/' ? masterBasePointer.value.slice(1) : masterBasePointer.value
    csvOffset.value = configulationPresets[index]?.csvOffset || 0
    csvSJIS.value = !(configulationPresets[index]?.csvUnicode || false)
    errorTargetId.value = configulationPresets[index]?.errorTargetSchemaId || ''
    errorPointer.value = configulationPresets[index]?.errorPointer || '/jesgo:error'
    errorPointer.value = errorPointer.value.charAt(0) === '/' ? errorPointer.value.slice(1) : errorPointer.value
  }
  selectedPreset.value = ''
}

function setQuery (index:number|string, value?:string) {
  // El-imputがclearしたときにinput('')をトリガするので広域フラグで回避する
  if (value === undefined) {
    // removeQuery
    removingQuery = true
    removeQuery(index)
  } else {
    // setQueryValue
    if (removingQuery) {
      removingQuery = false
    } else {
      const lastIndex = masterQuery.value.length
      masterQuery.value[Number(index)] = value
      if (value !== '' && Number(index) === lastIndex - 1) {
        masterQuery.value.push('')
      }
    }
  }
}

function removeQuery (index: number|string) {
  masterQuery.value.splice(Number(index), 1)
  if (masterQuery.value.length === 0) {
    masterQuery.value.push('')
  }
  console.dir(masterQuery.value)
}

function commit () {
  const newConfig: configObject = {
    masterQuery: masterQuery.value.map(query => '$' + query),
    masterBasePointer: '/' + masterBasePointer.value,
    skipUnmatchedRecord: skipUnmatchedRecord.value,
    documentVariables,
    csvOffset: csvOffset.value,
    csvUnicode: !csvSJIS.value,
    errorPointer: '/' + errorPointer.value,
    errorTargetSchemaId: errorTargetId.value
  }
  store.commit('setRulesetTitle', rulesetName.value)
  store.commit('setRulesetConfig', newConfig)

  closeMenu()
}

function closeMenu () {
  emit('close')
}
</script>

<template>
  <div class="ruleset-configulation">
    <el-row>
      <el-col :span="8" class="ruleset-config-label-column">ルールセット名称</el-col>
      <el-col :span="14">
        <el-input v-model="rulesetName" placeholder="名称未設定"/>
      </el-col>
    </el-row>
    <el-row style="margin-top: 0.8rem;">
      <el-col :span="8" class="ruleset-config-label-column">プリセット</el-col>
      <el-col :span="14">
        <el-select v-model="selectedPreset" placeholder="各種プリセットが利用出来ます" @change="applyPreset">
          <el-option
            v-for="item in presetNames"
            :key="item" :label="item" :value="item"/>
        </el-select>
      </el-col>
    </el-row>
    <template v-for="(value, index) in masterQuery" :key="index">
      <template v-if="index === 0">
        <el-row style="margin-top: 0.8rem;">
          <el-col :span="8" class="ruleset-config-label-column">マスタークエリ</el-col>
          <el-col :span="14">
            <el-input :model-value="value" @input="setQuery(0, $event)" clearable @clear="() => setQuery(0)">
              <template #prepend>$</template>
            </el-input>
          </el-col>
        </el-row>
      </template>
      <template v-else>
        <el-row style="margin-top: 0.6rem;">
          <el-col :span="14" :offset="8">
            <el-input :model-value="value" @input="setQuery(index, $event)" clearable @clear="() => setQuery(index)">
              <template #prepend>$</template>
            </el-input>
          </el-col>
        </el-row>
      </template>
    </template>
    <el-row style="margin-top: 0.6rem;">
      <el-col :span="8" class="ruleset-config-label-column">クエリ展開ポインタ</el-col>
      <el-col :span="14">
        <el-input v-model="masterBasePointer" clearable @clear="() => masterBasePointer = ''">
          <template #prepend>/</template>
        </el-input>
      </el-col>
    </el-row>
    <el-row style="margin-top: 0.6rem;">
      <el-col :span="8" class="ruleset-config-label-column">クエリ不一致の場合</el-col>
      <el-col :span="14"><el-checkbox v-model="skipUnmatchedRecord" label="レコードをスキップする"/></el-col>
    </el-row>
    <el-row style="margin-top: 1.2rem;">
      <el-col :span="8" class="ruleset-config-label-column">CSV先頭行オフセット</el-col>
      <el-col :span="14"><el-input-number v-model="csvOffset" :min="0"/></el-col>
    </el-row>
    <el-row style="margin-top: 1.2rem;">
      <el-col :span="8" class="ruleset-config-label-column">CSV文字コード</el-col>
      <el-col :span="14"><el-checkbox v-model="csvSJIS" label="シフトJISで出力する"/></el-col>
    </el-row>
    <el-row style="margin-top: 1.2rem;">
      <el-col :span="8" class="ruleset-config-label-column">エラードキュメントスキーマ</el-col>
      <el-col :span="14"><el-input v-model="errorTargetId" clearable/></el-col>
    </el-row>
    <el-row style="margin-top: 0.6rem;">
      <el-col :span="8" class="ruleset-config-label-column">エラー保存先ポインタ</el-col>
      <el-col :span="14">
        <el-input v-model="errorPointer" clearable @clear="() => errorPointer = 'jesgo:error'">
          <template #prepend>/</template>
        </el-input>
      </el-col>
    </el-row>
    <el-row style="margin-top: 1.5rem;">
      <el-col :span="3" :offset="8"><el-button @click="closeMenu">キャンセル</el-button></el-col>
      <el-col :span="3" :offset="2"><el-button type="primary" @click="commit">変更を保存</el-button></el-col>
    </el-row>
</div>
</template>

<style>
div.ruleset-configulation {
  display: flex;
  flex-direction: column;
}

.ruleset-config-label-column {
  margin-top: 0.35rem;
}
</style>
