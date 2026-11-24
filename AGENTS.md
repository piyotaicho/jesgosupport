# このプロジェクトについて

とある仕様のJSONデーター(```{ "type": "array", "items": { "type": "object" }}```) に対してCSVへの変換などを行うスクリプトエンジンです。

スクリプトは、ブロックを逐次実行する仕様で前方へのジャンプは無限ループ回避のために行わない仕様です。

スクリプトの機能はすべて src/components/newProcessor.ts にあります。

# 改善したい部分
## 現状

原則として ソースJSON をトランスパイルして 1ステップずつ対応する関数のjavascript文字列を生成して、実行ユニットで Function オブジェクトを生成して実行しています。

ブラウザのスロットリングとsetTimeoutを使うことによるパフォーマンスの低下が問題になっています。

このスクリプトエンジンはブラウザ上でのwebアプリケーションと、pure javascriptで記載された単一ファイルで記載され、Blobでのimportを使ってプラグインの一部としても利用されます。

## 変更の希望

- コンパイラで、webWorker のソースを生成して、実行ユニットではソースから webWorker を生成して、データを1オブジェクトずつもしくは全て渡して非同期実行して結果を取得するように構成しなおしたい。
- メインスレッドから、webWorker中の実行ループを途中で停止できるようなインスタンスを用意する。
- メインスレッド側がwebWorker側の進捗を確認できるようなインスタンスを用意する。
- 結果の受け取りはできればwebWorkerの進捗が進む間も確認したいので、メインスレッド側のfunctionをコールバックで呼ぶなどして実現しても構わない
- 最終環境では別ファイルとしての webWorker ソースを持つことができない、Blob urlが前提となる。サーバーがExpress.jsで、現状上記のimportが問題なく動作しているので動作は期待できる。

# 重要な指定

作業に関するスクリプトの評価や、検討事項、変更の要旨を AGENTS.md の # WORK 以降に追加してください。

# WORK

## Web Workerによるスクリプト実行基盤への移行評価

- 結論: 実装可能。ただし、現行の `Processor` クラス一式をブラウザーWorkerへ移植するのではなく、コンパイル済みルールと必要な実行ランタイムだけをWorker用JavaScriptとして生成する段階的移行が安全。
- 現状: [src/components/newProcessor.ts](src/components/newProcessor.ts) はルールごとの関数文字列を `new Function()` で生成・実行し、[src/components/ControlBar.vue](src/components/ControlBar.vue) とプラグイン側が症例ごとに `Processor.run()` を逐次呼び出している。
- Worker化の利点: メインスレッドをブロックしない、症例単位またはバッチ単位を `postMessage()` で処理できる、進捗・途中結果・停止要求をイベントで分離できる。
- 推奨インターフェイス:
  - コンパイラは `compile(rules)` を独立したWorkerソース文字列へ変換する。
  - 実行ユニットは `run(content | content[])`、`stop()`、`progress` コールバック、`onResult` コールバック、`terminate()` を持つ。
  - Workerへ送るメッセージは `run`、`stop`、可能なら `terminate` に限定し、返答は `progress`、`result`、`complete`、`error` とする。
  - 通信型にはルールセット、ドキュメント配列、完了件数、現在ルール、現在ステップ、CSV、エラー、キャンセル理由を明示する。
- 停止方式:
  - 通常停止は協調的キャンセルとし、ルール、ステップ、症例境界で停止フラグを確認する。フラグはメインスレッドの `stop()` がWorkerへ `stop` メッセージで伝える。
  - 無限ループや実行不能なコードによる即時停止が必要な場合は、停止要求ではなく `terminate()` を使う。現行仕様では前方ジャンプのみなので通常ループは抑制されているが、外部ライブラリ呼び出しや生成された不正な処理は協調的キャンセルだけでは確実に止められない。
- 進捗と途中結果:
  - 症例開始時、症例完了時、ルール・ステップ境界で `progress` を送る。
  - 症例完了ごとに `result` を送る。これにより大量データでもメインスレッド側で逐次CSV・エラーを蓄積できる。
  - 初期実装では症例単位の結果・進捗が十分。バッチ送信時は全バッチを一度に返さず、症例完度に応じたメッセージを維持する。
