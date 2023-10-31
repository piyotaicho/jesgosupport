export const dialogHTML = `
<div>
    <h1 style="font-size: 1.6rem;">JESGOサポートツールランタイム</h1>
    <hr/>
    <div id="plugin-settings">
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
                <button id="plugin-process-script" class="btn btn-primary">実行</button>        
            </div>
        </div>
    </div>
    <div id="plugin-processing">
        <div class="container text-center">
            <span id="plugin-statusline1">JESGOから出力された症例数は0症例です.</span>
            <hr>
        </div>
        <div class="container text-center">
            <div class="row">
                <span id="plugin-statusline2">データを抽出・変換中です</span>
            </div>
            <div class="progress">
                <div class="progress-bar" role="progressbar" id="plugin-progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="0">処理中</div>
            </div>    
        </div>
        <div class="container text-center">
            <button id="plugin-download" class="btn btn-primary" disabled>出力データをダウンロード</button>
        </div>
        <div class="container text-center">
            <span id="plugin-statusline3" style="display: none;">※ダイアログを閉じたらエラーの登録画面に遷移します※</span>
        </div>
    </div>
</div>
`
