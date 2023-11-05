/* eslint-disable camelcase */
// プラグイン関連interface
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

// 取得系でシステムから提供される情報
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
  // 以下は特殊用途(取得系からのcaseList生成)
  document_id?: number
}

// 取得系APIリクエスト
export interface getterPluginArgument {
  caseList: caseList[]
  targetDocument?: number
  schema_id?: number[]
  filterQuery?: null|undefined|string
}

// 取得系APIレスポンス
export interface pulledDocument {
  decline: boolean
  documentList: object[]
  hash: string
  date_of_birth?: string
  his_id?: string
  name?: string
}

// 更新系でシステムから提供される情報
export interface setterPluginArgument {
  case_id: number
  document_id: number
  schema_id: string
  document: object
}

// 更新系APIリクエスト
export interface updateGetRequest {
  caseList: caseList[]
  targetDocument: number
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

interface updateDocumentByDocumentId {
  hash?: string
  case_id?: number
  case_no?: string
  document_id: number
  target: object
}

export type updateDocument = updateDocumentByHash | updateDocumentByCaseId | updateDocumentByCaseNo | updateDocumentByDocumentId | updateGetRequest

// プラグイン main() の出力（取得系のみ有効）
export type mainOutput = undefined|string|string[]|object|object[]

//
// JESGOドキュメント構造の抜粋interface
//
export interface formatJESGOoperation {
  術式: string
}

type JESGOAEcategory = '出血'|'術中手術操作'|'気腹・潅流操作'|'機器の不具合・破損'|'機器の誤操作'|'術中使用した薬剤'|'体腔内遺残'|'術後'
type JESGOAEgrade = 'Grade 1: 正常な術後経過からの逸脱'|'Grade 2: 中等症 輸血および中心静脈栄養を要する場合を含む'|'Grade 3a: 全身麻酔を要さない治療介入を要する'|'Grade 3b: 全身麻酔下での治療介入を要する'|'Grade 4: ICU管理を要する、合併症により生命を脅かす状態'|'Grade 5: 死亡'
export interface formatJESGOoperationAEs {
  // Mapped to .Category
  合併症の種別: JESGOAEcategory
  // Mapped to .BloodCount
  出血量?: string|number
  // Mapped to .Title
  発生した合併症?: string[]
  // Mapped to .Cause
  関連する機器?: string[]
  // Mapped to .Cause
  関連する薬剤?: string[]
  // Mapped to .Title
  遺残したもの?: string[]
  // Mapped to .Location
  発生部位?: string[]
  // Mapped to .Title
  合併症の内容?: string[]
  // Mapped to .Grade
  Grade: JESGOAEgrade
  // Mapped to .Course
  転帰: string[]
}

export interface formatJESGOOperationSection {
  手術日: string,
  手術時間?: string|number
  出血量?: string|number
  合併症の有無?: string
  実施手術?: formatJESGOoperation[]
  手術合併症?: formatJESGOoperationAEs[]
}

export interface formatJESGOtreatmentSection {
  手術療法?: formatJESGOOperationSection[]
  化学療法?: never
  放射線療法?: never
}

export interface formatJESGOdaicho {
  がん種: string,
  初回治療開始日: string,
  初回治療: formatJESGOtreatmentSection,
  組織診断?: {
    組織型?: string
  },
  診断所見?: {
    子宮鏡?: {
      検査実施日?: string
    }
  }
}

export interface formatJESGOrelapse {
  再発したがん種: string,
  再発治療: {
    手術療法?: formatJESGOOperationSection[]
  }
}

export interface formatJESGOdocument {
  患者台帳?: formatJESGOdaicho|formatJESGOdaicho[],
  再発?: formatJESGOrelapse|formatJESGOrelapse[]
}
