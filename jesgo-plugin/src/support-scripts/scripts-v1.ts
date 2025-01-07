// wrbpackを利用したcommonJS moduleでjson-loaderなどを
// 利用すると正常に処理できない問題に対処するラッパーモジュール
import regGOCC from './2023年子宮頸がん腫瘍登録.json'
import regGOEM from './2023年子宮体がん腫瘍登録.json'
import regGOOV from './2023年卵巣がん腫瘍登録.json'
import checkGOCC from './子宮頸がん登録確認 (2023-2024).json'
import checkGOEM from './子宮体がん登録確認 (2023-2024).json'
import checkGOOV from './卵巣がん登録確認 (2023-2024).json'

export const scriptCC = regGOCC
export const scriptEM = regGOEM
export const scriptOV = regGOOV

export const checkCC = checkGOCC
export const checkEM = checkGOEM
export const checkOV = checkGOOV