- データ移送:
  - 入力・出力はstructured clone可能なプレーンオブジェクトに限定する。`PulledDocument`、`LogicRuleSet`、`processorOutput` はこの前提に適合する。
  - 大量データではバッチを分割し、転送前のディープコピーではなくブラウザーのtransfer/cloneを利用する。ただし通常オブジェクトはtransfer listへ含められない。
- 実装上の注意:
  - Workerには `new Function()` もしくは後続の安全な実行方式が必要で、Blob URLとインラインスクリプトはホストのCSP制約を受ける。Viteとプラグイン配布の両方でWorker生成・配布方法を検証する。
  - 現行ランタイムは `parseJesgo`、`jsonpath-plus`、Proxy変数ストアなどメインスレッド依存を含むため、Workerへ移す際はこれらの依存をWorkerバンドルへ含めるか、コンパイル済みソースだけで完結するランタイムを別モジュール化する。
  - `compile()` と `run()` の既存APIを維持し、新しい `WorkerProcessor` を追加して段階的に切り替える。プラグインなどWorkerを使えない環境向けに同期的・メインスレッド版のフォールバックを残す。
  - 統合テストは単一症例、複数症例、キャンセル、キャンセル直後の再実行、実行エラー、スキップ、空ルール、前方オフセット、前方ジャンプ境界を対象にする。
  - Worker生成時のテストは、CSP環境、Blob URL無効環境、ブラウザー閉鎖・ダイアログ閉鎖時の終了を含める。

## 最大の改善目的に対する評価

- ブラウザースロットリング: Workerへ移すことは、バックグラウンドタブやブラウザーのスケジューラーによってメインスレッド処理が停止される問題を回避するための有効な設計。ただし、Workerスレッド自体もブラウザーによってスロットリングされ得るため、リアルタイム完了保証にはならない。
- メインスレッドのスロットリング: 現行の `setTimeout(..., 0)` によるステップラップはイベントループへ制御を渡す目的だが、Worker内では不要なスケジューリングとなる。
- 推奨実行方式: Workerループ内では各ステップを同期またはネイティブPromiseの範囲内で連続実行し、症例境界およそ一定件数ごとに `postMessage()` を行う。ステップごとに `await` しない。
- パフォーマンス上の重要点: 症例ごとの細かいメッセージ送信より、症例完了ごとの結果通知が適切。メインスレッドの進捗描画や停止要求への応答性を保つため、一定件数ごとまたは一定時間ごとの進捗通知を併用する。
- 通知頻度の目安: まずは症例完了ごとに進捗と結果を送る実装とし、症例が軽い大量処理では高頻度のpostMessageを避けるためバッチ化する。バッチ内でもキャンセル境界と部分結果の収集を設ける。
- 設計上のトレードオフ: Workerへ全データを一度に送るとクローンコストは発生するが、症例ごとのメインスレッド往復と現在の同期ループを解消できる。大量かつ小さい症例ではバッチはWorker内で処理し、各症例の完了結果をまとめて送る方式が有力。
- この変更で解消されるのはメインスレッドへの負荷集中と `setTimeout(0)` によるステップ間ディスパッチ。完全なスロットリング耐性やリアルタイム性は保証されないため、進捗・キャンセル・完了通知はブラウザーのスケジューラーに従う仕様として扱う。

## Blob URLを前提とする最終構成の追加確認

