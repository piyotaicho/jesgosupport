export type JsonObject = number|string|number[]|string[]|object|object[]
export type CsvObject = string[][]

// エラー出力（ドキュメントへの書き戻し内容）
export type ErrorObject = {
  hash: string,
  type?: string,
  errors: string[]
}

// データーソースの指定内容 pathにJSONパスを利用する場合、サブパスでのクエリ指定も可能
export type SourceBlock = {
  path: string,
  subpath?: string
}

// 変数の予約語とその説明
export const ReservedVariableNames = ['$hash', '$his_id', '$name', '$date_of_birth', '$error', '$now', '$highlight'] as const
export const ConstantVariableNames = ['$hash', '$his_id', '$name', '$date_of_birth', '$now'] as const
export type ReservedVariableNames = '$hash'|'$his_id'|'$name'|'$date_of_birth'|'$error'|'$now'|'$highlight'
export const ReservedVariableNameLabel: Record<ReservedVariableNames, string> = {
  $hash: 'ハッシュ値',
  $his_id: 'カルテ番号',
  $name: '患者名',
  $date_of_birth: '生年月日',
  $error: 'エラー出力',
  $now: '今日の日付',
  $highlight: '強調表示のパスを引用',
}

export const BlockTypes = ['Operators', 'Variables', 'Query', 'Translation', 'Sort', 'Period', 'Sets', 'Store', 'Update'] as const
export type BlockTypes = 'Operators'|'Variables'|'Query'|'Translation'|'Sort'|'Period'|'Sets'|'Store'|'Update'
export const BlockColorByType: Record<BlockTypes, string> = {
  Operators: '#59c059',
  Variables: '#ff8c1a',
  Query: '#ffbf00',
  Translation: '#ffab19',
  Sort: '#ffab19',
  Period: '#ffc45e',
  Sets: '#ffee5e',
  Store: '#4c97ff',
  Update: '#4c97ff'
}

export const LogicBlockWithFailureConfition = [
  'Operators' //,
  // 'Query',
  // 'Translation',
  // 'Period'
]

// ロジックの挙動を設定 Abortはロジックルールセットを終了して次のルールセットへ Exitはレコードの処理を終了して次のレコードへ それ以外の数値はルールセットの+オフセット
type LogicBehavior = 'Abort'|'Exit'|number

export type LogicBlock = {
  type: BlockTypes,
  arguments: [string]|[string, string]|[string, string, string]|[string, string, string, string],
  lookup?: string[][],
  trueBehavior: LogicBehavior,
  falseBehavior?: LogicBehavior
}

export type LogicRuleSet = {
  title: string,
  description ?: string,
  source ?: SourceBlock[],
  procedure ?: LogicBlock[]
}

export type documentFilter = {
  filter: string[],
  assignpath: string
}

export interface pulledDocument {
  decline: boolean
  documentList: object[]
  hash: string
  date_of_birth?: string
  his_id?: string
  name?: string
}

export interface processorOutput {
  csv: string[]
  errors?: string[]
}

export interface configObject {
  masterQuery?: string[]
  masterBasePointer?: string
  skipUnmatchedRecord?: boolean
  documentVariables?: string[]
  csvOffset?: number
  csvUnicode?: boolean
  errorPointer?: string
  errorTargetSchemaId?: string
}

export type setDescription = {
  title: string
  config: configObject
}

// ルールセットファイル形式
// V1形式はオブジェクト
export type fileRuleSetV1 = {
  title: string // 必須
  config?: configObject
  rules: LogicRuleSet[]
  languageMajorVersion?: number // 新エンジンに載せ変わったら>1になる
}
// V0.9未満はルールセットのアレイ
export type fileRuleSetV0 = LogicRuleSet[]

export type fileRuleSet = fileRuleSetV0 | fileRuleSetV1
