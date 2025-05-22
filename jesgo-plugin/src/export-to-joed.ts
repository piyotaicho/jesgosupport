/* eslint-disable eqeqeq */
/* eslint-disable camelcase */
//
// JSGOE用インポートデータ作成プラグイン
//
// piyotaicho/P4mohnet
//
import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument, formatJESGOdocument, formatJESGOdaicho, formatJESGOrelapse } from './types'
import { convertDaichoToJOED, formatJOED } from './jesgo-joed-translator'
import { createElementFromHtml, showModalDialog } from './modal-dialog'
import { dialogHTMLstrings } from './export-to-joed-ui'

const version = '1.1.1'
const credit = 'Copyright 2023-2025 by P4mohnet'
const script_info: scriptInfo = {
  plugin_name: 'JOED5インポートデータの作成',
  plugin_version: `${version.split('.')[0]}.${(Number(version.split('.')[1]) * 100 + Number(version.split('.')[2])).toString().padStart(2,'0')}`,
  all_patient: true,
  attach_patient_info: true,
  update_db: false,
  show_upload_dialog: false,
  explain: '産科婦人科内視鏡学会症例登録で使用するJOED5アプリケーションで読み込み可能なJSONファイルを作成します.'
}

export async function init () {
  return script_info
}

export async function main (docData: getterPluginArgument, apifunc: (docData: getterPluginArgument) => string): Promise<mainOutput> {
  console.info(`export-to-joed.ts@${version} ${credit}\nhttps://github.com/piyotaicho/jesgosupport`)

  if (docData.caseList) {
    const apiresult = await apifunc(docData)
    let documents:pulledDocument[]
    try {
      documents = JSON.parse(apiresult) as pulledDocument[]
    } catch {
      return ('APIの返り値が異常です.')
    }
    return await handler(documents)
  }
  return ('症例情報が取得できませんでした.')
}

export async function finalize () {
  //
}

