// wrbpackを利用したcommonJS moduleでjson-loaderなどを
// 利用すると正常に処理できない問題に対処するラッパーモジュール
import scriptGOCC from './GOCC-2023-registration.json'
import scriptGOEM from './GOEM-2023-registration.json'
import scriptGOOV from './GOOV-2023-registragion.json'
import checkGOCC from './GOCC-2023-2024-check.json'
import checkGOEM from './GOEM-2023-2024-check.json'
import checkGOOV from './GOOV-2023-2024-check.json'

export const scriptCC = scriptGOCC
export const scriptEM = scriptGOEM
export const scriptOV = scriptGOOV

export const checkCC = checkGOCC
export const checkEM = checkGOEM
export const checkOV = checkGOOV
