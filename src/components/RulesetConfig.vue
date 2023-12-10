<script setup lang="ts">
import { defineEmits, ref, computed, ComputedRef, onMounted } from 'vue'
import { useStore } from './store'
import { configObject } from './types'

const store = useStore()
const emit = defineEmits<{
  close: []
}>()

// プリセットリスト
interface presetObject extends configObject {
  title: string
}
const configulationPresets:presetObject[] = [
  {
    title: '子宮頸がん',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "子宮頸がん")]'
    ],
    masterBasePointer: '/患者台帳',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    errorTargetSchemaId: '/schema/CC/root',
    errorMountpoint: '/jesgo:error'
  },
  {
    title: '子宮体がん',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "子宮体がん")]'
    ],
    masterBasePointer: '/患者台帳',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    errorTargetSchemaId: '/schema/EM/root',
    errorMountpoint: '/jesgo:error'
  },
  {
    title: '卵巣がん',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "卵巣がん")]'
    ],
    masterBasePointer: '/患者台帳',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    errorTargetSchemaId: '/schema/OV/root',
    errorMountpoint: '/jesgo:error'
  }
]

const presetNames:ComputedRef<string[]> = computed(() => configulationPresets.map(preset => preset.title))

const rulesetName = ref('')

const selectedPreset = ref('')

const masterQuery = ref([''])
const masterBasePointer = ref('')
const skipUnmatchedRecord = ref(false)
const csvOffset = ref(0)
const errorMountpoint = ref('')
const errorTargetId = ref('')

onMounted(() => {
  const config:configObject = store.getters.rulesetConfig
  const title:string = store.getters.rulesetTitle

  rulesetName.value = title

  masterQuery.value = config?.masterQuery || ['$']
  masterBasePointer.value = config?.masterBasePointer || '/'
  skipUnmatchedRecord.value = config?.skipUnmatchedRecord || false
  csvOffset.value = config?.csvOffset || 0
  errorMountpoint.value = config?.errorMountpoint || '/jesgo:error'
  errorTargetId.value = config?.errorTargetSchemaId || ''
})

function applyPreset () {
  const index = configulationPresets.findIndex(item => item.title === selectedPreset.value)

  if (index >= 0) {
    masterQuery.value = configulationPresets[index]?.masterQuery || ['$']
    masterBasePointer.value = configulationPresets[index]?.masterBasePointer || '/'
    csvOffset.value = configulationPresets[index]?.csvOffset || 0
    errorTargetId.value = configulationPresets[index]?.errorTargetSchemaId || ''
    errorMountpoint.value = configulationPresets[index]?.errorMountpoint || '/jesgo:error'
  }
  selectedPreset.value = ''
}

function commit () {
  const newConfig: configObject = {
    masterQuery: masterQuery.value,
    masterBasePointer: masterBasePointer.value,
    csvOffset: csvOffset.value,
    errorMountpoint: errorMountpoint.value,
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
      <el-col :span="16">
        <el-input v-model="rulesetName" placeholder="名称未設定"/>
      </el-col>
    </el-row>
    <el-row style="margin-top: 0.8rem;">
      <el-col :span="8" class="ruleset-config-label-column">プリセット選択</el-col>
      <el-col :span="16">
        <el-select v-model="selectedPreset" placeholder="プリセットを利用出来ます" @change="applyPreset">
          <el-option
            v-for="item in presetNames"
            :key="item" :label="item" :value="item"/>
        </el-select>
      </el-col>
    </el-row>
    <template v-for="(value,index) in masterQuery" :key="index">
      <template v-if="index === 0">
        <el-row style="margin-top: 0.8rem;">
          <el-col :span="8" class="ruleset-config-label-column">マスタークエリ</el-col>
          <el-col :span="16">
            <el-input v-model="masterQuery[0]" clearable @clear="masterQuery[0] = '$'"/>
          </el-col>
        </el-row>
      </template>
      <templace v-else>
        <el-row style="margin-top: 0.6rem;">
          <el-col :span="16" :offset="8">
            <el-input v-model="masterQuery[index]" clearable @clear="masterQuery.splice(index, 1)"/>
          </el-col>
        </el-row>
      </templace>
    </template>
    <templace v-if="masterQuery.slice(-1)[0] !== '$'">
      <el-row style="margin-top: 0.6rem;">
        <el-col :span="16" :offset="8">
            <el-input clearable @change="(event) => masterQuery.push(event)"/>
          </el-col>
      </el-row>
    </templace>
    <el-row style="margin-top: 0.6rem;">
      <el-col :span="8" class="ruleset-config-label-column">クエリ展開ポインタ</el-col>
      <el-col :span="16"><el-input v-model="masterBasePointer" clearable @clear="masterBasePointer = '/'"/></el-col>
    </el-row>
    <el-row style="margin-top: 0.6rem;">
      <el-col :span="8" class="ruleset-config-label-column">クエリ不一致の場合</el-col>
      <el-col :span="16"><el-checkbox v-model="skipUnmatchedRecord" label="レコードをスキップする"/></el-col>
    </el-row>
    <el-row style="margin-top: 1.2rem;">
      <el-col :span="8" class="ruleset-config-label-column">CSV先頭行オフセット</el-col>
      <el-col :span="16"><el-input-number v-model="csvOffset" :min="0"/></el-col>
    </el-row>
    <el-row style="margin-top: 1.2rem;">
      <el-col :span="8" class="ruleset-config-label-column">エラードキュメントスキーマ</el-col>
      <el-col :span="16"><el-input v-model="errorTargetId" clearable/></el-col>
    </el-row>
    <el-row style="margin-top: 0.6rem;">
      <el-col :span="8" class="ruleset-config-label-column">エラー保存先ポインタ</el-col>
      <el-col :span="16"><el-input v-model="errorMountpoint" clearable @clear="errorMountpoint = '/jesgo:error'"/></el-col>
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
