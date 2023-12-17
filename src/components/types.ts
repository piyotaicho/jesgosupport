export type JsonObject = number|string|number[]|string[]|object|object[]
export type CsvObject = string[][]
export type ErrorObject = {
  hash: string,
  type?: string,
  errors: string[]
}

export type SourceBlock = {
  path: string,
  subpath?: string
}

export type BlockType = 'Operators'|'Variables'|'Query'|'Translation'|'Sort'|'Period'|'Sets'|'Store'
export const BlockColorByType = {
  Operators: '#59c059',
  Variables: '#ff8c1a',
  Query: '#ffbf00',
  Translation: '#ffab19',
  Sort: '#ffab19',
  Period: '#ffc45e',
  Sets: '#ffee5e',
  Store: '#4c97ff'
}

export type LogicBlock = {
  type: BlockType,
  arguments: string[],
  lookup?: string[][],
  trueBehavior: 'Abort'|number,
  falseBehavior?: 'Exit'|'Abort'|number
}

export const failableBlockTypes = [
  'Operators',
  'Query',
  'Translation',
  'Period'
]

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

export interface processorOutput {
  csv: string[],
  errors?: string[]
}

export interface configObject {
  masterQuery?: string[]
  masterBasePointer?: string
  skipUnmatchedRecord?: boolean
  csvOffset?: number
  errorPointer?: string
  errorTargetSchemaId?: string
}

export type setDescription = {
  title: string
  config: configObject
  caseVariableNames?: string[]
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
