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
          <div>
            条件を設定します：
          </div>
          <div>
            <el-select v-model="argument1st" placeholder="変数を選択">
              <el-option v-for="(element, index) in optionsLabelValue" :key="index" :label="element.label" :value="element.value" />
            </el-select>
            の
            <el-select v-model="argument2nd" placeholder="情報の種類を選択">
              <el-option label="値" value="value"/>
              <el-option label="数" value="count"/>
            </el-select>
            が
          </div>
          <div style="display: flex; flex-direction: row;">
            <div>
              <DropdownCombo
                placeholder="比較対象を入力もしくは選択"
                v-model="argument3rdTranslated"
              >
                <el-option v-for="(element, index) in optionsLabelValue" :key="index" :label="element.label" :value="element.value" />
              </DropdownCombo>
            </div>
            <div>
              の値
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
            </div>
          </div>
        </template>

        <template v-if="props.block.type == 'Variables'">
        <!-- 変数の割り当て -->
          <div>
            変数に値を割り当てます
          </div>
          <div style="display: flex; flex-direction: row;">
            <div style="flex: 1;">
              <DropdownCombo placeholder="値を入力もしくは選択"
                v-model="argument1stTranslated">
                <el-option v-for="(element, index) in optionsLabelValue" :key="index" :label="element.label" :value="element.value" />
              </DropdownCombo>
            </div>
            <div style="flex: initial;">を</div>
          </div>
          <div>
            <el-select v-model="argument2nd" placeholder="変数を選択">
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label.slice(0, 2) === '変数'" :label="element.label" :value="element.value" />
              </template>
            </el-select>
            に代入する
          </div>
        </template>

        <template v-if="props.block.type == 'Query'">
        <!-- サブパスの適用 -->
          <div>
            変数に対してJSONPathによるクエリを適用します
          </div>
          <div>
            <el-select placeholder="値の元を選択" v-model="argument1st">
              <el-option v-for="(element, index) in optionsLabelValue" :key="index" :label="element.label" :value="element.value" />
            </el-select>
            に以下のJSONPathを適用
          </div>
          <div>
            <el-input placeholder="JSONPath文字列を入力" clearable v-model="argument2nd" />
          </div>
          <div>
            <el-select v-model="argument3rd" placeholder="変数を選択">
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label.slice(0, 2) === '変数'" :label="element.label" :value="element.value" />
              </template>
            </el-select>
            に代入する
          </div>
        </template>

        <template v-if="props.block.type == 'Period'">
        <!-- 日付計算 -->
          <div>
            日付を保持した値の差分を計算します
          </div>
          <div style="display: flex; flex-direction: row;">
            <DropdownCombo
              placeholder="基準を入力もしくは選択"
              v-model="argument1stTranslated"
            >
              <!-- <el-option v-for="(element, index) in optionsLabelValue" :key="index" :label="element.label" :value="element.value" /> -->
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label !== 'ハッシュ値'" :label="element.label" :value="element.value" />
              </template>
              <el-option label="今日の日付" value="$now" />
            </DropdownCombo>

            <!-- <el-select placeholder="基準を選択" v-model="argument1st">
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label !== 'ハッシュ値'" :label="element.label" :value="element.value" />
              </template>
            </el-select> -->
            <span>と</span>

            <DropdownCombo
              placeholder="基準を入力もしくは選択"
              v-model="argument2ndTranslated"
            >
              <!-- <el-option v-for="(element, index) in optionsLabelValue" :key="index" :label="element.label" :value="element.value" /> -->
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label !== 'ハッシュ値'" :label="element.label" :value="element.value" />
              </template>
              <el-option label="今日の日付" value="$now" />
            </DropdownCombo>

            <!-- <el-select v-model="argument2nd" placeholder="比較対象を選択">
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label !== 'ハッシュ値'" :label="element.label" :value="element.value" />
              </template>
              <el-option label="今日の日付" value="$now" />
            </el-select> -->
            <span>の差を</span>
          </div>
          <div style="display: flex; flex-direction: row;">
            <el-select v-model="argument3rd" placeholder="条件を選択">
              <el-option label="年(切り捨て)" value="years"/>
              <el-option label="年(切り上げ)" value="years,roundup"/>
              <el-option label="月(切り捨て)" value="months"/>
              <el-option label="月(切り上げ)" value="months,roundup"/>
              <el-option label="週(切り捨て)" value="weeks"/>
              <el-option label="週(切り上げ)" value="weeks,roundup"/>
              <el-option label="日" value="days"/>
            </el-select>
            <span>で</span>
            <el-select v-model="argument4th" placeholder="変数を選択">
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label.slice(0, 2) === '変数'" :label="element.label" :value="element.value" />
              </template>
            </el-select>
            <span>に代入</span>
          </div>
        </template>

        <template v-if="props.block.type == 'Sets'">
        <!-- 集合演算 -->
          <div>
            値集合と値集合の理論演算を行います
          </div>
          <div style="display: flex; flex-direction: row;">
            <DropdownCombo
              placeholder="値1"
              v-model="argument1stTranslated"
            >
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label !== 'ハッシュ値'" :label="element.label" :value="element.value" />
              </template>
            </DropdownCombo>
            <span>と</span>
            <DropdownCombo
              placeholder="値2"
              v-model="argument2ndTranslated"
            >
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label !== 'ハッシュ値'" :label="element.label" :value="element.value" />
              </template>
            </DropdownCombo>
            <span>の</span>
          </div>
          <div style="display: flex; flex-direction: row;">
            <el-select v-model="argument3rd" placeholder="演算方法を選択">
              <el-option label="単純連結" value="add"/>
              <el-option label="和集合" value="union"/>
              <el-option label="積集合" value="intersect"/>
              <el-option label="差集合" value="difference"/>
              <el-option label="排他的論理和" value="xor"/>
            </el-select>
            <span>を</span>
            <el-select v-model="argument4th" placeholder="変数を選択">
              <template v-for="(element, index) in optionsLabelValue" :key="index" >
                <el-option v-if="element.label.slice(0, 2) === '変数'" :label="element.label" :value="element.value" />
              </template>
            </el-select>
            <span>に代入</span>
          </div>
        </template>

        <template v-if="props.block.type == 'Translation'">
        <!-- 値の置換 -->
          <div>
            値をテーブルで変換します
          </div>
          <div>
            <el-select placeholder="値の元を選択" v-model="argument1st">
              <el-option v-for="(element, index) in optionsLabelValue" :key="index" :label="element.label" :value="element.value" />
            </el-select>
            を以下のテーブルに従って変換します。
          </div>
          <div>
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
          </div>
        </template>

        <template v-if="props.block.type == 'Store'">
        <!-- 出力 -->
          <div>
            値をCSVのフィールドもしくは症例エラー出力に割り当てます
          </div>
          <div style="display: flex; flex-direction: row;">
            <div style="flex: 1;">
              <DropdownCombo placeholder="値を入力もしくは選択"
                v-model="argument1stTranslated">
                <el-option v-for="(element, index) in optionsLabelValue" :key="index" :label="element.label" :value="element.value" />
              </DropdownCombo>
            </div>
            <div style="flex: initial;">を</div>
          </div>
          <div style="display: flex; flex-direction: row;">
            <DropdownCombo placeholder="CSVの桁表記を入力"
              v-model.trim="argument2ndTranslated">
              <el-option label="エラー出力" value="$error"/>
            </DropdownCombo>
            に出力
          </div>
        </template>
      </div>
      <div class="Logic-block-behavior">
        <!-- 成功もしくは条件を満たした場合の動作を選択 -->
        上記が成立した場合: <el-select v-model="trueBehavior">
          <el-option label="次のブロックへ" :value="1"/>
          <el-option v-for="number in [2,3,4,5,6,7,8,9]" :key="number" :label="number + 'つ先のブロックへ'" :value="number" />
          <el-option label="10先のブロックへ" :value="10"/>
          <el-option label="ルールの処理を終了" value="Abort"/>
        </el-select>
      </div>
      <div class="Logic-block-behavior" v-if="isFalseBehavior">
        <!-- 不成功もしくは条件を満たさない場合の動作を選択 -->
        上記が成立しなかった場合: <el-select v-model="falseBehavior">
          <el-option label="次のブロックへ" :value="1"/>
          <el-option v-for="number in [2,3,4,5,6,7,8,9]" :key="number" :label="number + 'つ先のブロックへ'" :value="number" />
          <el-option label="10先のブロックへ" :value="10"/>
          <el-option label="ルールの処理を終了" value="Abort"/>
          <el-option label="症例に対する全ての処理を終了" value="Exit"/>
        </el-select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, WritableComputedRef, ComputedRef } from 'vue'
