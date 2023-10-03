//
// JESGOの各種情報をJOEDの内容にマップする
//
import { formatJESGOdaicho } from './types'

// JOED5ドキュメント構造定義
export interface formatJOEDdiagnosis {
  Text: string
  Chain?: string[]
  Description?: string[]
  UserTyped?: boolean
}

export interface formatJOEDprocedure {
  Text: string
  Chain?: string[]
  Description?: string[]
  UserTyped?: boolean
}

type JOEDAEcategory = '出血'|'術中手術操作'|'気腹・潅流操作'|'機器の不具合・破損'|'機器の誤操作'|'術中使用した薬剤'|'体腔内遺残'|'術後'
type JOEDAEgrade = '1'|'2'|'3a'|'3b'|'4'|'5'
export interface formatJOEDAE {
  Category: JOEDAEcategory
  Title?: string[]
  Cause?: string[]
  Location?: string[]
  BloodCount?: string
  Grade: JOEDAEgrade
  Course: string[]
}

export interface formatJOED {
  Name?: string
  PatientId: string
  Age?: number
  DateOfProcedure: string
  TypeOfProcedure: string
  ProcedureTime: string
  Diagnoses: formatJOEDdiagnosis[]
  Procedures: formatJOEDprocedure[]
  PresentAE: boolean
  AEs?: formatJOEDAE[]
  Imported?: boolean
  Notification?: string
}

// JESGOの手術情報をJOED5にマッピング
type translationHandler = {
  (inputValue: string[]): string[]
}
interface translationObject {
  Text: string
  Chain?: string[]
  Description?: string[]
  UserTyped?: boolean
  attachedTo?: string
  preexisthandler?: translationHandler
}
interface translationTable {
  [propName: string]: translationObject
}

