import { configObject } from './types'

// プリセットの一覧

interface presetObject extends configObject {
  title: string
}

export const configulationPresets:presetObject[] = [
  // 子宮頸がん CC
  {
    title: '子宮頸がん',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "子宮頸がん")]'
    ],
    masterBasePointer: '/患者台帳/-',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    csvUnicode: false,
    errorTargetSchemaId: '/schema/CC/root',
    errorPointer: '/jesgo:error'
  },
  // 子宮体がん EM
  {
    title: '子宮体がん',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "子宮体がん")]'
    ],
    masterBasePointer: '/患者台帳/-',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    csvUnicode: false,
    errorTargetSchemaId: '/schema/EM/root',
    errorPointer: '/jesgo:error'
  },
  // 卵巣がん OV
  {
    title: '卵巣がん',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "卵巣がん")]'
    ],
    masterBasePointer: '/患者台帳/-',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    csvUnicode: false,
    errorTargetSchemaId: '/schema/OV/root',
    errorPointer: '/jesgo:error'
  },
  // 子宮肉腫 US
  {
    title: '子宮肉腫',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "子宮肉腫")]'
    ],
    masterBasePointer: '/患者台帳/-',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    csvUnicode: false,
    errorTargetSchemaId: '/schema/US/root',
    errorPointer: '/jesgo:error'
  },
  // 子宮腺肉腫 UA
  {
    title: '子宮腺肉腫',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "子宮腺肉腫")]'
    ],
    masterBasePointer: '/患者台帳/-',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    csvUnicode: false,
    errorTargetSchemaId: '/schema/UA/root',
    errorPointer: '/jesgo:error'
  },
  // 絨毛性疾患 TD
  {
    title: '絨毛性疾患',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "絨毛性疾患")]'
    ],
    masterBasePointer: '/患者台帳/-',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    csvUnicode: false,
    errorTargetSchemaId: '/schema/TD/root',
    errorPointer: '/jesgo:error'
  },
  // 腟がん VAC
  {
    title: '腟がん',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "腟がん")]'
    ],
    masterBasePointer: '/患者台帳/-',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    csvUnicode: false,
    errorTargetSchemaId: '/schema/VAC/root',
    errorPointer: '/jesgo:error'
  },
  // 外陰がん VUC
  {
    title: '外陰がん',
    masterQuery: [
      '$..患者台帳',
      '$.[?(@.がん種 == "外陰がん")]'
    ],
    masterBasePointer: '/患者台帳/-',
    skipUnmatchedRecord: true,
    csvOffset: 6,
    csvUnicode: false,
    errorTargetSchemaId: '/schema/VUC/root',
    errorPointer: '/jesgo:error'
  }
]
