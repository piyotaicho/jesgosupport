import { mainOutput, scriptInfo, getterPluginArgument, pulledDocument } from './types'
import { showModalDialog, createElement, createButton, createFormInput } from './modal-dialog'
import { processor } from '../../src/components/processor'
import { createBaseVNode } from 'vue'

export async function init ():Promise<scriptInfo> {
  return {
    plugin_name: 'JESGO-supportランタイム',
    plugin_version: (process.env.npm_package_version) || '0.0.1',
    all_patient: true,
    attach_patient_info: true,
    show_upload_dialog: false,
    update_db: false,
    explain: 'JESGOsupportで作成されたスクリプトを実行してCSVファイルとエラー出力を取得します.'
  }
}

export async function main (docData: getterPluginArgument, apifunction: (docData: getterPluginArgument) => string): Promise<mainOutput> {
  if (docData.caseList) {
    // APIでドキュメントを取得
    const documentJSON = await apifunction(docData)
    let documents:pulledDocument[]
    try {
      documents = JSON.parse(documentJSON) as pulledDocument[]
    } catch {
      return 'APIの返り値が異常です.'
    }

    // 実際の処理
    // スクリプトのロード
    const macro = await loadScript()

    return await handler(documents, macro)
  }
}

export async function finalize(): Promise<void> {
  // NOP
}

async function loadScript() {
  let scriptbody = ''

  const eventHandlerLoadFile = async (eventElement) => {

  }

  await showModalDialog(
    (baseElement) => {
      // create HTML DOM
      const divLoadfile = createElement('div') as HTMLDivElement
      const p1 = createElement('p') as HTMLParagraphElement
      p1.innerText = 'JESGOサポートツールで作成したスクリプトを適応して実行します.'
      divLoadfile.appendChild(p1)
      divLoadfile.appendChild(createElement('hr') as HTMLHRElement)
      const inputfile = createFormInput('スクリプトファイルを指定', 'inputscriptfile', { type: 'file' })
      divLoadfile.appendChild(inputfile)
      inputfile.addEventListener('click', eventHandlerLoadFile)

      baseElement.appendChild(divLoadfile)

      const divRunScript = createElement('div') as HTMLDivElement
      divRunScript.id = 'runscript'
      divRunScript.style.width = '10rem;'
      divRunScript.style.margin = '1rem auto;'
      const runButton = createButton('実行', 'runBtn', { disabled: true })
      divRunScript.appendChild(runButton)
      const stopButton = createButton('中止', 'stopBtn', { disabled: true })
      divRunScript.appendChild(stopButton)

      baseElement.appendChild(divRunScript)

      const divProgress = createElement('div') as HTMLDivElement
      divProgress.id = 'processprogress'
    },
    eventHandler
  )

  return scriptbody
}

async function handler (data: pulledDocument[]): Promise<string[]> {
  // データ無し
  if (data.length === 0 ) {
    return []
  }

  // ダイアログで症例毎に逐次処理する
  showModalDialog((contentElement) => {
    contentElement.appendChild()
  },
  async () => {

  })
}