import { LogicBlock, failableBlockTypes, BlockColorByType } from './types'
import { ArrowUpBold, ArrowDownBold, CloseBold } from '@element-plus/icons-vue'
import DropdownCombo from './DropdownCombo.vue'
import { ElMessageBox } from 'element-plus'

const optionsLabelValue = [
  { label: 'ソース1', value: '@1' },
  { label: 'ソース2', value: '@2' },
  { label: 'ソース3', value: '@3' },
  { label: 'ソース4', value: '@4' },
  { label: 'ハッシュ値', value: '$hash' },
  { label: '変数1', value: '$1' },
  { label: '変数2', value: '$2' },
  { label: '変数3', value: '$3' },
  { label: '変数4', value: '$4' },
  { label: '変数5', value: '$5' },
  { label: '変数6', value: '$6' },
  { label: '変数7', value: '$7' },
  { label: '変数8', value: '$8' },
  { label: '変数9', value: '$9' },
  { label: '変数0', value: '$0' }
]

const props = defineProps<{
  index: number,
  block: LogicBlock
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

const argument1st: WritableComputedRef<string> = computed({
  get: () => props.block.arguments[0] || '',
  set: (value) => setArguments(0, value)
})

const argument1stTranslated: WritableComputedRef<string> = computed({
  get: () => {
    const value = props.block.arguments[0] || ''
    const foundIndex = optionsLabelValue.findIndex(item => item.value === value)
    return (foundIndex === -1) ? value : optionsLabelValue[foundIndex].label
  },
  set: (value) => {
    const foundIndex = optionsLabelValue.findIndex(item => item.label === value)
    setArguments(0, foundIndex === -1 ? value : optionsLabelValue[foundIndex].value)
  }
})

const argument2nd: WritableComputedRef<string> = computed({
  get: () => props.block.arguments[1] || '',
  set: (value) => setArguments(1, value)
})

const argument2ndTranslated: WritableComputedRef<string> = computed({
  get: () => {
    const optionsLabelValueForArg2 = [...optionsLabelValue, { label: 'エラー出力', value: '$error' }]
    const value = props.block.arguments[1] || ''
    const foundIndex = optionsLabelValueForArg2.findIndex(item => item.value === value)
    return (foundIndex === -1) ? value : optionsLabelValueForArg2[foundIndex].label
  },
  set: (value) => {
    const optionsLabelValueForArg2 = [...optionsLabelValue, { label: 'エラー出力', value: '$error' }]
    const foundIndex = optionsLabelValueForArg2.findIndex(item => item.label === value)
    setArguments(1, foundIndex === -1 ? value : optionsLabelValueForArg2[foundIndex].value)
  }
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const argument3rd: WritableComputedRef<string> = computed({
  get: () => props.block.arguments[2] || '',
  set: (value) => setArguments(2, value)
})

const argument3rdTranslated: WritableComputedRef<string> = computed({
  get: () => {
    const value = props.block.arguments[2] || ''
    const foundIndex = optionsLabelValue.findIndex(item => item.value === value)
    return (foundIndex === -1) ? value : optionsLabelValue[foundIndex].label
  },
  set: (value) => {
    const foundIndex = optionsLabelValue.findIndex(item => item.label === value)
    setArguments(2, foundIndex === -1 ? value : optionsLabelValue[foundIndex].value)
  }
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
  width: 100%;
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
  width: 1.8rem;
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
}

div.Logic-block-logic {
  display: flexbox;
  margin: 0.5rem 1rem;
}

div.Logic-block-behavior {
  display: flexbox;
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
