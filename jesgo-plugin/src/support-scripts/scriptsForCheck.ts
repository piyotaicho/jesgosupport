// wrbpackを利用したcommonJS moduleでjson-loaderなどを
// 利用すると正常に処理できない問題に対処するラッパーモジュール
import checkCC from './子宮頸がん登録確認(2023-2025).json'
import checkEM from './子宮体がん登録確認 (2023-2024).json'
import checkOV from './卵巣がん登録確認(2023-2025).json'
import checkUS from './子宮肉腫LC.json'
import checkUA from './子宮腺肉腫LC.json'
import checkTD from './絨毛性疾患LC.json'
import checkVUC from './外陰がんLC.json'
import checkVAC from './腟がんLC.json'

// 検証用スクリプト
export const scriptCheckCC = checkCC
export const scriptCheckEM = checkEM
export const scriptCheckOV = checkOV
export const scriptCheckUS = checkUS
export const scriptCheckUA = checkUA
export const scriptCheckTD = checkTD
export const scriptCheckVUC = checkVUC
export const scriptCheckVAC = checkVAC
