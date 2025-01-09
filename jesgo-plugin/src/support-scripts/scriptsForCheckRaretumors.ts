// wrbpackを利用したcommonJS moduleでjson-loaderなどを
// 利用すると正常に処理できない問題に対処するラッパーモジュール
import checkUS from './子宮肉腫LC.json'
import checkUA from './子宮腺肉腫LC.json'
import checkTD from './絨毛性疾患LC.json'
import checkVUC from './外陰がんLC.json'
import checkVAC from './腟がんLC.json'

// 検証用スクリプト
export const scriptCheckUS = checkUS
export const scriptCheckUA = checkUA
export const scriptCheckTD = checkTD
export const scriptCheckVUC = checkVUC
export const scriptCheckVAC = checkVAC
