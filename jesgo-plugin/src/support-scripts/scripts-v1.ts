// wrbpackを利用したcommonJS moduleでjson-loaderなどを
// 利用すると正常に処理できない問題に対処するラッパーモジュール
import regGOCC from './GOCC-2023-registration.json'
import regGOEM from './GOEM-2023-registration.json'
import regGOOV from './GOOV-2023-registration.json'
import checkGOCC from './GOCC-2023-2024-check.json'
import checkGOEM from './GOEM-2023-2024-check.json'
import checkGOOV from './GOOV-2023-2024-check.json'

export const scriptCC = regGOCC
export const scriptEM = regGOEM
export const scriptOV = regGOOV

export const checkCC = checkGOCC
export const checkEM = checkGOEM
export const checkOV = checkGOOV
