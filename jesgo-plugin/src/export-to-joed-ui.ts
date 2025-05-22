export const dialogHTMLstrings = `
<div style="display: flex; flex-direction: row;">
    <div style="display: flex; flex-direction: column; justify-content: center; text-align: center;">
        <div>
            <img src="data:image/png;base64,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"
            alt="[JOED5logo]"
            style="height: 100%; width: 130px; padding: 0.8rem;"
            />
        </div>
        <div>
            <span style="font-size: 0.8rem;">$$VERSION$$</span>
        </div>
        <div>
            <span style="font-size: 0.8rem;">$$CREDIT$$</span>
        </div>
    </div>
    <div id="plugin-setting" style="margin-left: 1rem;">
        <div>
            <label for="plugin-selection" class="form-label">
                出力する年次を選択してください:
            </label>   
            <select id="plugin-selection" class="form-select form-select-sm">
                <option value="ALL" selected>全て</option>
            </select>
        </div>
        <div style="padding-top: 0.9rem;">
            <label for="anonymize" class="form-label">
                匿名化するかどうかを選択してください:
            </label>
            <select id="anonymize" class="form-select form-select-sm">
                <option value="NO" selected>匿名化しない</option>
                <option value="NAME">氏名を出力しない</option>
                <option value="ID,NAME">IDを連番に変更し氏名を出力しない</option>
                <option value="ID,NAME,DATE">手術日を1/1,IDを連番に変更し氏名を出力しない</option>
            </select>
        </div>
        <div style="padding-top: 0.9rem;">
            <button id="plugin-process-script" class="btn btn-primary">上記の年次の症例を抽出して変換を開始</button>
        </div>
    </div>
    <div id="plugin-processing" style="margin-left: 1rem; display: none;">
        <span id="plugin-statusline1">JESGOから出力された症例数は0症例です.</span>
        <hr>
        <span id="plugin-statusline2">データを抽出・変換中です</span>
        <div class="progress">
            <div class="progress-bar" role="progressbar" id="pligin-progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="0">処理中</div>
        </div>
    </div>
</div>
`
