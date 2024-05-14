<template>
  <div class="Logic-block" :id="'logicBlock' + props.index.toString()" :style="{ backgroundColor: blockColor }">
    <div class="Logic-block-linenumber" :id="'logicBlock' + props.index.toString()">
      <el-icon @click="reorderBlock(-1)" class="clickable"><ArrowUpBold /></el-icon>
      <div class="Logic-block-linenumber-number">{{ props.index + 1 }}</div>
      <el-icon @click="deleteBlock()" class="clickable"><CloseBold /></el-icon>
      <el-icon @click="reorderBlock(+1)" class="clickable"><ArrowDownBold /></el-icon>
    </div>
    <div class="Logic-block-content">
      <div class="Logic-block-logic">
        <template v-if="props.block.type == 'Operators'">
        <!-- 条件分岐の操作 -->
          <el-row>
            <el-col style="font-weight: bold;">条件分岐を設定します</el-col>
          </el-row>
          <el-row>
            <el-col :span="15">
              <SimpleCascader v-model="argument1st" placeholder="値を選択"
              :options="variables"
              />
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">の</el-col>
            <el-col :span="4">
              <el-select v-model="argument2nd" placeholder="情報の種類を選択">
                <el-option label="値" value="value"/>
                <el-option label="要素の数" value="count"/>
                <el-option label="数値" value="number"/>
              </el-select>
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">が</el-col>
          </el-row>
          <el-row>
            <el-col :span="15">
              <EditableCascader
                placeholder="比較対象を入力もしくは選択"
                v-model="argument3rd"
                :options="variables"
              />
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">の値</el-col>
          </el-row>
          <el-row>
            <el-col :span="12" :offset="10">
              <el-select v-model="argument4th" placeholder="条件を選択">
                <el-option label="と同じ" value="eq"/>
                <el-option label="より大きい" value="gt"/>
                <el-option label="以上" value="ge"/>
                <el-option label="より小さい" value="lt"/>
                <el-option label="以下" value="le"/>
                <el-option label="に含まれる" value="in"/>
                <el-option label="を含む" value="incl"/>
                <el-option label="にマッチする(正規表現)" value="regexp"/>
              </el-select>
            </el-col>
          </el-row>
          <LogicTemplateFinishSelection v-model="trueBehavior">上記が成立した場合</LogicTemplateFinishSelection>
          <LogicTemplateFinishSelection v-model="falseBehavior" allowExit v-if="isFalseBehavior">上記が成立しない場合</LogicTemplateFinishSelection>
        </template>

        <template v-if="props.block.type == 'Variables'">
        <!-- 変数の割り当て -->
          <el-row>
            <el-col style="font-weight: bold;">変数に値を割り当てます</el-col>
          </el-row>
          <el-row>
            <el-col :span="15">
              <EditableCascader
                placeholder="値を入力もしくは選択"
                v-model="argument1st"
                :options="variables"
                />
            </el-col>
            <el-col :span="1" style="margin-top: 0.25rem; margin-left: 0.4rem;">の</el-col>
            <el-col :span="5">
              <el-select v-model="argument3rd" placeholder="種類">
                <el-option label="値" value="value"/>
                <el-option label="要素の数" value="count"/>
                <el-option label="数値" value="number"/>
              </el-select>
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">を</el-col>
          </el-row>
          <el-row>
            <el-col :span="15">
              <SimpleCascader v-model="argument2nd"
                placeholder="変数を選択"
                :options="writeableVariables"
              />
            </el-col>
            <el-col :span="8" style="margin-top: 0.25rem; margin-left: 0.4rem;">に代入する</el-col>
          </el-row>
          <LogicTemplateFinishSelection v-model="trueBehavior" />
        </template>

        <template v-if="props.block.type == 'Query'">
        <!-- サブパスの適用 -->
          <el-row>
            <el-col style="font-weight: bold;">変数に対してJSONPathによるクエリを適用します</el-col>
          </el-row>
          <el-row>
            <el-col :span="15">
              <SimpleCascader v-model="argument1st"
                placeholder="値の元を選択"
                :options="variables"
                />
              </el-col>
            <el-col :span="8" style="margin-top: 0.25rem; margin-left: 0.4rem;">に以下を適用</el-col>
          </el-row>
          <el-row>
            <el-col>
              <el-input placeholder="JSONPath文字列を入力" clearable v-model="argument2nd" />
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="15">
              <SimpleCascader v-model="argument3rd" placeholder="変数を選択"
                :options="writeableVariables"
                />
            </el-col>
            <el-col :span="8" style="margin-top: 0.25rem; margin-left: 0.4rem;">に代入する</el-col>
          </el-row>
          <LogicTemplateFinishSelection v-model="trueBehavior" />
          <LogicTemplateFinishSelection v-model="falseBehavior" allowExit v-if="isFalseBehavior">処理が失敗した場合</LogicTemplateFinishSelection>
        </template>

        <template v-if="props.block.type == 'Period'">
        <!-- 日付計算 -->
          <el-row>
            <el-col style="font-weight: bold;">
              日付を保持した値の差分を計算します
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="8">
              <EditableCascader
                v-model="argument1st"
                placeholder="基準日"
                :options="variables"
                />
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">と</el-col>
            <el-col :span="8">
              <EditableCascader
              v-model="argument2nd"
              placeholder="目的日"
              :options="variables"
              />
            </el-col>
            <el-col :span="4" style="margin-top: 0.25rem; margin-left: 0.4rem;">の差を</el-col>
          </el-row>
          <el-row>
            <el-col :span="8">
              <el-select v-model="argument3rd" placeholder="条件を選択">
                <el-option label="年(切り捨て)" value="years"/>
                <el-option label="年(切り上げ)" value="years,roundup"/>
                <el-option label="月(切り捨て)" value="months"/>
                <el-option label="月(切り上げ)" value="months,roundup"/>
                <el-option label="週(切り捨て)" value="weeks"/>
                <el-option label="週(切り上げ)" value="weeks,roundup"/>
                <el-option label="日" value="days"/>
              </el-select>
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">で</el-col>
            <el-col :span="8">
              <SimpleCascader v-model="argument4th"
              placeholder="変数を選択"
              :options="writeableVariables"
              />
            </el-col>
            <el-col :span="4" style="margin-top: 0.25rem; margin-left: 0.4rem;">に代入</el-col>
          </el-row>
          <LogicTemplateFinishSelection v-model="trueBehavior" />
        </template>

        <template v-if="props.block.type == 'Sets'">
        <!-- 集合演算 -->
          <el-row>
            <el-col style="font-weight: bold;">値集合と値集合の理論演算を行います</el-col>
          </el-row>
          <el-row>
            <el-col :span="18">
              <EditableCascader
                v-model="argument1st"
                placeholder="値1"
                :options="variables"
              />
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">と</el-col>
          </el-row>
          <el-row>
            <el-col :span="18">
              <EditableCascader
                v-model="argument2nd"
                placeholder="値2"
                :options="variables"
                />
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">の</el-col>
          </el-row>
          <el-row>
            <el-col :span="8">
              <el-select v-model="argument3rd" placeholder="演算方法を選択">
                <el-option label="単純連結" value="add"/>
                <el-option label="和集合" value="union"/>
                <el-option label="積集合" value="intersect"/>
                <el-option label="差集合" value="difference"/>
                <el-option label="排他的論理和" value="xor"/>
              </el-select>
            </el-col>
            <el-col :span="2" style="margin-top: 0.25rem; margin-left: 0.4rem;">を</el-col>
            <el-col :span="8">
              <SimpleCascader
                v-model="argument4th"
                placeholder="変数を選択"
                :options="writeableVariables"
                />
            </el-col>
            <el-col :span="4" style="margin-top: 0.25rem; margin-left: 0.4rem;">に代入</el-col>
          </el-row>
          <LogicTemplateFinishSelection v-model="trueBehavior" />
        </template>

        <template v-if="props.block.type == 'Sort'">
        <!-- 並び替え -->
          <el-row>
            <el-col style="font-weight: bold;">変数の値をソートします</el-col>
          </el-row>
          <el-row>
            <el-col :span="18">
              <SimpleCascader
                v-model="argument1st"
                placeholder="値の元を選択"
                :options="writeableVariables"
                />
            </el-col>
            <el-col :span="4" style="margin-top: 0.25rem; margin-left: 0.4rem;">の値を</el-col>
          </el-row>
          <el-row>
            <el-col style="margin-top: 0.25rem;">以下のJSONPathの値で(省略可)</el-col>
          </el-row>
          <el-row>
            <el-col>
              <el-input placeholder="JSONPath文字列を入力(省略時は値でソートします)" clearable v-model="argument2nd" />
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="8">
              <el-select v-model="argument3rd" placeholder="並べ替えの方向">
                <el-option label="昇順" value="asc"/>
                <el-option label="降順" value="desc"/>
              </el-select>
            </el-col>
            <el-col :span="12" style="margin-top: 0.25rem;">に並べ替えます</el-col>
          </el-row>
          <LogicTemplateFinishSelection v-model="trueBehavior" />
        </template>

        <template v-if="props.block.type == 'Translation'">
        <!-- 値の置換 -->
          <el-row>
            <el-col style="font-weight: bold;">変数の値をテーブルで置換します</el-col>
          </el-row>
          <el-row>
            <el-col :span="12">
              <SimpleCascader
              v-model="argument1st"
              placeholder="元の変数を選択"
              :options="writeableVariables"
              />
            </el-col>
            <el-col :span="11" style="margin-top: 0.25rem; margin-left: 0.4rem;">を以下に従って変換します</el-col>
          </el-row>
          <el-row>
            <el-col>
              <table class="translation-table">
                <tr>
                  <th></th>
                  <th>元の値</th><th>変換後の値</th>
                </tr>
                <tr v-for="(element, index) of translationTable" :key="index">
                  <th><el-icon class="clickable" @click="deleteTranslation(index)"><CloseBold /></el-icon></th>
                  <td><el-input v-model.lazy="element[0]" @update:model-value="setTranslation(index, element[0], element[1])"/></td>
                  <td><el-input v-model.lazy="element[1]" @update:model-value="setTranslation(index, element[0], element[1])"/></td>
                </tr>
              </table>
            </el-col>
          </el-row>
          <LogicTemplateFinishSelection v-model="trueBehavior" />
          <LogicTemplateFinishSelection v-model="falseBehavior" allowExit v-if="isFalseBehavior">置換が行われなかった場合</LogicTemplateFinishSelection>
        </template>

        <template v-if="props.block.type == 'Store'">
        <!-- 出力 -->
          <el-row>
            <el-col style="font-weight: bold;">値を出力に割り当てます</el-col>
          </el-row>
          <el-row>
            <el-col :span="11">
              <EditableCascader
                v-model="argument1st"
                placeholder="値を入力もしくは選択"
                :options="variables"
                />
            </el-col>
            <el-col :span="1" style="margin-top: 0.25rem; margin-left: 0.4rem;">を</el-col>
            <el-col :span="7">
              <EditableCascader
                v-model.trim="argument2nd"
                placeholder="CSVの桁を入力"
                :options="[{label: 'エラー出力', value:'$error'}]"
                />
            </el-col>
            <el-col :span="4" style="margin-top: 0.25rem; margin-left: 0.4rem;">に出力</el-col>
          </el-row>
          <el-row>
            <el-col :span="5" style="margin-top: 0.25rem; margin-left: 0.4rem;">配列データは</el-col>
            <el-col :span="12">
              <el-select placeholder="出力方法を指定" v-model="argument3rd">
                <el-option label="最初の値のみを出力" value="first"/>
                <el-option label="空白で区切って出力" value="whitespace"/>
                <el-option label="カンマで区切って出力" value="comma"/>
                <el-option label="セミコロンで区切って出力" value="semicolon"/>
                <el-option label="コロンで区切って出力" value="colon"/>
              </el-select>
            </el-col>
          </el-row>
          <LogicTemplateFinishSelection v-model="trueBehavior" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, WritableComputedRef, ComputedRef } from 'vue'