async function handler (docData: pulledDocument[]) {
  if (docData.length === 0) {
    window.alert('取得できた症例がありません.')
    return undefined
  }

  // ログフラグ(Shift+変換ボタンでコンソールログを出力する)
  let verbose = false

  // modal dialog に要素を配置する
  // これをしておかないと以下の getElementById が null を返すので問題をおこす
  // HTML文字列の $$CREDIT$$ と $$VERSION$$ はcredit, version で置換される
  const createDialogContent = (parent:Element) => parent.appendChild(createElementFromHtml(dialogHTMLstrings.replace('$$VERSION$$', `Version ${version}`).replace('$$CREDIT$$', credit)))

  // メインのデータ変換処理
  const mainProcess = async (yearFilter: string, anonymizeSetting: string):Promise<formatJOED[]> => {
    // 出力するJOED5データ
    const JOEDdocuments:formatJOED[] = []

    // ダイアログ内容の初期化
    const numberOfCases = docData.length
    const statusline1 = document.getElementById('plugin-statusline1')
    if (statusline1) {
      statusline1.innerText = `JESGOから出力された症例数は${numberOfCases}症例です.`
    }

    // ログ
    if (verbose) {
      console.log(`****************`)
      console.log(`JESGO総症例数: ${numberOfCases}`)
      console.log(`出力年次: ${yearFilter}`)
      console.log(`匿名化設定: ${anonymizeSetting}`)
    }

    // プログレスバー用カウンタ
    let count = 0
  
    // 1症例レコードずつparseしてJOED5用に変換
    for (const caseEntry of docData) {
      // ロックアップ回避
      setTimeout(() => {}, 0)

      // ダイアログのプログレスバーを更新
      count++
      const progressbar = document.getElementById('pligin-progressbar')
      if (progressbar) {
        progressbar.style.width = (count * 100 / numberOfCases).toString().substring(0, 5) + '%'
      } else {
        // ダイアログのDOMが消失した = modalがcloseされた と判断して処理を中止する
        console.warn('Plugin-aborted.')
        throw new Error('Plugin-aborted.')
      }

      // JESGO症例情報を取得
      // JOED5で必要なものは 患者id と 氏名のみ、年齢はevent_dateで計算する
      const patientId = caseEntry.his_id
      const patientName = caseEntry.name
      const patientDOB = caseEntry.date_of_birth

      // JESGOドキュメントから情報(初回治療～患者台帳、再発治療～再発)を抽出
      for (const item of caseEntry.documentList) {
        const documentEntry = item as formatJESGOdocument
        const daichoArray:(formatJESGOdaicho|formatJESGOrelapse)[] = []

        // 治療台帳をdepth 1の配列化
        if (documentEntry?.患者台帳 !== undefined) {
          if (Array.isArray(documentEntry.患者台帳)) {
            daichoArray.push(...documentEntry.患者台帳 as formatJESGOdaicho[])
          } else {
            daichoArray.push(documentEntry.患者台帳)
          }
        }
        if (documentEntry?.再発 !== undefined) {
          if (Array.isArray(documentEntry.再発)) {
            daichoArray.push(...documentEntry.再発 as formatJESGOrelapse[])
          } else {
            daichoArray.push(documentEntry.再発)
          }
        }

        // ログ
        if (verbose && daichoArray.length > 0) {
          console.log(`症例ID: ${patientId}`)
          console.log(`治療台帳総数: ${daichoArray.length}`)
        }

        // 治療台帳をJOED5用に変換
        for (const daicho of daichoArray) {
          // ロックアップ回避
          setTimeout(() => {}, 0)

          // IDの匿名化は変換ルーチンでは順序がわからないのでこの時点で行う
          const patientIdCoded = anonymizeSetting.includes('ID') ? `jesgo-${count}`: patientId

          const exportDocument = convertDaichoToJOED(
            patientIdCoded,
            patientName,
            patientDOB,
            daicho,
            yearFilter,
            anonymizeSetting
          )

          // ログ
          if (verbose) {
            if (exportDocument && exportDocument.length > 0) {
              console.log(`抽出手術数: ${exportDocument?.length}`)
              console.dir(exportDocument)
            } else {
              console.warn(`抽出なし`)
            }
          }

          // 変換結果を JOEDdocuments に push
          if (exportDocument && exportDocument.length > 0) {
            JOEDdocuments.push(...exportDocument)
          }
        }
      }
    }

    // 処理終了のメッセージを出す
    const progressbar = document.getElementById('pligin-progressbar')
    if (progressbar) {
      progressbar.innerText = '抽出・変換終了'
    }
    const statusline2 = document.getElementById('plugin-statusline2')
    if (statusline2) {
      statusline2.innerText = `${JOEDdocuments.length}件の鏡視下手術情報を抽出しました.`
    }

    // ログ
    if (verbose) {
      console.log(`****************`)
      console.log(`抽出症例数: ${JOEDdocuments.length}`)
      console.dir(JOEDdocuments)
    }

    return JOEDdocuments
  }

  // modal dialog 内で実行される処理
  const dialogProcedure = async () => {
    const selectElement = document.getElementById('plugin-selection')
    const anonymizeElement = document.getElementById('anonymize')
    const processButton = document.getElementById('plugin-process-script')
    if (!selectElement || !anonymizeElement || !processButton) {
      throw new Error('DOM loading failure.')
    }

    // ダイアログの年次 select / option を追加
    const currentYear: number = new Date().getFullYear()
  
    for (let year = currentYear; year > 2019; year--) {
      const option = document.createElement('option')
      option.text = `${year}年`
      option.value = year.toString()
      selectElement.appendChild(option)
    }

    // ダイアログのボタンイベントを設定
    return new Promise(resolve => {
      processButton.addEventListener(
        'click',
        (event: MouseEvent) => {
          const settingDiv = document.getElementById('plugin-setting')
          const processDiv = document.getElementById('plugin-processing')
          if (settingDiv && processDiv) {
            // クリック時のシフトキー押し下げを確認
            const shiftKey = event.shiftKey
            if (shiftKey) {
              // シフトキーが押されていたらログフラグを立てる
              verbose = true
            }

            // ダイアログの内容をスイッチ
            settingDiv.style.display = 'none'
            processDiv.style.display = ''

            // メインルーチンへ
            resolve(mainProcess(
              (selectElement as HTMLSelectElement).value, // 年次フィルタ
              (anonymizeElement as HTMLSelectElement).value // 匿名化設定
            ))
          } else {
            throw new Error('Div DOM loading failure.')
          }
        },
        {
          once: true
        }
      )
    })
  }

  // ダイアログの表示をする
  return await showModalDialog(createDialogContent, dialogProcedure) as Promise<formatJOED[] | undefined>
}
