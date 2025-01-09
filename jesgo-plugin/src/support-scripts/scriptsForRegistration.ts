// wrbpackを利用したcommonJS moduleでjson-loaderなどを
// 利用すると正常に処理できない問題に対処するラッパーモジュール
import regCC from './2023年子宮頸がん腫瘍登録.json'
import regEM from './2023年子宮体がん腫瘍登録.json'
import regOV from './2023年卵巣がん腫瘍登録.json'
import checkCC from './子宮頸がん登録確認 (2023-2024).json'
import checkEM from './子宮体がん登録確認 (2023-2024).json'
import checkOV from './卵巣がん登録確認 (2023-2024).json'
import checkUS from './子宮肉腫LC.json'
import checkUA from './子宮腺肉腫LC.json'
import checkTD from './絨毛性疾患LC.json'
import checkVUC from './外陰がんLC.json'
import checkVAC from './腟がんLC.json'

// 変換用スクリプト
export const scriptCC = regCC
export const scriptEM = regEM
export const scriptOV = regOV

// 検証用スクリプト
export const scriptCheckCC = checkCC
export const scriptCheckEM = checkEM
export const scriptCheckOV = checkOV
export const scriptCheckUS = checkUS
export const scriptCheckUA = checkUA
export const scriptCheckTD = checkTD
export const scriptCheckVUC = checkVUC
export const scriptCheckVAC = checkVAC
