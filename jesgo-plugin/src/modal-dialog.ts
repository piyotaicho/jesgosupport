/**
 * モーダルメッセージダイアログを表示する
 * @param message 表示するメッセージ文字列
 */
export async function showModalMessageBox (message = ''): Promise<unknown> {
  return showModalDialog((contentBox) => {
    if (contentBox) {
      (contentBox as HTMLDivElement).innerText = message
    }
  })
}

/**
 * モーダルダイアログを表示する
 * @param contentCreator モーダルダイアログの内容を設定するコールバック関数
 * @param eventHandler モーダルダイアログ内での動作を設定するコールバック関数(Promise)
 * @param disableDownloadOnClose SHIFT+閉じるボタンを押したときにダウンロードを行わない
 * @returns ダイアログを閉じるまでのpromise
 */
export async function showModalDialog (contentCreator:(bodyElement:Element) => void, eventHandler?:() => Promise<unknown>, disableDownloadOnClose = true): Promise<unknown> {
  // based on bootstrap document : https://getbootstrap.jp/docs/5.0/components/modal/
  const body = document.getElementsByTagName('body')[0]

  const modal = createElement('div', 'modal') as HTMLDivElement
  const dialog = modal.appendChild(createElement('div', 'modal-dialog')) as HTMLDivElement
  const content = dialog.appendChild(createElement('div', 'modal-content')) as HTMLDivElement

  const contentHeader = content.appendChild(createElement('div', 'modal-header')) as HTMLDivElement
  const contentBody = content.appendChild(createElement('div', 'modal-body')) as HTMLDivElement
  const contentFooter = content.appendChild(createElement('div', 'modal-footer')) as HTMLDivElement

  (contentHeader.appendChild(createElement('span', '')) as HTMLSpanElement).innerText = 'プラグイン'

  // コールバックでcontentBody部分を実装
  if (contentCreator) {
    contentCreator(contentBody)
  } else {
    contentBody.innerText = ''
  }

  // 閉じるボタンの実装
  const closeButton = contentFooter.appendChild(createElement('button', 'btn btn-primary')) as HTMLButtonElement
  closeButton.id = 'JESGOPluginModalDialogCloseButton'
  closeButton.innerText = '閉じる'

  // modalはloadingがついてくるので'loading'を隠す
  const loadingElement = document.getElementById('Loading')
  let loadingDisplayStyle = ''

  if (loadingElement) {
    loadingDisplayStyle = loadingElement.style.display
    loadingElement.style.display = 'none'
  }

  // ダイアログを表示する
  modal.style.display = 'block'
  const modalElement = body.appendChild(modal)

  // イベント処理コールバック関数が指定された場合はCloseButtonと並列動作させる
  if (eventHandler && typeof eventHandler === 'function') {
    let forceDownloadOnClose = false
    let eventHandlerFinished = false
    return Promise.all([
      // Promise(1) - イベントハンドラ
      eventHandler()
        // fullfilled or rejected問わず処理の終了を通知する
        .then(value => {
          eventHandlerFinished = true
          return value
        })
        .catch(_ => {
          eventHandlerFinished = true
        }),
      // Promise(2) - 閉じるボタンのイベントハンドラ
      new Promise<void>((resolve, reject) => closeButton.addEventListener(
        'click',
        (event: MouseEvent) => {
          // シフトキー押し下げで結果の強制ダウンロードを行う
          if (disableDownloadOnClose === false && event.shiftKey) {
            forceDownloadOnClose = true
          }

          // modalの表示を終了
          if (loadingElement && loadingDisplayStyle !== '') {
            loadingElement.style.display = loadingDisplayStyle
          }
          modal.style.display = 'none'
          body.removeChild(modalElement)

          // 他のルーチンが動作中(eventHandlerFinished == false)に閉じるが押された場合はPromise.allをrejectで終了させる
          if (eventHandlerFinished) {
            resolve()
          } else {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject()
          }
        },
        {
          once: true
        }
      ))
    ])
      // 正常終了して閉じるボタンでモーダルダイアログを閉じる
      // イベントハンドラの返り値を返す
      .then(results => {
        // forceDownloadOnCloseがtrueの場合は、ダウンロード処理を実行する
        if (forceDownloadOnClose) {
          const filename = 'jesgo-plugin-export.json'
          const content = JSON.stringify(results[0], null, 2)
          forceDownload(content, filename)
        }
        return results[0]
      })
      // rejectはエラーもしくは閉じるボタンで強制終了
      // undefinedを返す
      .catch(_ => new Promise<undefined>((resolve) => { resolve(undefined)}))
  } else {
    // イベント処理コールバック関数が指定されていない場合は、閉じるボタンを押すまで待機する
    return new Promise<void>(resolve => closeButton.addEventListener(
      'click',
      () => {
        if (loadingElement && loadingDisplayStyle !== '') {
          loadingElement.style.display = loadingDisplayStyle
        }
        modal.style.display = 'none'
        body.removeChild(modalElement)
        resolve(undefined)
      },
      {
        once: true
      }
    ))
  }
}

