// wrbpackを利用したcommonJS moduleでjson-loaderなどを
// 利用すると正常に処理できない問題に対処するラッパーモジュール
import checkCC2023 from './GOCC_2023-2024_check.json'
import checkEM2023 from './GOEM_2023-2024_check.json'
import checkOV2023 from './GOOV_2023-2024_check.json'

import exportCC2023 from './GOCC_2023_export.json'
import exportEM2023 from './GOEM_2023_export.json'
import exportOV2023 from './GOOV_2023_export.json'

export const scriptCheckCC2023 = checkCC2023
export const scriptCheckEM2023 = checkEM2023
export const scriptCheckOV2023 = checkOV2023
export const scriptExportCC2023 = exportCC2023
export const scriptExportEM2023 = exportEM2023
export const scriptExportOV2023 = exportOV2023
