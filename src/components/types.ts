export type JsonObject = number|string|number[]|string[]|object|object[]
export type CsvObject = string[][]

export type SourceBlock = {
  path: string,
  subpath?: string
}

export type BlockType = 'Operators'|'Variables'|'Translation'|'Store'
export type LogicBlock = {
  type: BlockType,
  arguments: string[],
  lookup?: string[][],
  trueBehaivior: 'Abort'|number,
  falseBehaivior?: 'Exit'|'Abort'|number
}

export type LogicRule = {
  title: string,
  description ?: string,
  source ?: SourceBlock[],
  procedure ?: LogicBlock[]
}