// JESGOからJOEDへの術式変換ルール
const operationTranslation: translationTable = {
  // 腹腔鏡手術
  // 子宮摘出
  '腹腔鏡下単純子宮全摘出術(筋膜内)': { Text: '子宮全摘出術(TLH,LH)', Chain: ['腹腔鏡悪性'] },
  '腹腔鏡下単純子宮全摘出術(筋膜外)': { Text: '腹腔鏡下単純子宮全摘出術', Chain: ['腹腔鏡悪性'] },
  腹腔鏡下準広汎子宮全摘出術: { Text: '腹腔鏡下準広汎子宮全摘出術', Chain: ['腹腔鏡悪性'] },
  腹腔鏡下広汎子宮全摘出術: { Text: '腹腔鏡下広汎子宮全摘出術', Chain: ['腹腔鏡悪性'] },
  腹腔鏡下子宮頸部摘出術: { Text: '腹腔鏡下子宮頸部摘出術', Chain: ['腹腔鏡悪性'] },
  婦人科以外の悪性疾患による子宮全摘出術: {
    Text: '他の悪性疾患の予防的切除術',
    Chain: ['腹腔鏡悪性'],
    Description: ['予防的子宮全摘出術']
  },
  // 付属器摘出
  腹腔鏡下右付属器摘出術: { Text: '腹腔鏡下付属器摘出術', Chain: ['腹腔鏡悪性'], Description: ['[大網切除・生検]なし'] },
  腹腔鏡下左付属器摘出術: { Text: '腹腔鏡下付属器摘出術', Chain: ['腹腔鏡悪性'], Description: ['[大網切除・生検]なし'] },
  腹腔鏡下両付属器摘出術: { Text: '腹腔鏡下付属器摘出術', Chain: ['腹腔鏡悪性'], Description: ['[大網切除・生検]なし'] },
  '腹腔鏡下病変生検・審査腹腔鏡': {
    Text: '腹腔鏡下病変生検・審査腹腔鏡',
    Chain: ['腹腔鏡悪性'],
    Description: ['[生検]あり']
  },
  '治療のために開腹手術へ移行(合併症を除く)': { Text: '治療のために開腹手術へ移行(合併症を除く)', Chain: ['腹腔鏡悪性'] },
  リスク低減のための内性器摘出術: {
    Text: 'リスク低減のための内性器摘出術',
    Chain: ['腹腔鏡悪性'],
    Description: ['予防的卵管摘出術', '予防的卵巣摘出術']
  },
  妊孕性温存のための付属器摘出術: { Text: '妊孕性温存のための付属器摘出術', Chain: ['腹腔鏡悪性'] },
  他の悪性疾患の予防的切除術: {
    Text: '他の悪性疾患の予防的切除術',
    Chain: ['腹腔鏡悪性'],
    Description: ['予防的卵管摘出術', '予防的卵巣摘出術']
  },
  転移性卵巣癌による付属器摘出術: { Text: '転移性卵巣癌による付属器摘出術', Chain: ['腹腔鏡悪性'] },
  // リンパ節摘出
  腹腔鏡下センチネルリンパ節生検: {
    Text: '腹腔鏡下リンパ節生検・郭清',
    Chain: ['腹腔鏡悪性'],
    Description: ['なし(センチネル生検あり)'],
    preexisthandler: (preexistedvalue: string[]) => preexistedvalue || ['なし(センチネル生検あり)']
  },
  腹腔鏡下骨盤内リンパ節郭清: {
    Text: '腹腔鏡下リンパ節生検・郭清',
    Chain: ['腹腔鏡悪性'],
    Description: ['PLN'],
    preexisthandler: (preexistedvalue: string[]) => {
      switch (preexistedvalue[0]) {
        case 'PAN':
          return ['PLN+PAN']
        case 'PLN+PAN':
          return preexistedvalue
        default:
          return ['PLN']
      }
    }
  },
  腹腔鏡下傍大動脈リンパ節郭清: {
    Text: '腹腔鏡下リンパ節生検・郭清',
    Chain: ['腹腔鏡悪性'],
    Description: ['PAN'],
    preexisthandler: (preexistedvalue: string[]) => {
      switch (preexistedvalue[0]) {
        case 'PLN':
        case 'PLN+PAN':
          return ['PLN+PAN']
        default:
          return ['PAN']
      }
    }
  },
  // 大網摘出
  腹腔鏡下に大網生検: {
    Text: '腹腔鏡下病変生検・審査腹腔鏡',
    Chain: ['腹腔鏡悪性'],
    Description: ['[生検]あり']
  },
  腹腔鏡下に大網部分切除: {
    Text: '大網部分切除',
    UserTyped: true,
    Chain: ['腹腔鏡悪性'],
    attachedTo: '腹腔鏡下付属器摘出術',
    Description: ['[大網切除・生検]あり']
  },
  腹腔鏡下に大網亜全摘: {
    Text: '大網亜全摘',
    UserTyped: true,
    Chain: ['腹腔鏡悪性'],
    attachedTo: '腹腔鏡下付属器摘出術',
    Description: ['[大網切除・生検]あり']
  },
  腹腔鏡下に再発病巣の摘出術: { Text: '再発病巣の摘出術', Chain: ['腹腔鏡悪性'] },
  腹腔鏡下に他の診療科との合同手術: { Text: '他の診療科との合同手術', Chain: ['腹腔鏡悪性'] },
  腹腔鏡下に術後合併症の修復術: {
    Text: '術後合併症の修復術', Chain: ['腹腔鏡悪性']
  },

  // ロボット

  // 子宮摘出
  ロボット支援下単純子宮全摘出術: { Text: 'ロボット支援下単純子宮全摘出術', Chain: ['ロボット悪性'] },
  ロボット支援下準広汎子宮全摘出術: { Text: 'ロボット支援下準広汎子宮全摘出術', Chain: ['ロボット悪性'] },
  ロボット支援下広汎子宮全摘出術: { Text: 'ロボット支援下広汎子宮全摘出術', Chain: ['ロボット悪性'] },
  ロボット支援下子宮頸部摘出術: { Text: 'ロボット支援下子宮頸部摘出術', Chain: ['ロボット悪性'] },
  婦人科以外の悪性疾患によるロボット支援下子宮全摘出術: { Text: '婦人科以外の悪性疾患によるロボット支援下子宮全摘出術', Chain: ['ロボット悪性'] },
  // リンパ節摘出
  ロボット支援下センチネルリンパ節生検: {
    Text: 'ロボット支援下リンパ節生検・郭清',
    Chain: ['ロボット悪性'],
    Description: ['なし(センチネル生検あり)'],
    preexisthandler: (preexistedvalue: string[]) => preexistedvalue || ['なし(センチネル生検あり)']
  },
  ロボット支援下骨盤内リンパ節郭清: {
    Text: 'ロボット支援下リンパ節生検・郭清',
    Chain: ['ロボット悪性'],
    Description: ['PLN'],
    preexisthandler: (preexistedvalue: string[]) => {
      switch (preexistedvalue[0]) {
        case 'PAN':
          return ['PLN+PAN']
        case 'PLN+PAN':
          return preexistedvalue
        default:
          return ['PLN']
      }
    }
  },
  ロボット支援下傍大動脈リンパ節郭清: {
    Text: 'ロボット支援下リンパ節生検・郭清',
    Chain: ['ロボット悪性'],
    Description: ['PAN'],
    preexisthandler: (preexistedvalue: string[]) => {
      switch (preexistedvalue[0]) {
        case 'PLN':
        case 'PLN+PAN':
          return ['PLN+PAN']
        default:
          return ['PAN']
      }
    }
  },
  ロボット支援下に術後合併症の修復術: { Text: '術後合併症の修復術', Chain: ['ロボット悪性'] }
}
// JESGOの置換対象術式のアレイ = operationTranslationのkey
const operationTitlesToExtract = Object.keys(operationTranslation)

