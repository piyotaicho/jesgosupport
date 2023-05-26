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

export type BlockType = 'Operators'|'Variables'|'Query'|'Translation'|'Store'
export const BlockColorByType = {
  Operators: '#59c059',
  Variables: '#ff8c1a',
  Query: '#ffbf00',
  Translation: '#ffab19',
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
  'Translation'
]

export type LogicRule = {
  title: string,
  description ?: string,
  source ?: SourceBlock[],
  procedure ?: LogicBlock[]
}
