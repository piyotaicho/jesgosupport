/* eslint-disable camelcase */
export interface scriptInfo {
  plugin_name: string
  plugin_version: string
  all_patient: boolean
  attach_patient_info: boolean
  update_db: boolean
  show_upload_dialog: boolean
  filter_schema_query?: string
  target_schema_id?: number
  target_schema_id_string?: string
  explain?:string
}

export interface caseList {
  case_id: number
  date_of_birth?: string
  date_of_death?: string
  decline?: boolean
  deleted?: boolean
  his_id?: string
  is_new_case?: boolean
  last_updated?: string
  name?: string
  registrant?: number
  sex?: 'F'|'M'
}

export interface getterPluginArgument {
  caseList: caseList[]
  targetDocument?: number
  schema_id?: number[]
  filterQuery?: null|undefined|string
}

export interface pulledDocument {
  decline: boolean
  documentList: object[]
  hash: string
  date_of_birth?: string
  his_id?: string
  name?: string
}

export interface setterPluginArgument {
  case_id: number
  document_id: number
  schema_id: string
  document: object
}

interface updateDocumentByHash {
  hash: string
  case_id?: number
  case_no?: string
  document_id?: number
  target: object
}

interface updateDocumentByCaseId {
  hash?: string
  case_id: number
  case_no?: string
  document_id?: number
  target: object
}

interface updateDocumentByCaseNo {
  hash?: string
  case_id?: number
  case_no: string
  document_id?: number
  target: object
}

export type updateDocument = updateDocumentByHash | updateDocumentByCaseId | updateDocumentByCaseNo

export type mainOutput = undefined|string|string[]|object|object[]