/**
 * JESGO患者台帳からJOED5形式のデータを作成する
 * @param patientId string 患者ID
 * @param patientName string 患者名
 * @param patientDOB string 患者誕生日
 * @param JESGOdaicho JESGO台帳
 */
export function convertDaichoToJOED (
  patientId: string|undefined,
  patientName: string|undefined,
  patientDOB: string|undefined,
  JESGOdaicho: formatJESGOdaicho): formatJOED[]|undefined {
  const returnValues = []
  const diagnosis:formatJOEDdiagnosis = { Text: '' }
  const caseNotification: string[] = []

  if (!patientId) {
    // 患者IDは必須
    throw new Error('患者IDは必須項目です.')
  }

  // 台帳のparse
  const dateOfStartTreatment = JESGOdaicho?.初回治療開始日
  if (!JESGOdaicho?.初回治療?.手術療法) {
    // 手術療法がないだけならなにもしない
    return undefined
  }

  // 診断の設定
  switch (JESGOdaicho?.がん種) {
    case '子宮頸がん':
      diagnosis.Text = '子宮頸癌'
      break
    case '子宮体がん':
      diagnosis.Text = '子宮体癌'
      break
    case '卵巣がん':
      // JESGOの卵巣がんには境界悪性腫瘍が含まれるが、それは組織型を参照しないとわからない
      if (JESGOdaicho?.組織診断 && JESGOdaicho.組織診断?.組織型) {
        if (JESGOdaicho.組織診断.組織型.includes('境界悪性腫瘍')) {
          diagnosis.Text = '境界悪性卵巣腫瘍'
        } else {
          diagnosis.Text = '卵巣癌(卵管癌,腹膜癌含む)'
        }
      } else {
        diagnosis.Text = '卵巣癌(卵管癌,腹膜癌含む)'
        diagnosis.UserTyped = true
        caseNotification.push('組織診断が未入力のため境界悪性の判断ができませんでした.')
      }

      break
    default:
      // 翻訳対象外のがん種
      diagnosis.Text = JESGOdaicho?.がん種
      diagnosis.UserTyped = true
      caseNotification.push('診断名の自動判別の対象外です.')
  }
  diagnosis.Chain = ['腹腔鏡悪性']

  // 手術療法の抽出
  for (const operation of JESGOdaicho.初回治療.手術療法) {
    if (!operation.実施手術 || operation.実施手術.length === 0) {
      break
    }

    const JOEDrecord:formatJOED = {
      PatientId: patientId.toString(),
      DateOfProcedure: '',
      TypeOfProcedure: '',
      ProcedureTime: '',
      Diagnoses: [diagnosis],
      Procedures: [],
      PresentAE: false
    }
    const recordNotification:string[] = []

    // 診断を設定
    // 手術日が設定されていたら手術日から、そうでなければ初回治療開始日から年齢を計算
    const dateOfOperation = operation?.手術日 ? operation.手術日 : dateOfStartTreatment
    if (dateOfOperation === '' || dateOfOperation === undefined) {
      // 手術日は必須項目
      throw new Error('手術日(初回治療開始日)は必須項目です.')
    }
    JOEDrecord.DateOfProcedure = dateOfOperation

    // 年齢は患者の生年月日と手術日から計算
    if (patientDOB) {
      const age = dateCalc(patientDOB, dateOfOperation)
      if (age) {
        JOEDrecord.Age = Number(age)
      }
    }

    // 手術時間を抽出
    if (operation.手術時間) {
      JOEDrecord.ProcedureTime = encodeProcedureTime(Number(operation.手術時間))
    }

    // 手術術式を抽出して鏡視下手術を抽出
    const operationRecords = []
    const otherOperationRecords = []
    let isRobotOperation = false

    // 実施数の登録が無ければスキップ
    if (!operation?.実施手術 || !Array.isArray(operation.実施手術) || operation.実施手術.length === 0) {
      break
    }

    const operationTitles = operation.実施手術.map(item => item.術式)
    for (const operationTitle of operationTitles) {
      if (operationTitlesToExtract.includes(operationTitle)) {
        operationRecords.push(operationTranslation[operationTitle])
        // ロボットフラグの設定
        if (operationTitle.includes('ロボット支援下')) {
          isRobotOperation = true
        }
        // 無いとは思うが他の悪性腫瘍への手術が入っていたときに診断名を変更する
        if (operationTitle.includes('婦人科以外の悪性疾患')) {
          diagnosis.Text = '婦人科以外の悪性腫瘍'
          diagnosis.UserTyped = false
          recordNotification.push(`実施手術の内容から診断名を'${diagnosis.Text}'から自動修正しました.`)
        }
      } else {
        // 開腹手術へ移行した場合などの分は自由入力として対応
        otherOperationRecords.push({
          Text: operationTitle,
          UserTyped: true
        })
      }
    }

    // 鏡視下手術が無い場合は変換をスキップ
    if (operationRecords.length === 0) {
      break
    }

    // 手術情報を重複を処理して集約
    for (const currentIndex of Object.keys(operationRecords).map(element => Number(element)).reverse()) {
      if (currentIndex > 0) {
        const operation = operationRecords[currentIndex]
        let needsplice = false
        for (let index = 0; index < currentIndex; index++) {
          // 重複の処理
          if (operationRecords[index].Text === operation.Text || (operation?.attachedTo && operationRecords[index].Text === operation.attachedTo)) {
            if (operation?.preexisthandler) {
              operationRecords[index].Description = operation.preexisthandler(operationRecords[index].Description || [])
            } else {
              operationRecords[index].Description = operation.Description
            }
            needsplice = true
          }
        }
        if (needsplice) {
          // 重複内容を消去
          operationRecords.splice(currentIndex, 1)
        } else {
          // 余計な情報を削除
          if (operation?.attachedTo) {
            delete operationRecords[currentIndex].attachedTo
          }
          if (operation?.preexisthandler) {
            delete operationRecords[currentIndex].preexisthandler
          }
        }
      }
    }
    operationRecords.push(...otherOperationRecords)

    JOEDrecord.TypeOfProcedure = isRobotOperation ? 'ロボット悪性' : '腹腔鏡悪性'
    JOEDrecord.Procedures = operationRecords as formatJOEDprocedure[]

    // 合併症の抽出
    const adverseEvents = []
    if (operation?.手術合併症) {
      for (const event of operation.手術合併症) {
        const JOEDAE:formatJOEDAE = {
          Category: event.合併症の種別,
          Grade: (event.Grade.substring(6, event.Grade.indexOf(':'))) as '1'|'2'|'3a'|'3b'|'4'|'5',
          Course: event.転帰
        }

        switch (JOEDAE.Category) {
          case '出血':
            if (event?.出血量) {
              if (event.出血量 === '不明') {
                JOEDAE.BloodCount = '不明'
              } else {
                if (Number(event.出血量) >= 500) {
                  JOEDAE.BloodCount = event.出血量.toString()
                } else {
                  // 出血量 500未満なので合併症として処理しない.
                  continue
                }
              }
            } else {
              // 合併症に出血量の入力が無い場合手術情報から出血量をチェック
              if (operation.出血量) {
                if (operation.出血量 === '不明') {
                  JOEDAE.BloodCount = '不明'
                } else {
                  if (Number(operation.出血量) >= 500) {
                    JOEDAE.BloodCount = operation.出血量.toString()
                  } else {
                    // 出血量 500未満なので合併症として処理しない.
                    continue
                  }
                }
              } else {
                JOEDAE.BloodCount = '不明'
                recordNotification.push('合併症に出血が入力されていますが出血量の入力がありません.')
              }
            }
            break
          case '術後':
            if (event.合併症の内容) {
              JOEDAE.Title = event.合併症の内容
            }
            break
          default:
            if (event.発生した合併症) {
              JOEDAE.Title = event.発生した合併症
              // 気腹・潅流操作のSchema 1.0 と JOED2022 マスタ更新に伴う変更を吸収する
              // 検索対象
              const searchString = ['皮下気腫', 'そのほか心臓障害', 'そのほか呼吸器障害', 'そのほか神経系障害']
              // 置換先
              const replaceTo = ['気腫', 'その他 循環器系障害', 'その他 呼吸器系障害', 'その他 神経系障害']
              JOEDAE.Title.forEach((value, index, original) => {
                const foundIndex = searchString.indexOf(value)
                if (foundIndex >= 0) {
                  original[index] = replaceTo[foundIndex]
                  console.log(`Replace Title: ${value} to ${replaceTo[foundIndex]}`)
                }
              })
            }
            if (event.遺残したもの) {
              JOEDAE.Title = event.遺残したもの
            }
            if (event.関連する機器) {
              JOEDAE.Cause = event.関連する機器
            }
            if (event.関連する薬剤) {
              JOEDAE.Cause = event.関連する薬剤
            }
            if (event.発生部位) {
              JOEDAE.Location = event.発生部位
            }
            break
        }
        adverseEvents.push(JOEDAE)
      }
    }

    JOEDrecord.PresentAE = adverseEvents.length > 0
    if (JOEDrecord.PresentAE) {
      JOEDrecord.AEs = adverseEvents as formatJOEDAE[]
    }

    // 最終的なレコードの成形
    if (patientName && patientName !== '') {
      JOEDrecord.Name = patientName
    }
    if (caseNotification.length > 0) {
      JOEDrecord.Notification = caseNotification.join('\n')
    }
    if (recordNotification.length > 0) {
      JOEDrecord.Notification = (JOEDrecord?.Notification || '') +
        recordNotification.join('\n')
    }

    returnValues.push(JOEDrecord)
  }
  return returnValues
}