import { LogicBlock, failableBlockTypes, BlockColorByType } from './types'
import { ArrowUpBold, ArrowDownBold, CloseBold } from '@element-plus/icons-vue'
import { CascaderOption, ElMessageBox } from 'element-plus'
import EditableCascader from './EditableCascader.vue'
import SimpleCascader from './SimpleCascader.vue'
import LogicTemplateFinishSelection from './LogicTemplateFinishSelection.vue'

const props = defineProps<{
  index: number,
  block: LogicBlock,
  sourceCount?: undefined|number,
  variables: CascaderOption[]
}>()

const emits = defineEmits<{
  (e: 'update:block', value: LogicBlock): void,
  (e: 'delete', index: number): void,
  (e: 'reorder', index: number, offset: number): void
}>()

const blockColor = computed(() => {
  if (props.block) {
    return BlockColorByType[props.block.type]
  } else {
    return '#cecdce'
  }
})

const writeableVariables:ComputedRef<CascaderOption[]> = computed(() => props.variables.filter(slot => (slot.value !== 'constants' && slot.value !== 'sources')))

const argument1st: WritableComputedRef<string> = computed({
  get: () => props.block.arguments[0] || '',
  set: (value) => setArguments(0, value)
})

const argument2nd: WritableComputedRef<string> = computed({
  get: () => props.block.arguments[1] || '',
  set: (value) => setArguments(1, value)
})

