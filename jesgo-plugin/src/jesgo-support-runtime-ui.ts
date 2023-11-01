export const dialogHTML = `
<div>
<h1 style="font-size: 1.6rem;">JESGOサポートツールランタイム</h1>
<hr/>
<div id="plugin-settings" class="container">
    <div class="row">
        <div class="col-8">
            <select id="plugin-selection-mode" class="form-select form-select-sm">
                <option value="loadscript" selected>スクリプトファイルを指定して実行</option>
                <option value="CC" disabled>腫瘍登録子宮頸がんプリセット</option>
                <option value="EM">腫瘍登録子宮体がんプリセット</option>
                <option value="OV" disabled>腫瘍登録卵巣がんプリセット</option>
            </select>        
        </div>
        <div class="col">
            <button id="plugin-process-script" class="btn btn-primary btn-sm">実行</button>        
        </div>
    </div>
</div>
<div id="plugin-processing" class="container">
    <div class="col-10 text-center">
        <span id="plugin-statusline1">JESGOから出力された症例数は0症例です.</span>
    </div>
    <div class="col-10 text-center">
        <span id="plugin-statusline2">データを抽出・変換中です</span>
    </div>
    <div class="col-10">
        <div class="progress">
            <div class="progress-bar" role="progressbar" id="plugin-progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="0">処理中</div>
        </div>    
    </div>
    <div class="row">
        <div class="col-2"></div>
        <div class="col-6">
            <label for="plugin-offset-value" class="form-label">CSVファイルの先頭オフセット行数</label>
        </div>
        <div class="col-2">
            <input id="plugin-offset-value" class="form-control form-control-sm" type="number" style="width: 3rem;" disabled />    
        </div>
        <div class="col-2"></div>
    </div>
    <div class="col-10 text-center">
        <button id="plugin-download" class="btn btn-primary btn-sm" disabled>CSVファイルをダウンロード</button>
    </div>
    <div class="container text-center">
        <span id="plugin-statusline3" style="display: none;">※ダイアログを閉じたらエラーの登録画面に遷移します※</span>
    </div>
</div>
</div> 
`