function dateCalc (base: string, date: string): string|undefined {
  // 日付フォーマット
  const dateRegexp = /(?<year>\d{4})[-/](?<month>0?[1-9]|1[0-2])[-/](?<date>0?[1-9]|[12][0-9]|3[01])/

  // 基準日
  const baseMatch = base.match(dateRegexp)
  if (baseMatch === null) {
    throw new Error('基準日の書式に問題があります.')
  }
  const baseDate = new Date(
    Number(baseMatch.groups?.year || '1970'),
    Number(baseMatch.groups?.month || '1') - 1,
    Number(baseMatch.groups?.date || '1')
  )

  // 対象
  const dateMatch = date.match(dateRegexp)
  if (dateMatch === null) {
    throw new Error('日付の書式に問題があります.')
  }
  const targetDate = new Date(
    Number(dateMatch.groups?.year || '1970'),
    Number(dateMatch.groups?.month || '1') - 1,
    Number(dateMatch.groups?.date || '1')
  )

  const age = targetDate.getFullYear() - baseDate.getFullYear()

  return age.toString()
}

/**
 * JOED5の手術時間様式文字列に置換する (-1.3)
 * @param minutes 手術時間(分)
 * @returns string
 */
function encodeProcedureTime (minutes = 0) {
  const breaks = [
    30, 60, 90, 120, 150, 180, 210,
    240, 270, 300, 330, 360, 420,
    450, 480, 540, 600, 660, 720
  ]

  if (minutes < breaks[0]) return breaks[0] + '分未満'
  for (let i = 0; i < breaks.length - 1; i++) {
    if (minutes >= breaks[i] && minutes < breaks[i + 1]) return breaks[i] + '分以上 － ' + breaks[i + 1] + '分未満'
  }

  return breaks[breaks.length - 1] + '分以上'
}