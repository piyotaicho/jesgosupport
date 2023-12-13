export const dialogHTML = `
<div style="display: flex; flex-direction: column;">
    <div style="display: flex; flex-direction: row; justify-content: space-around; margin-bottom: 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px gray solid;">
        <div style="margin: auto; width: 12%;">
            <img src="data:image/svg+xml;charset=utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xml%3Aspace%3D%22preserve%22%20width%3D%22397.61%22%20height%3D%22397.61%22%20viewBox%3D%220%200%20105.201%20105.201%22%3E%3Cg%20style%3D%22display%3Ainline%22%20transform%3D%22translate(-58.35%20-71.866)%22%3E%3Crect%20width%3D%22105%22%20height%3D%22105%22%20x%3D%2258.45%22%20y%3D%2271.967%22%20ry%3D%224.899%22%20style%3D%22fill%3A%239fff00%3Bfill-opacity%3A1%3Bstroke%3A%239fff00%3Bstroke-width%3A.201%3Bstroke-linejoin%3Around%3Bstroke-miterlimit%3A10%3Bstroke-opacity%3A1%3Bpaint-order%3Amarkers%20fill%20stroke%22%2F%3E%3Cpath%20d%3D%22M105%2083.474v49.5c0%204.651-3.955%2010.49-11.662%2011.325-7.708.836-24.748.438-24.748%200l.183%2020.64c17.206%202.073%2034.958%203.197%2051.415%201.279%2016.457-1.918%2029.866-8.634%2030.321-24.476V83.474z%22%20style%3D%22fill%3A%23d200ff%3Bfill-opacity%3A1%3Bstroke%3A%23000%3Bstroke-width%3A4.001%3Bstroke-linecap%3Around%3Bstroke-linejoin%3Around%3Bstroke-miterlimit%3A10%3Bstroke-dasharray%3Anone%3Bpaint-order%3Amarkers%20fill%20stroke%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E"
            style="width: 100%;"/>
        </div>
        <div style="margin: auto;">
            <div>
                <span style="font-size: 1.6rem;">JESGOサポートツールランタイム</span>
            </div>
            <div>
                <span style="font-size: 0.8rem;">Version 0.9.0 Copyright &copy; 2023 by P4mohnet</span>
            </div>
        </div>
    </div>
    <div id="plugin-settings" style="display: flex; flex-direction: row; justify-content: center; align-items: center;">
        <div>
            <select id="plugin-selection-mode" class="form-control">
                <option value="loadscript" selected>スクリプトファイルを指定して実行</option>
                <option value="CC" disabled>2023年子宮頸がん腫瘍登録</option>
                <option value="EM" disabled>2023年子宮体がん腫瘍登録</option>
                <option value="OV" disabled>2023年卵巣がん腫瘍登録</option>
            </select>        
        </div>
        <div style="margin-left: 0.8rem; margin-right: 0.8rem;">
            <button id="plugin-process-script" class="btn btn-primary">実行</button>        
        </div>
    </div>
    <div id="plugin-processing" style="display: flex; flex-direction: column; justify-content: center;">
        <div style="width: 90%; text-align: center; margin-bottom: 0.6rem;">
            <span id="plugin-statusline1">**出力症例数**</span>
        </div>
        <div style="width: 90%; text-align: center; margin-bottom: 0.6rem;">
            <span id="plugin-statusline2">**ステータス**</span>
        </div>
        <div style="width: 90%; text-align: center; margin-bottom: 0.6rem;">
            <div class="progress">
                <div class="progress-bar" role="progressbar" id="plugin-progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="0">処理中</div>
            </div>    
        </div>
        <div style="width: 90%; display: flex; flex-direction: row; justify-content: center; align-items: center; margin-bottom: 0.6rem;">
            <div>
                <label for="plugin-offset-value">CSVファイルの先頭オフセット行数</label>
            </div>
            <div style="margin-left: 0.8rem; margin-right: 0.8rem;">
                <!-- <input id="plugin-offset-value" class="form-control" type="number" min="0" style="width: 5rem;" value="0"/> -->
                <select id="plugin-offset-value" class="form-control" type="number" style="width: 5rem;" disabled>
                    <option value="0" selected>なし</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                    <option value="9">9</option>
                    <option value="10">10</option>
                </select>
            </div>
        </div>
        <div style="width: 90%; text-align: center; margin-bottom: 0.6rem;">
            <button id="plugin-download" class="btn btn-primary" disabled>CSVファイルをダウンロード</button>
        </div>
        <div style="width: 90%; text-align: center;">
            <span id="plugin-statusline3" style="display: none;">※ダイアログを閉じたらエラーの登録確認画面に遷移します※</span>
        </div>
    </div>
</div>
`