- 最終環境ではWorkerソースを別ファイルとして配布せず、コンパイル結果または自動生成ランタイムを文字列化し、`new Blob([source], { type: 'text/javascript' })` と `URL.createObjectURL()` から生成する。
- この方式はブラウザー版と、Blob経由で動的importされたpure JavaScriptプラグインの両方に適合する。ただしプラグインホスト側の `worker-src` CSP、Worker生成元のHTTPS/Blob許可、およびBlob URLのライフサイクルを確認する必要がある。
- Blob URLはWorker生成後に `URL.revokeObjectURL(url)` できる。Worker内の読み込み完了に依存しない実装では、生成直後のrevokeはブラウザー実装差で失敗する可能性があるため、Worker側の初期化完了通知または十分な生成完了タイミングまで保持し、終了時に回収する。
- コンパイラの出力は「ルール単位の文字列だけ」ではなく、Worker内で動作する自己完結した処理ランタイムを含むソースを推奨する。依存ライブラリはバンドル済みコードとして埋め込むか、コンパイル後の実行に不要になる最小ランタイムへ分離する。
- `new Function('processor', currentCodeBuffer[counter])` をWorker内で継続利用する場合も、コンテンツセキュリティポリシーでunsafe-eval相当が禁止される環境では実行できない。最終方針では、コンパイル時に安全なディスパッチ形式へ変換できるか、互換性を残す場合はCSP制約と実行方式を明示的に分岐する。
- Express.js配信時も、Blob Workerはサーバーファイルではなくブラウザー内生成なので追加HTTPエンドポイントは必須ではない。一方でWeb Worker自体は専用スレッドであり、ダイナミックimportや外部モジュール参照をソース文字列内に入れるとBlob Workerの解決規則で失敗する可能性がある。
- Workerソース内には外部モジュールimportを原則置かず、コンパイル済み関数・JSONパス処理・変数・出力処理を同一文字列に含める。モジュール依存が必要な場合は、Worker生成前に一つのバンドル文字列へ展開する。
- Blob URL方式でも停止機能は維持できる。通常停止はルール・ステップ・症例境界で協調的にフラグを確認し、ハングや処理不能時はWorkerインスタンスの`terminate()`で即時停止する。
- 進捗・途中結果はBlob Worker内の`postMessage()`で通知する。通信先はメインスレッドのコールバックに限定し、データ取得やDOM操作をWorkerへ持ち込まない。
- テスト対象を拡張し、通常ブラウザー、Blob importプラグイン、Worker `worker-src` CSP制限、Blob URL生成/回収、動的importしたプラグインからの複数インスタンス生成を含める。

## src以下への実装方針

- [src/components/newProcessor.ts](src/components/newProcessor.ts) にWorker用ソース生成メソッドを追加し、既存の `compile()` と `run()` は互換APIとして維持する。
- [src/components/workerProcessor.ts](src/components/workerProcessor.ts) にBlob URL生成、Workerライフサイクル、協調停止、進捗・途中結果・完了通知を実装する。
- `ControlBar.vue` の一括実行は、症例ごとの `Processor.run()` 呼び出しではなく `WorkerProcessor.run(documents[])`へ移行する。コンパイル専用モードではWorkerを起動しない。
- 通常停止は `stop()`で実行境界を確認する。`terminate()`はユーザーキャンセルのクリーンアップ、初期化失敗、Worker実行不能時に使用し、Blob URLも回収する。
- 第三段階として、UIの実行パスとWorkerランタイムを維持しつつ、既存の直接 `Processor.run()`をプレビュー・互換用途として残す。
- 現在の実装では[src/components/workerProcessor.ts](src/components/workerProcessor.ts)がBlob URLとWorkerインスタンスを管理し、[src/components/ControlBar.vue](src/components/ControlBar.vue)の全症例実行を一括バッチへ切り替えている。
- 症例完了時の `result` メッセージはキャンセル要求後も到着済みならUIへ反映する。キャンセルは新規データ処理を停止し、既に到着した部分結果は保持する。
- 実行完了時は `terminate()`ではなく、通常はBlob URLとWorkerインスタンスをライフサイクル終了時に回収する。再利用が必要な場合は`run()`ごとのインスタンス再生成を避ける実装へ改修する。
- 検証済み: Vite production buildは成功。`npx tsc --noEmit`はリポジトリ既存のTypeScript 7設定と本変更前からの非互換オプションにより完走不可。
- 未検証: Worker内での全コマンド互換、ブラウザー実行、Blob URL生成、CSP制約、キャンセル競合、構造化クローニングのコスト。特にJSONPathライブラリ相当は簡易実装を暫定的に含むため、既存の完全なjsonpath-plus互換が必要。

## DataCloneError修正

- 原因は`worker.postMessage()`へVuex getter由来または加工済みオブジェクトを直接渡していることだけでなく、送信前にplain JSONへ正規化していないことも問題。
- `WorkerProcessor.run()`では送信前に`JSON.parse(JSON.stringify(documents))`を行い、プレーンオブジェクトへ正規化する。
- JSONシリアライズまたは`postMessage()`が失敗した場合はPromiseをrejectし、実行中フラグを解除する。`DataCloneError`をUI側の汎用エラーへ隠さず、元の送信失敗を捕捉する。

