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

export type SetDescription = {
  title: string
  filterPath?: string[]
  caseVariableNames?: string[]
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
