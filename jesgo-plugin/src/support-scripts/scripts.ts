// wrbpackを利用したcommonJS moduleでjson-loaderなどを
// 利用すると正常に処理できない問題に対処するラッパーモジュール
import sampleScript from './sample-script.json'
import scriptGOEM2022 from './SCRIPT-GOEM_2022.json'

export const sample = sampleScript
export const scriptEM = scriptGOEM2022