## Workerランタイムのコンパイル専用関数

- `setValueAsStringArray`はworkerテンプレート内では参照されておらず、コンパイル時の補助関数として[src/components/newProcessor.ts](src/components/newProcessor.ts)にのみ必要。
- `parseStringToStringArray`はコンパイル時に引数リテラルを配列へ変換し、生成されたコードへ`JSON.stringify(...)`済みの値として埋め込む。Worker実行時にはこの関数を呼ばない。
- Workerテンプレートから両関数を削除した。削除により実行ランタイムの不要な定義を減らし、コンパイル済みコード文字列に埋め込まれた値が唯一の実行時入力になる。

## 追加の不要コード棚卸し

- メイン側の未参照補助関数`setValueAsStringArray`と`parseVariableValueArray`は削除した。
- Worker側でコンパイル専用となっていたテンプレート内`compiling`フラグは削除した。
- Workerテンプレート内で必要なものは、変数ストア、変数初期化、ソース解決、全コマンド、ループ制御、`postMessage`通知。
- 次に削除候補として見直すのは簡易`parseJesgo`実装。完全互換が必要なため、現時点では削除せず依存分離またはjsonpath-plus相当のバンドル化を別途検討する。

## プログレス表示とJSONパス修正

- [src/components/ProgressBar.vue](src/components/ProgressBar.vue)のパーセントは0〜100へクランプし、件数除算や`NaN`の場合は0を返す。
- Workerの進捗は完了件数で通知し、`ControlBar.vue`の表示インデックスは0始まりへ変換する。結果メッセージ受信時も症例インデックスを直接設定する。
- Worker内の簡易`parseJesgo`は正規表現分割ではなくブラケット対応のセグメント分割へ変更し、`$.[0]`、`[*]`、数値インデックス、通常プロパティを順に解決する。
- ルールの`rule.source`はコンパイル時に保持し、実行時に`parseJesgo(content.documentList, path または [path, subpath])`で`@1`以降へ設定する。

## verbose-run比較モードとJSONPath埋め込み

- `ControlBar.vue`の`verbose-run`はWorkerを生成せず、既存の`Processor.compile()`と`Processor.run()`を症例ごとに呼ぶ。通常の詳細ログとキャンセル動作を比較基準として維持する。
- 通常実行は`WorkerProcessor`を使用する。コンパイル専用モードはWorkerを生成しない。
- Workerテンプレートへjsonpath-plusのブラウザー版UMDソースを埋め込む。`?raw`で読み込んだライブラリ本体をBlob Workerソースへ展開し、簡易パーサーではなくライブラリのJSONPathを使う。
- これにより`$.[0].患者台帳.がん種`、再帰検索、フィルター、配列操作を既存処理と同じライブラリで評価する。サブパス配列も既存の`parseJesgo`仕様に合わせて再帰処理する。
- 検証済み: raw importを含むVite production buildは成功。ブラウザーでWorkerへUMDライブラリがロードされること、各ルールの`@`変数へ期待値が入ることは追加で確認が必要。

## JSONPathメインスレッド往復ラッパー

- Worker内にjsonpath-plusのライブラリを埋め込まず、`parseJesgo`をメインスレッドへ委譲する。
- Workerテンプレートの`parseJesgo(jesgoDocument, jsonpath, mode)`は`jsonpath-request`を`postMessage()`し、`requestId`単位のPromiseとして待機する。
- メインスレッドの`WorkerProcessor`は`jsonpath-request`を受け、既存の`parseJesgo()`で処理し、`jsonpath-response`で配列を返す。
- `rule.source`の抽出、`commandQuery`、`Sort`のインデックス抽出はすべてこのラッパー経由にする。
- Worker側の`Processor.run()`、ステップ実行、`commandQuery`、`commandSort`はPromiseを待機するため、JSONPath応答前に次ステップへ進まない。
- メインスレッド側でJSONPathライブラリを一元管理し、WorkerはJSONデータ処理と変数・CSV処理に限定する。
