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
 * @returns ダイアログを閉じるまでのpromise
 */
export async function showModalDialog (contentCreator:(bodyElement:Element) => void, eventHandler?:() => Promise<unknown>): Promise<unknown> {
  // based on bootstrap document : https://getbootstrap.jp/docs/5.0/components/modal/
  const body = document.getElementsByTagName('body')[0]

  const modal = createElement('div', 'modal') as HTMLDivElement
  const dialog = modal.appendChild(createElement('div', 'modal-dialog')) as HTMLDivElement
  const content = dialog.appendChild(createElement('div', 'modal-content')) as HTMLDivElement

  const contentHeader = content.appendChild(createElement('div', 'modal-header')) as HTMLDivElement
  const contentBody = content.appendChild(createElement('div', 'modal-body')) as HTMLDivElement
  const contentFooter = content.appendChild(createElement('div', 'modal-footer')) as HTMLDivElement

  (contentHeader.appendChild(createElement('span', '')) as HTMLSpanElement).innerText = 'プラグイン'

  // コールバックでbody部分を実装
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

  // イベント処理コールバック関数が指定された場合はraceでCloseButtonと並列動作させる
  if (eventHandler && typeof eventHandler === 'function') {
    return Promise.race([
      eventHandler,
      new Promise<void>(resolve => closeButton.addEventListener(
        'click',
        () => {
          if (loadingElement && loadingDisplayStyle !== '') {
            loadingElement.style.display = loadingDisplayStyle
          }
          modal.style.display = 'none'
          body.removeChild(modalElement)
          resolve()
        },
        {
          once: true
        }
      ))
    ])
  } else {
    return new Promise<void>(resolve => closeButton.addEventListener(
      'click',
      () => {
        if (loadingElement && loadingDisplayStyle !== '') {
          loadingElement.style.display = loadingDisplayStyle
        }
        modal.style.display = 'none'
        body.removeChild(modalElement)
        resolve()
      },
      {
        once: true
      }
    ))
  }
}

/**
 * DOMを作成する
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

type buttonStyles = 'btn-primary'|'btn-secondary'|'btn-success'|'btn-danger'|'btn-warning'|'btn-info'|'btn-light'|'btn-dark'
type buttonSize = 'large'|'small'
interface buttonOptions {
  style?: buttonStyles,
  size?: buttonSize,
  disabled?: boolean
}

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