const argument3rd: WritableComputedRef<string> = computed({
  get: () => props.block.arguments[2] || '',
  set: (value) => setArguments(2, value)
})

const argument4th: WritableComputedRef<string> = computed({
  get: () => props.block.arguments[3] || '',
  set: (value) => setArguments(3, value)
})

const translationTable:ComputedRef<string[][]> = computed(() => {
  if (props.block?.lookup === undefined) {
    return [['', '']]
  } else {
    return props.block.lookup
  }
})

const isFalseBehavior = computed(() => {
  if (props.block) {
    if (failableBlockTypes.includes(props.block.type)) {
      return true
    }
  }
  return false
})

const trueBehavior = computed({
  get: () => props.block.trueBehavior || 1,
  set: (value) => {
    if (typeof value === 'number' || value === 'Abort') {
      const newBlock = Object.assign(props.block, { trueBehavior: value })
      emits('update:block', newBlock)
    }
  }
})

const falseBehavior = computed({
  get: () => props.block?.falseBehavior || 'Abort',
  set: (value) => {
    if (typeof value === 'number' || value === 'Abort' || value === 'Exit') {
      const newBlock = Object.assign(props.block, { falseBehavior: value })
      emits('update:block', newBlock)
    }
  }
})

/**
 * setArguments 引数配列を更新する
 * @param {number} index
 * @param {string} value
 */
