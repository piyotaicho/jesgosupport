# JESGOサポートツール
JESGOからプラグイン経由で出力された全症例に該当するJSONファイルをCSVに加工するツールです。JSONドキュメントからJSONPathを用いて情報を抽出してそれをルールセットに基づきCSVにマッピングします。  
実際の出力ドキュメントを参照しながら変換ルールを作成できますが、ドキュメント中に全てのドキュメント構造が網羅されることは原則ありませんのでスキーマ定義 https://github.com/jesgo-toitu/jesgo-schema も参照して作業することをお薦めします。

## プラグインの登録
JSONファイルの出力には /jesgo-plugin/jesgo-json.js をJESGOにプラグインとして登録してご利用下さい。  
エラーメッセージのJSONファイルを JESGOに取り込むには /jesgo-plugin/jesgo-error-import.js をJESGOにプラグインとして登録してご利用下さい。

## 本ユーティリティの機能
JSONドキュメントをJSONpathでクロールして値を取得します。順方向性に相対ジャンプで処理の分岐ができます。
基本的に複数の値が取得されることを前提に設計していますが、最終的にはカンマで連結されてセルに保存されます。

## デモ
できあがったところで適宜 https://www.mohnet.com/products/JESGOsupport/ も更新します。
