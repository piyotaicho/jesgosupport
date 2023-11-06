export type JsonObject = number|string|number[]|string[]|object|object[]
export type CsvObject = string[][]
export type ErrorObject = {
  hash: string
  his_id?: string
  type?: string
  errors: string[]
}

export type ScriptHeader = {
  title?: string
  processorVersion?: string
  csvOffset?: number
  description?: string
}

export type SourceBlock = {
  path: string|string[]
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

export type StepExpiression = 'Exit'|'Abort'|number

export type LogicBlock = {
  type: BlockType,
  arguments: string[]
  trueBehavior: StepExpiression
  falseBehavior?: StepExpiression
}

export type LogicResult = {
  success: boolean
  step: StepExpiression
}

export const failableBlockTypes = [
  'Operators',
  'Query',
  'Translation',
  'Period'
]

export type LogicRule = {
  title: string,
  description ?: string,
  source ?: SourceBlock[],
  procedure ?: LogicBlock[]
}
