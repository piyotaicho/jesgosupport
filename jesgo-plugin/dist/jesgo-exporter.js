/******/ var __webpack_modules__ = ({

/***/ "./jesgo-plugin/src/modal-dialog.ts":
/*!******************************************!*\
  !*** ./jesgo-plugin/src/modal-dialog.ts ***!
  \******************************************/
/***/ (function(__unused_webpack_module, exports) {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createButton = exports.showModalDialog = exports.showModalMessageBox = void 0;
/**
 * モーダルメッセージダイアログを表示する
 * @param message 表示するメッセージ文字列
 */
async function showModalMessageBox(message = '') {
    return showModalDialog((contentBox) => {
        if (contentBox) {
            contentBox.innerText = message;
        }
    });
}
exports.showModalMessageBox = showModalMessageBox;
/**
 * モーダルダイアログを表示する
 * @param contentCreator モーダルダイアログの内容を設定するコールバック関数
 * @param eventHandler モーダルダイアログ内での動作を設定するコールバック関数(Promise)
 * @returns ダイアログを閉じるまでのpromise
 */
async function showModalDialog(contentCreator, eventHandler) {
    // based on bootstrap document : https://getbootstrap.jp/docs/5.0/components/modal/
    const body = document.getElementsByTagName('body')[0];
    const modal = createElement('div', 'modal');
    const dialog = modal.appendChild(createElement('div', 'modal-dialog'));
    const content = dialog.appendChild(createElement('div', 'modal-content'));
    const contentHeader = content.appendChild(createElement('div', 'modal-header'));
    const contentBody = content.appendChild(createElement('div', 'modal-body'));
    const contentFooter = content.appendChild(createElement('div', 'modal-footer'));
    contentHeader.appendChild(createElement('span', '')).innerText = 'プラグイン';
    // コールバックでbody部分を実装
    if (contentCreator) {
        contentCreator(contentBody);
    }
    else {
        contentBody.innerText = '';
    }
    // 閉じるボタンの実装
    const closeButton = contentFooter.appendChild(createElement('button', 'btn btn-primary'));
    closeButton.id = 'JESGOPluginModalDialogCloseButton';
    closeButton.innerText = '閉じる';
    // modalはloadingがついてくるので'loading'を隠す
    const loadingElement = document.getElementById('Loading');
    let loadingDisplayStyle = '';
    if (loadingElement) {
        loadingDisplayStyle = loadingElement.style.display;
        loadingElement.style.display = 'none';
    }
    // ダイアログを表示する
    modal.style.display = 'block';
    const modalElement = body.appendChild(modal);
    // イベント処理コールバック関数が指定された場合はraceでCloseButtonと並列動作させる
    if (eventHandler && typeof eventHandler === 'function') {
        return Promise.race([
            eventHandler,
            new Promise(resolve => closeButton.addEventListener('click', () => {
                if (loadingElement && loadingDisplayStyle !== '') {
                    loadingElement.style.display = loadingDisplayStyle;
                }
                modal.style.display = 'none';
                body.removeChild(modalElement);
                resolve();
            }, {
                once: true
            }))
        ]);
    }
    else {
        return new Promise(resolve => closeButton.addEventListener('click', () => {
            if (loadingElement && loadingDisplayStyle !== '') {
                loadingElement.style.display = loadingDisplayStyle;
            }
            modal.style.display = 'none';
            body.removeChild(modalElement);
            resolve();
        }, {
            once: true
        }));
    }
}
exports.showModalDialog = showModalDialog;
/**
 * DOMを作成する
 * @param tag 新規作成するHTMLエレメントのタグ名
 * @param elementClass タグに指定するクラス名称
 * @returns HTMLElement
 */
function createElement(tag, elementClass = '') {
    if (tag === '') {
        return new Element();
    }
    const newElement = document.createElement(tag);
    if (elementClass !== '') {
        const classes = elementClass.split(/\s/);
        newElement.classList.add(...classes);
    }
    return newElement;
}
function createButton(label, id = '', options) {
    // オプションの規定値を設定
    const style = (options === null || options === void 0 ? void 0 : options.style) || 'btn-primary';
    const size = ((options === null || options === void 0 ? void 0 : options.size) || 'large') === 'large' ? 'btn-lg' : 'btn-sm';
    const disabled = (options === null || options === void 0 ? void 0 : options.disabled) || false;
    const buttonElement = createElement('button', ['btn', ...style, ...size].join(' '));
    if (id !== '') {
        buttonElement.id = id;
    }
    buttonElement.innerText = label;
    buttonElement.disabled = disabled;
    return buttonElement;
}
exports.createButton = createButton;


/***/ })

/******/ });
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __webpack_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
!function() {
var exports = __webpack_exports__;
/*!********************************************!*\
  !*** ./jesgo-plugin/src/jesgo-exporter.ts ***!
  \********************************************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.finalize = exports.main = exports.init = void 0;
const modal_dialog_1 = __webpack_require__(/*! ./modal-dialog */ "./jesgo-plugin/src/modal-dialog.ts");
const script_info = {
    plugin_name: 'JESGO-support用出力(byTS&webpack)',
    plugin_version: '0.1',
    all_patient: true,
    attach_patient_info: true,
    update_db: false,
    show_upload_dialog: false,
    explain: 'JESGO-supportが読み込むAPI生データを出力します.入力された患者の全情報が入っています.'
};
async function init() {
    return script_info;
}
exports.init = init;
async function main(docData, apifunc) {
    if (docData.caseList) {
        const apiresult = await apifunc(docData);
        let documents;
        try {
            documents = JSON.parse(apiresult);
        }
        catch (_a) {
            return ('APIの返り値が異常です.');
        }
        return await handler(documents);
    }
    return (undefined);
}
exports.main = main;
async function handler(docData) {
    const numberOfCases = docData.length;
    await (0, modal_dialog_1.showModalMessageBox)(`出力される症例数は ${numberOfCases} です.`);
    return docData;
}
async function finalize() {
    //
}
exports.finalize = finalize;

}();
var __webpack_exports___esModule = __webpack_exports__.__esModule;
var __webpack_exports__finalize = __webpack_exports__.finalize;
var __webpack_exports__init = __webpack_exports__.init;
var __webpack_exports__main = __webpack_exports__.main;
export { __webpack_exports___esModule as __esModule, __webpack_exports__finalize as finalize, __webpack_exports__init as init, __webpack_exports__main as main };