function setArguments (index: number, value: string) {
  const args = (props.block.arguments || []) as string[]
  args[index] = value
  const newBlock = Object.assign(props.block, { arguments: [...args] })
  emits('update:block', newBlock)
}

/**
 * deleteTranslation 変換テーブルの行を削除
 * @param {number} index
 */
function deleteTranslation (index:number) {
  const newTable = [...translationTable.value]
  if (newTable.length === 1) {
    newTable.splice(index, 1, ['', ''])
  } else {
    newTable.splice(index, 1)
  }
  const newBlock = Object.assign(props.block, { lookup: newTable })
  emits('update:block', newBlock)
}

/**
 * setTranslation 変換テーブルの行を設定、行を増やす
 * @param {number} index
 * @param {string} op1
 * @param {string} op2
 */
function setTranslation (index:number, op1:string, op2:string) {
  const newTable = [...translationTable.value]
  if (index !== newTable.length - 1) {
    newTable.splice(index, 1, [op1.trim(), op2.trim()])
  } else {
    newTable.splice(index, 1, [op1.trim(), op2.trim()], ['', ''])
  }
  const newBlock = Object.assign(props.block, { lookup: newTable })
  emits('update:block', newBlock)
}

/**
 * deleteBlock ブロック削除のイベントを発火
 */
async function deleteBlock () {
  try {
    await ElMessageBox.confirm('削除してよろしいですか',
      { confirmButtonText: '削除する', cancelButtonText: 'キャンセル' }
    )
    emits('delete', props.index)
  } catch {
  }
}

/**
 * reorderBlock ブロック移動のイベントを発火
 * @param offset
 */
function reorderBlock (offset: number) {
  emits('reorder', props.index, offset)
}

</script>

<style>
div.Logic-block {
  box-sizing: border-box;
  width: 600px;
  margin: 0.3rem;
  border: #444444 solid 0.08rem;
  border-radius: 0.4rem;
  display: flex;
  flex-direction: row;
}

div.Logic-block-linenumber {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  width: 3rem;
  border-right: 1px solid white;
  margin: 1rem 0;
}

div.Logic-block-linenumber > div, i {
  margin-top: 0.3rem;
  margin-bottom: 0.3rem;
}
div.Logic-block-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

div.Logic-block-logic {
  margin: 0.5rem 1rem;
}

div.Logic-block-behavior {
  margin: 0.5rem 1rem;
}

table.translation-table {
  display: block;
  padding: 1rem 0;
  width: 100%;
}

table.translation-table tr {
  height: 1.3rem;
}

table.translation-table tr th:first {
  width: 3rem;
}

table.translation-table tr td {
  width: 50%;
}
</style>
