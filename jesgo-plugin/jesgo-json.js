//
// JESGO-JSON ルールセット作成用 JSONドキュメント作成プラグイン
//
// piyotaicho/P4mohnet
//
const script_info = {
    plugin_name: 'JESGO-support用出力',
    plugin_version: '0.1',
    all_patient: true,
    attach_patient_info: true,
    update_db: false,
    show_upload_dialog: false,
    // filter_schema_query: '',
    // target_schema_id: 0;
    // target_schema_id_string: '/',
    explain: 'JESGO-supportが読み込むAPI生データを出力します.入力された患者の全情報が入っています.',
}

export async function init() {
    return script_info
}

export async function main(docData, apifunc) {
    console.dir(docData)

    if (docData.caseList) {
        const apiresult = await apifunc(docData)

        return (await handler(JSON.parse(apiresult)))
    }
    return(undefined)
}

async function handler(docData) {
    const numberOfCases = docData.length
    await show_modal_dialog(`出力される症例数は ${numberOfCases} です.`)
    return docData
}

export async function finalize() {
}


//
// Bootstrap modal dialogを作成
//
async function show_modal_dialog(message) {
    // based on bootstrap document : https://getbootstrap.jp/docs/5.0/components/modal/
    const document_body = document.getElementsByTagName('body')[0]

    const modal = createElementAndClass('div', 'modal')
    const modal_dialog = modal.appendChild(createElementAndClass('div', 'modal-dialog'))
    const modal_content = modal_dialog.appendChild(createElementAndClass('div', 'modal-content'))

    const modal_header = modal_content.appendChild(createElementAndClass('div', 'modal-header'))
    const modal_body = modal_content.appendChild(createElementAndClass('div', 'modal-body'))
    const modal_footer = modal_content.appendChild(createElementAndClass('div', 'modal-footer'))

    modal_header.appendChild(createElementAndClass('span', '')).innerText = 'プラグイン'

    modal_body.innerText = message

    const close_button = modal_footer.appendChild(createElementAndClass('button', 'btn btn-primary'))
    close_button.innerText = '閉じる'

    // hide 'loading'
    const loading_box = document.getElementById('Loading')
    let loading_box_display = ''

    if (loading_box) {
        loading_box_display = loading_box.style.display
        loading_box.style.display = 'none'
    }

    // show modal dialog
    modal.style.display = 'block'
    const modal_element = document_body.appendChild(modal)
    return new Promise(resolve => close_button.addEventListener(
        'click',
        () => {
            if (loading_box && loading_box_display != '') {
                loading_box.style.display = loading_box_display
            } 
            modal.style.display = 'none'
            document_body.removeChild(modal_element)
            resolve()
        },
        {
            once: true
        }
        )
    )
}
  
function createElementAndClass( elementTag, elementClassName) {
    const element = document.createElement(elementTag)
    if (elementClassName) {
        element.classList.add([...elementClassName.split(' ')])
    }
    return element
}
  