/**
 * Elementを作成する
 * @param tag 新規作成するHTMLエレメントのタグ名
 * @param elementClass タグに指定するクラス名称
 * @returns HTMLElement
 */
export function createElement (tag: string, elementClass = ''): Element {
  if (tag === '') {
    return new Element()
  }

  const newElement = document.createElement(tag)
  if (elementClass !== '') {
    const classes = elementClass.split(/\s/)
    newElement.classList.add(...classes)
  }
  return newElement
}

/**
 * html文字列からELements(DocumentFragment)を生成する
 * @param html HTML文字列
 * @returns DocumentFragments
 */
export function createElementFromHtml (html: string): DocumentFragment {
  if (html) {
    return document.createRange().createContextualFragment(html.trim())
  } else {
    return document.createDocumentFragment()
  }
}

type buttonStyles = 'btn-primary'|'btn-secondary'|'btn-success'|'btn-danger'|'btn-warning'|'btn-info'|'btn-light'|'btn-dark'
type buttonSize = 'large'|'small'
interface buttonOptions {
  style?: buttonStyles,
  size?: buttonSize,
  disabled?: boolean
}

/**
 * ボタンエレメントを作成する
 * @param label 
 * @param id 
 * @param options 
 * @returns 
 */
export function createButton (label: string, id = '', options?: buttonOptions): HTMLButtonElement {
  // オプションの規定値を設定
  const style = options?.style || 'btn-primary'
  const size = (options?.size || 'large') === 'large' ? 'btn-lg' : 'btn-sm'
  const disabled = options?.disabled || false

  const buttonElement = createElement('button', ['btn', ...style, ...size].join(' ')) as HTMLButtonElement
  if (id !== '') {
    buttonElement.id = id
  }
  buttonElement.innerText = label
  buttonElement.disabled = disabled

  return buttonElement
}

type inputSize = 'large'|'normal'|'small'
type inputType = 'text'|'file'
interface inputOptions {
  size?: inputSize,
  type?: inputType,
  disabled?: boolean,
  readonly?: boolean
}

/**
 * フォームの入力エレメントを作成する
 * @param label 
 * @param id 
 * @param options 
 * @returns 
 */
export function createFormInput (label: string, id = '', options?: inputOptions): HTMLDivElement|HTMLInputElement {
  const size = (options?.size || 'normal') === 'large'
    ? 'form-control-lg'
    : (options?.size || 'normal') === 'small' ? 'form-control-sm' : ''
  const type = options?.type === 'file' ? 'file' : 'text'
  const disabled = options?.disabled || false
  const readonly = options?.readonly || false

  const inputElement = createElement('input', ['form-control', ...size].join(' ')) as HTMLInputElement
  inputElement.type = type
  inputElement.disabled = disabled
  inputElement.readOnly = readonly
  if (id !== '') {
    inputElement.id = id
  }

  if (label !== '') {
    const divBox = createElement('div') as HTMLDivElement
    const labelElement = createElement('label', 'form-label') as HTMLLabelElement
    labelElement.innerText = label
    if (id !== '') {
      labelElement.htmlFor = id
    }
    divBox.appendChild(labelElement)
    divBox.appendChild(inputElement)
    return divBox
  } else {
    return inputElement
  }
}

/**
 * contentを強制的にダウンロードする
 * @param content 
 * @param filename 
 */
function forceDownload (content: string, filename?: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download-data.txt'
  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    URL.revokeObjectURL(url) // メモリ解放
    if (a.parentNode) {
      a.parentNode.removeChild(a) // DOMから削除
    }
  } , 250)
}
