# 通信設計支援システム 全体設計書 v0.6

---

## 1. システム概要

AUTOSARに対応した自動車メーカー独自の通信設計支援システム。複数ECU担当者が管理するExcelファイルをインポートし、150%データセットとして一元管理。サブセット管理・承認フロー・断面管理を備え、通信マトリクスExcel・ARXMLを出力する。

---

## 2. アーキテクチャ

### 技術スタック
```
【開発環境】
React + Vite + TypeScript

【データ永続化】
IndexedDB（Phase1）
ArangoDB（Phase2・Webアプリ化時）

【ビルド成果物】
単一HTMLファイル（JS・CSSインライン化）

【ルーティング】
ハッシュルーティング（/#/path形式）
```

### データアクセス設計方針
```
・正式データへのアクセスは必ずRepository層を経由
・ステータスフィルターをRepository層で強制適用
・IndexedDB時点でデータ構造をArangoDBの
　ドキュメント形式（JSONベース）に寄せて設計
・将来のWebアプリ化時はRepository層のみ差し替え
```

### 将来フェーズ対応方針
```
Phase1（現在）: 単一HTML・IndexedDB・個人検証
Phase2        : Webアプリ化・ArangoDB移行
Phase3        : JSON入力対応・他システム連携・ARXML出力
```

---

## 3. インプットファイル構成

| # | ファイル | 管理主体 | 更新頻度 | 備考 |
|---|---------|---------|---------|------|
| ① | 物理構成Excel | ネットワーク設計者 | 低 | ECUリスト・バス構成・トポロジー・GWリスト |
| ② | 通信データExcel | ECU担当者（部署単位） | 高 | フレーム・シグナル・T/R混在シート・E2E/SecOC設定含む |
| ③ | GW例外指定Excel | ネットワーク設計者 | 中 | 例外ルート定義 |
| ④ | サブセット定義 | ネットワーク設計者 | 低 | 画面入力 |

---

## 4. Excelフォーマット詳細仕様

### ① 物理構成Excel

#### Sheet1: ECUリスト
```
| 列 | 項目名 | 型 | 必須 | 備考 |
|----|-------|-----|------|------|
| A  | ECU名 | 文字列 | ○ | |
| B  | バリナンバー | 文字列 | ○ | ECU名+バリナンバーで一意 |
| C  | 略称(ShortName) | 文字列 | ○ | 命名規則あり |
| D  | 担当部署 | 文字列 | ○ | |
| E  | 備考 | 文字列 | - | |
```

#### Sheet2: バスリスト
```
| 列 | 項目名 | 型 | 必須 | 備考 |
|----|-------|-----|------|------|
| A  | バス名 | 文字列 | ○ | |
| B  | バリナンバー | 文字列 | ○ | バス名+バリナンバーで一意 |
| C  | プロトコル | 文字列 | ○ | CAN/CAN-FD |
| D  | baudRate | 数値 | ○ | bps単位 |
| E  | dataBaudRate | 数値 | - | CAN-FD時のみ必須 |
| F  | 備考 | 文字列 | - | |
```

#### Sheet3: トポロジー（マトリクス形式）
```
・行ヘッダー：ECU名+バリナンバー（Sheet1と一致必須）
・列ヘッダー：バス名+バリナンバー（Sheet2と一致必須）
・セル値：コネクターID（接続あり）/ 空白（接続なし）

例）
               | Body_bus_00 | Body_bus_10 | Engine_bus_00 |
Engine_00（V6）|   CONN_E1   |             |    CONN_E2    |
Engine_10（L4）|             |   CONN_E1   |    CONN_E2    |
Body_00        |   CONN_B1   |             |               |
Body_10        |             |   CONN_B1   |               |
```

#### Sheet4: GWリスト
```
| 列 | 項目名 | 型 | 必須 | 備考 |
|----|-------|-----|------|------|
| A  | GW-ECU名+バリナンバー | 文字列 | ○ | Sheet1と一致必須 |
| B～U | 対応バス1～20 | 文字列 | B列のみ○ | Sheet2のバス名+バリナンバーと一致必須 |
| V  | 備考 | 文字列 | - | |

・1GW-ECUにつき1行
・対応バスは左詰めで記載
・空白セル以降は無効扱い
```

#### 物理構成ExcelのLevel1チェック
```
【Sheet1・Sheet2共通】
・ECU名+バリナンバーの重複 → エラー
・バス名+バリナンバーの重複 → エラー
・ShortNameの重複 → エラー
・CAN-FD選択時にdataBaudRate未記載 → エラー

【Sheet3: トポロジー】
・行ヘッダーがSheet1に存在しない → エラー
・列ヘッダーがSheet2に存在しない → エラー
・コネクターIDの形式不正 → エラー

【Sheet4: GWリスト】
・GW-ECU名+バリナンバーがSheet1に存在しない → エラー
・対応バス名+バリナンバーがSheet2に存在しない → エラー
・対応バスが1つ未満 → エラー
```

---

### ② 通信データExcel

#### Aエリア（コマンド・ステータス）
```
| 列 | 項目名 | 型 | 必須 | 備考 |
|----|-------|-----|------|------|
| A  | 行種別 | 文字列 | ○ | F:フレーム / S:シグナル |
| B  | 要素コマンド | 文字列 | - | 追加/変更(verup)/削除/空白（スキップ） |
| C  | 要素ステータス | 文字列 | - | システム付与・参照のみ |
| D  | ポートコマンド | 文字列 | - | 追加/変更(verup)/削除/空白（スキップ） |
| E  | ポートステータス | 文字列 | - | システム付与・参照のみ |
```

#### コマンド動作定義
```
【要素コマンド】Frame/Signalへの操作
追加        … 新規Frame/Signalを登録（draft）
             published前は同一バージョンを上書き更新
変更(verup) … published済み要素に新バージョンを追加
             既存publishedは履歴として保持
削除        … 論理削除（deleted: true）
空白        … スキップ

【ポートコマンド】FramePort/SignalPortへの操作
追加        … ECUへのPort接続を追加
変更(verup) … published済みPortに新バージョンを追加
削除        … Port論理削除
空白        … スキップ
```

#### コマンド×ステータスの許可マトリクス
```
現在のステータス | 追加 | 変更(verup) | 削除 | 操作者
----------------|------|------------|------|------
未登録           |  ○  |     ✗      |  ✗  | ECU担当者
draft           |  ○  |     ✗      |  ○  | ECU担当者
in_review_1st   |  ✗  |     ✗      |  ✗  | 全員不可
in_review_2nd   |  ○  |     ○      |  ○  | LAN設計マネージャーのみ
approved        |  ✗  |     ✗      |  ✗  | 全員不可
published       |  ✗  |     ○      |  ○  | ECU担当者
```

#### Bエリア（フレームエリア）
```
| 列 | 項目名 | 型 | 必須 | 備考 |
|----|-------|-----|------|------|
| F  | フレーム名 | 文字列 | ○ | F行のみ有効 |
| G  | フレームバリ番号 | 文字列 | ○ | F行のみ・フレーム名+バリ番号で一意 |
| H  | フレーム説明 | 文字列 | - | F行のみ |
| I  | プロトコル | 文字列 | ○ | F行のみ CAN/CAN-FD |
| J  | CAN-ID | 文字列 | ○ | F行のみ 0x形式 |
| K  | DLC | 数値 | ○ | F行のみ 1～8（CAN）1～64（CAN-FD） |
| L  | サイクルタイム | 数値 | ○ | F行のみ ms単位 |
| M  | 送信電源 | 文字列 | ○ | F行のみ +B/ACC/IG カンマ区切りで複数可 |
| N  | イベントフラグ | 文字列 | ○ | F行のみ ON/OFF |
| O  | バージョンNo | 文字列 | ○ | F行のみ メジャー-マイナー形式 |
| P  | E2E有効/無効 | 文字列 | ○ | F行のみ ON/OFF |
| Q  | E2Eプロファイル | 文字列 | - | E2E有効時必須・デフォルト：P02 |
| R  | E2E DataId | 文字列 | - | E2E有効時必須 0x形式 |
| S  | SecOC有効/無効 | 文字列 | ○ | F行のみ ON/OFF |
| T  | SecOC FV方式 | 文字列 | - | SecOC有効時必須 フルFV/トランケートFV |
| U  | SecOC用ID | 文字列 | - | SecOC有効時必須 0x形式 |
```

#### Cエリア（シグナルエリア）
```
| 列 | 項目名 | 型 | 必須 | 備考 |
|----|-------|-----|------|------|
| V  | シグナル名 | 文字列 | ○ | S行のみ有効 |
| W  | シグナルバリ番号 | 文字列 | ○ | S行のみ・シグナル名+バリ番号で一意 |
| X  | シグナル説明 | 文字列 | - | S行のみ |
| Y  | ビット位置 | 数値 | ○ | S行のみ |
| Z  | ビット長 | 数値 | ○ | S行のみ |
| AA | エンディアン | 文字列 | ○ | S行のみ Motorola/Intel |
| AB | イベント条件 | 文字列 | ○ | S行のみ W/C/- |
| AC | 単位 | 文字列 | - | S行のみ 例）km/h・rpm等 |
| AD | 分解能 | 数値 | - | S行のみ 例）0.1・0.5等 |
| AE | 初期値 | 数値 | - | S行のみ |
| AF | フェール値 | 数値 | - | S行のみ |
| AG | バージョンNo | 文字列 | ○ | S行のみ メジャー-マイナー形式 |
```

#### Dエリア（T/Rエリア）
```
・ECU×コネクター単位で列グループを構成
・ECU列数・コネクター数はプロジェクト毎に可変

【ヘッダー行1】ECU名+バリナンバー+コネクターID
【ヘッダー行2】T/R / E2E / SecOC / 途絶時間

【F行の列グループ（1コネクターあたり4列）】
| 項目名 | 型 | 必須 | 備考 |
|-------|-----|------|------|
| T/R | 文字列 | - | T/R/空白 |
| E2E利用 | 文字列 | - | T/R/空白 |
| SecOC利用 | 文字列 | - | T/R/空白 |
| 途絶時間 | 数値 | - | R時のみ有効 ms単位 |

【S行の列グループ（1コネクターあたり4列）】
| 項目名 | 型 | 必須 | 備考 |
|-------|-----|------|------|
| T/R | 文字列 | - | T/R/空白 |
| E2E利用 | 文字列 | - | T/R/空白 |
| SecOC利用 | 文字列 | - | T/R/空白 |
| 途絶時間 | 文字列 | - | 空白固定（F行のみ有効） |

【レイアウトイメージ】
             | ECU-A_00_CONN_A1                | ECU-B_00_CONN_B1                |
             | T/R | E2E | SecOC | 途絶時間    | T/R | E2E | SecOC | 途絶時間    |
F Frame_001  |  T  |  T  |   T   |             |  R  |  R  |   R   |  100ms     |
S Signal_001 |  T  |  T  |   T   |             |  R  |  R  |   R   |             |
S Signal_002 |  T  |     |       |             |  R  |     |       |             |
```

#### 通信データExcelのLevel1チェック
```
【バージョン関連】
・バージョンNo未記載 → エラー
・形式不正（メジャー-マイナー形式以外） → エラー
・既存より古いバージョン指定 → エラー
・published済み要素に「追加」コマンド → エラー
・未登録要素に「変更(verup)」コマンド → エラー
・削除済み要素に「変更(verup)」コマンド → エラー
・「変更(verup)」時にバージョンNoが既存以下 → エラー

【E2E関連】
・E2E有効時にプロファイル未記載 → エラー
・E2E有効時にDataId未記載 → エラー
・プロファイルが規定値以外 → エラー

【SecOC関連】
・SecOC有効時にFV方式未記載 → エラー
・SecOC有効時にSecOC用ID未記載 → エラー

【イベント条件関連】
・フレームイベントフラグOFFで配下シグナルにW/C → エラー
・フレームイベントフラグONで配下シグナル全て「-」→ エラー
・イベント条件未記載 → エラー

【T/R関連】
・T/R空白でE2E/SecOC記載 → エラー
・フレームE2E無効でE2E利用記載 → エラー
・フレームSecOC無効でSecOC利用記載 → エラー
・途絶時間がS行に記載 → エラー
・R以外で途絶時間が記載 → エラー
・FrameがTのコネクターでSignalがR → エラー
・FrameがRのコネクターでSignalがT → エラー
・FrameにT/R記載がないコネクターにSignalのT/R記載 → エラー

【フレームバリ番号関連】
・フレームバリ番号に対応するECUバリナンバーが物理構成に存在しない → エラー
・フレームバリ番号に対応するバスバリナンバーが物理構成に存在しない → エラー
```

---

### ③ GW例外指定Excel

#### Aエリア（コマンド・ステータス）
```
| 列 | 項目名 | 型 | 必須 | 備考 |
|----|-------|-----|------|------|
| A  | コマンド | 文字列 | - | 追加/削除/空白（スキップ） |
| B  | ステータス | 文字列 | - | システム付与・参照のみ |
```

#### Bエリア（経路定義）
```
| 列 | 項目名 | 型 | 必須 | 備考 |
|----|-------|-----|------|------|
| C  | フレーム名 | 文字列 | ○ | 通信データのフレーム名と一致必須 |
| D  | フレームバリ番号 | 文字列 | ○ | フレーム名+バリ番号で特定 |
| E  | 送信元バス名 | 文字列 | ○ | 物理構成Sheet2と一致必須 |
| F  | 送信元バスバリ番号 | 文字列 | ○ | バス名+バリ番号で特定 |
| G  | 受信先バス名 | 文字列 | ○ | 物理構成Sheet2と一致必須 |
| H  | 受信先バスバリ番号 | 文字列 | ○ | バス名+バリ番号で特定 |
| I  | GWバリ番号 | 文字列 | ○ | 同一世代内GWバリを識別 |
| J～Y | 経由GW-ECU名+バリナンバー 1～20 | 文字列 | J列のみ○ | 物理構成Sheet1と一致必須 |
| Z  | 備考 | 文字列 | - | |
```

#### 一意キー定義
```
フレーム名 + フレームバリ番号
+ 送信元バス名 + 送信元バスバリ番号
+ 受信先バス名 + 受信先バスバリ番号
+ GWバリ番号
→ この組み合わせで1経路を一意に識別
```

#### GW例外指定ExcelのLevel1チェック
```
・フレーム名+バリ番号が通信データに存在しない → エラー
・送信元/受信先バス名+バリ番号が物理構成に存在しない → エラー
・経由GW-ECU名+バリナンバーが物理構成に存在しない → エラー
・経由GWが物理構成GWリストに登録されていない → エラー
・送信元バスと受信先バスが同一 → エラー
・一意キーの重複 → エラー
・コマンド「削除」対象が未登録 → エラー
・経由GW列が空白（J列必須） → エラー
```

---

## 5. データモデル

### ステータス定義
```
draft          … 申請書作成中
in_review_1st  … 一次承認待ち（ECU部署上司）
in_review_2nd  … 二次承認待ち（LAN設計マネージャー）
approved       … 承認済（断面確定待ち）
published      … 断面確定済（正式公開）
rejected       … 却下
withdrawn      … 引き戻し済
```

### ステータス遷移
```
draft
　↓ 申請提出
in_review_1st
　↓ 一次承認（ECU部署上司・全員必須）
in_review_2nd
　↓ 二次承認（LAN設計マネージャー・全員必須）
approved
　↓ 断面確定（ネットワーク設計者）
published
　※断面確定の瞬間にスナップショットを永続化

差し戻し：in_review_1st → draft（一次承認者）
却下　　：in_review_2nd → draft（二次承認者）
引き戻し：draft へ戻る（申請者本人・二次承認完了前まで）
```

### 150%データセット
```
・publishedステータスのデータが正式公開領域
・approvedは承認済だが断面未確定の待機状態
・サブセット定義によりフィルタリングして参照
・Repository層でステータスフィルターを強制適用
```

### 論理削除
```
・削除はフラグ管理（deleted: true）
・バージョン履歴として保持
・Frame・Signal参照画面：デフォルト非表示
　└「削除済を含む」トグルで表示切替
・過去断面参照時：当時存在していれば表示
```

---

## 6. サブセット管理

```
【サブセット軸】
・世代（Gen1・Gen2 等）
・パワトレ種別（HEV・EV 等）
・組み合わせ数：1世代あたり一桁

【150%モデル思想】
・全世代・全パワトレの全ECU/バスを一元管理
・サブセット定義でECU・コネクター・バスの
　有効接続を指定（記載あり＝有効・記載なし＝無効）
・出力時に選択サブセットでフィルタリング

【サブセットフィルタリング解決ロジック】
Step1: variants.ecuConnectorsから有効ECU一覧・有効Bus一覧を取得
Step2: ecus.connectors.framePortsの中から有効ECUに含まれるものだけ抽出
Step3: ecus.connectors.signalPortsの中から有効ECUに含まれるものだけ抽出
Step4: gwRoutesの中から有効Busに含まれる経路のみ抽出
```

---

## 7. システム内部処理フロー

```
Step1: 申請書作成
　└ 件名・変更概要・コメント入力
　└ Excelファイル登録

Step2: DB取込＆Level1チェック
　└ Excelパース・DB取込（draft）
　└ 物理構成・通信データ・GW例外指定の各Level1チェック実行
　└ インポートExcelをBlobとしてDB保管
　└ チェック結果を申請者に表示
　└ エラーあり → 申請者が修正・再登録

Step3: Level2チェック（サブセット単位）
　└ チェック単位：世代×パワトレの全組み合わせ
　└ チェック項目：
　　 ・CAN ID重複
　　 ・ビット位置重複
　　 ・孤立Tx/Rx
　　 ・物理構成との不整合
　　 ・GW経路妥当性
　　 ・E2E予約領域と既存Signalのビット重複
　　 ・SecOC予約領域と既存Signalのビット重複
　　 ・E2EとSecOC予約領域同士の重複
　　 ・DLC内にE2E＋SecOC＋全Signalが収まるか
　└ サブセット別チェック結果レポートを申請書に添付
　└ エラーありでも申請提出可能（承認者が判断）
　└ 実行条件：物理構成取込済・サブセット定義登録済

Step4: 申請提出
　└ draft → in_review_1stへ遷移

Step5: 承認フロー
　└ 一次承認（ECU部署上司・全員必須）
　　 └ 承認 → in_review_2ndへ
　　 └ 差し戻し → draftへ（コメント必須）
　└ 二次承認（LAN設計マネージャー・全員必須）
　　 └ Excel再インポートまたは画面直接編集可能
　　 └ 編集履歴を申請書に記録
　　 └ 一次承認やり直し不要
　　 └ 承認 → approvedへ
　　 └ 却下 → draftへ（コメント必須）

Step6: GW経路自動生成
　└ Tx/Rxのバス差異から自動生成
　└ GW例外指定ファイルで上書き

Step7: 断面確定（ネットワーク設計者）
　└ approved → publishedへ遷移
　└ スナップショット永続化
　└ 変更履歴記録（前回published断面との差分）
```

---

## 8. 承認フロー詳細

```
【申請】ECU担当者
　└ 申請書作成（件名・変更概要・コメント）
　└ Excelファイル登録・Level1/Level2チェック確認
　└ インポートExcelをDB保管
　└ 引き戻し可能：二次承認完了前まで
　↓
【一次承認】ECU部署上司（複数人・全員必須）
　└ 申請書・インポート内容・チェック結果を確認
　└ インポートExcelダウンロード可能
　└ 全員承認 → in_review_2ndへ
　└ 差し戻し → draftへ（コメント必須）
　↓
【二次承認】LAN設計マネージャー（複数人・全員必須）
　└ 申請書・インポート内容・チェック結果を確認
　└ インポートExcelダウンロード可能
　└ Excel再インポートまたは画面直接編集可能
　　 └ Frame/Signalプロパティ編集
　　 └ T/Rポート編集
　└ 編集履歴を申請書に記録
　└ 一次承認やり直し不要
　└ 全員承認 → approvedへ
　└ 却下 → draftへ（コメント必須）
　↓
【断面確定】ネットワーク設計者
　└ 任意タイミングで断面確定
　└ publishedへ遷移・スナップショット永続化
　└ 変更履歴記録
```

---

## 9. GW経路生成

```
【自動生成ロジック】
あるフレームのTxがバスXに存在し
同じフレームのRxがバスYに存在する
→ バスX-バスY間のGWルーティングを自動生成
　（物理構成のGWリストから経路を解決）

【例外指定による上書き】
・GW例外指定Excelで明示的な経路を指定
・自動生成結果を上書き
・用途：トポロジー上に複数経路が存在する場合の強制ルーティング指定
```

---

## 10. バージョン管理

```
【対象】Frame・Signal単位で個別管理

【採番方式】現フェーズ：ユーザー手動指定
　└ 指定場所：通信データExcel内（要素単位）
　└ 形式：メジャー-マイナー（00-a, 01-a, 01-b 等）
　└ 将来：変更プロパティ検出による自動採番

【削除要素のバージョン管理】
　└ 削除フラグ（deleted: true）で論理削除
　└ 削除バージョンとして履歴に保持
　└ 過去断面参照時は当時の状態を表示
```

---

## 11. E2E・SecOC対応

```
【適用単位】Frame単位

【ビットレイアウト】
┌─────────────────────────────┐
│ E2Eヘッダー領域（先頭側）      │
│ 予約ビット：24bit固定          │
│ reservedStartBit：0固定       │
├─────────────────────────────┤
│ 通常Signal領域               │
├─────────────────────────────┤
│ SecOC領域（末尾側）           │
│ トランケートFV：32bit          │
│ Full FV　　　：88bit          │
│ reservedStartBit：DLC×8 - SecOC予約ビット │
└─────────────────────────────┘

【E2E+SecOC併用時の利用可能Signal領域】
トランケートFV時：DLC×8 - 24 - 32
Full FV時　　　：DLC×8 - 24 - 88
```

---

## 12. 断面管理・変更履歴

```
【断面管理】
・ネットワーク設計者が任意タイミングで断面確定
・断面確定の瞬間にpublishedステータスへ更新
・その時点のデータスナップショットを永続化
・断面には通番・確定日時・確定者を記録

【変更履歴】
・記録粒度：フレーム・シグナル単位
・前回published断面との差分を記録
・追加・変更・削除を区別して記録
・出力：ECU単位シートで出力
```

---

## 13. アウトプット一覧

| # | 出力物 | 対象データ | 備考 |
|---|-------|----------|------|
| ① | 全体通信マトリクスExcel | published | ECU単位シート・サブセット選択対応 |
| ② | ARXML | published | AUTOSAR準拠（Phase3） |
| ③ | エラーチェック結果レポート | draft/in_review | Level1・Level2別・サブセット別 |
| ④ | 変更履歴Excel | published断面間差分 | ECU単位シート |
| ⑤ | インポート雛形Excel | published/draft | ECU・フレーム選択対応 |

---

## 14. 画面構成・遷移設計

### 画面一覧

| 画面ID | 画面名 | URL | 備考 |
|-------|-------|-----|------|
| P00 | ロール切替 | /#/role | |
| P01 | ホーム | /#/ | |
| P10 | LAN構成管理 | /#/lan-config | |
| P11 | サブセット管理 | /#/subsets | |
| P20 | 申請書管理 | /#/applications | |
| P21 | 申請書作成 | /#/applications/new | P20のサブ画面 |
| P22 | 申請書詳細 | /#/applications/{id} | P20のサブ画面 |
| P23 | 承認操作 | /#/applications/{id}/approve | P22のサブ画面 |
| P30 | Frame・Signal参照 | /#/frame-signal | |
| P31 | サブセット別参照 | /#/frame-signal/subset | |
| P33 | Frame詳細（独立） | /#/frames/{frameId} | P30/P31からの遷移 |
| P34 | Signal詳細（独立） | /#/signals/{signalId} | P30/P31からの遷移 |
| P40 | ECU Port参照 | /#/ecu-port | |
| P50 | 公開バージョン一覧 | /#/snapshots | |
| P51 | 変更履歴 | /#/changelogs | |
| P60 | 出力 | /#/export | |
| P70 | アクセス権管理 | /#/access-control | |

### URLクエリパラメータ
```
/#/frames/{frameId}?version=01-a&subset=Gen1_HEV
/#/signals/{signalId}?version=00-a&subset=Gen1_HEV
```

### サイドメニュー構成（折り畳み可能）
```
▼ ダッシュボード
　└ P01: ホーム

▼ マスタ管理
　├ P10: LAN構成管理
　└ P11: サブセット管理

▼ 申請・承認
　└ P20: 申請書管理

▼ データ参照
　├ P30: Frame・Signal参照
　├ P31: サブセット別参照
　└ P40: ECU Port参照

▼ 断面管理
　├ P50: 公開バージョン一覧
　└ P51: 変更履歴

▼ 出力
　└ P60: 出力

▼ システム管理
　└ P70: アクセス権管理
```

### ロール別メニュー活性・非活性（初期値）

```
メニュー項目          | ECU担当者 | ECU部署上司 | LANマネージャー | NW設計者
---------------------|---------|-----------|--------------|--------
P01: ホーム           |   ○     |    ○      |      ○       |   ○
P10: LAN構成管理      |   ✗     |    ✗      |      ✗       |   ○
P11: サブセット管理    |   ✗     |    ✗      |      ✗       |   ○
P20: 申請書管理        |   ○     |    ○      |      ○       |   ○
P30: Frame・Signal参照 |   ○     |    ○      |      ○       |   ○
P31: サブセット別参照  |   ○     |    ○      |      ○       |   ○
P40: ECU Port参照     |   ○     |    ○      |      ○       |   ○
P50: 公開バージョン一覧|   ✗     |    ✗      |      ✗       |   ○
P51: 変更履歴         |   ○     |    ○      |      ○       |   ○
P60: 出力             |   ○     |    ○      |      ○       |   ○
P70: アクセス権管理    |   ✗     |    ✗      |      ✗       |   ○
※上記はシステム初期値・P70から変更可能
```

### 各画面詳細

#### P01: ホーム画面
```
┌─────────────────────────────────┐
│ ようこそ {ロール名}さん           │
├──────────┬──────────┬───────────┤
│ 申請書    │ 承認待ち  │ 直近断面   │
│ サマリー  │ 件数      │ 情報       │
│           │           │           │
│ 作成中: 2 │ 自分が    │ 断面No: 5  │
│ 回覧中: 1 │ 承認すべき│ 確定日時   │
│ 承認済: 3 │ 件数: 3件 │ 確定者     │
│           │           │ 追加: 3件  │
│           │           │ 変更: 5件  │
│           │           │ 削除: 1件  │
├──────────┴──────────┴───────────┤
│ 自分に関係する申請書（直近5件）   │
│ 申請書名 │ステータス│更新日時      │
│ 申請書A  │回覧中    │01/10        │
│ 申請書B  │作成中    │01/09        │
│ └→ クリックでP22へ              │
├─────────────────────────────────┤
│ お知らせ                         │
│ ・[01/10] 申請書Aの承認依頼      │
│ ・[01/09] 申請書Bが差し戻されました│
│ ・[01/08] 断面No.5が確定しました  │
└─────────────────────────────────┘
```

#### P10: LAN構成管理画面
```
・物理構成Excelを一括インポート
・タブ切替でECUリスト／バスリスト／トポロジー／GWリストを表示
・参照のみ（直接編集不可）
```

#### P11: サブセット管理画面
```
・サブセット一覧（新規追加・編集・削除）
・ECU×バス割り当てマトリクス（コネクターIDは選択式）
・物理構成から有効なコネクターのみ表示
```

#### P20: 申請書管理画面
```
・[自分の申請書] [ALL表示] トグル切替
・自分に関係する申請書をデフォルト表示
・[新規作成]ボタン → P21へ遷移
・行クリック → P22へ遷移
```

#### P21: 申請書作成画面（P20のサブ画面）
```
・件名・変更概要・コメント入力
・Excelファイル登録
・Level1/Level2チェック自動実行・結果表示
・保存（draft）または申請提出（in_review_1st）
```

#### P22: 申請書詳細画面（P20のサブ画面）
```
・申請書情報・チェック結果・承認履歴・編集履歴表示
・引き戻しボタン（申請者・回覧中のみ）
・承認操作ボタン（承認者のみ）→ P23へ
```

#### P23: 承認操作画面（P22のサブ画面）
```
・申請書詳細・チェック結果表示
・変更分のみのインポート内容確認
・インポートExcelダウンロード
・承認履歴・編集履歴表示
・コメント入力欄
・【一次承認】承認 / 差し戻し
・【二次承認】承認 / 却下 / Excel再インポート / 画面直接編集
　└ Frame/Signalプロパティ編集
　└ T/Rポート編集
```

#### P30: Frame・Signal参照画面
```
【レイアウト】左右ペイン構成

┌──────────────┬──────────────────────────────┐
│ 左ペイン      │ 右ペイン                      │
│ ツリー表示    │ Frame詳細                     │
│               │                               │
│ ▼ Frame_001  │ Frame_001 (01-a)              │
│   Signal_001  │ CAN-ID: 0x100 DLC: 8         │
│   Signal_002  │ 周期: 10ms E2E: ON           │
│ ▼ Frame_002  │                               │
│   Signal_003  │ 【ビット配置マトリクス】       │
│               │ bit 7  6  5  4  3  2  1  0   │
│               │ ┌──────────────────────────┐ │
│               │ │ [  E2E Header 24bit     ]│ │
│               │ ├──────────────────────────┤ │
│               │ │ [Sig_001: 8bit ]         │ │
│               │ ├──────────────────────────┤ │
│               │ │ [Sig_002: 16bit          ]│ │
│               │ ├──────────────────────────┤ │
│               │ │ [ SecOC 32bit           ]│ │
│               │ └──────────────────────────┘ │
│               │ ※Signal選択でハイライト表示   │
│               │                               │
│               │ 【送受信ECU（参考）】          │
│               │ ECU-A_00: T                   │
│               │ ECU-B_00: R                   │
└──────────────┴──────────────────────────────┘

【ビット配置マトリクス仕様】
・DLC×8bitを視覚的に表現
・1行8bit（1byte）で折り返し
・各Signalをブロックで色分け表示
・E2E予約領域：先頭から固定色で表示
・SecOC予約領域：末尾から固定色で表示
・通常Signal領域：Signal毎に色分け
・Signal名クリック → 該当ビット領域をハイライト
・ビット領域クリック → そのSignal詳細を右ペインに表示
・ツールチップ → Signal名・ビット位置・ビット長を表示

【凡例】
■ E2E予約領域
■ SecOC予約領域
■ Signal_001
■ Signal_002
□ 未使用領域

・[独立画面で開く] → P33/P34へ
・バージョン履歴は右ペインの拡張パネルとして表示
　（1つ前のバージョンとの変化点を色付けで表示）
・削除済表示トグル
```

#### P31: サブセット別参照画面
```
【レイアウト】サブセット選択 → マトリクス表示

┌─────────────────────────────────────┐
│ サブセット選択：[Gen1_HEV ▼]        │
├─────────────────────────────────────┤
│           │ ECU-A_00      │ ECU-B_00 │
│           │ CONN_A1│CONN_A2│CONN_B1  │
├──────────┼────────┼───────┼─────────┤
│ Frame_001 │   T    │       │    R    │
│ Signal_001│   T    │       │    R    │
│ Signal_002│   T    │       │    R    │
│ Frame_002 │        │   R   │    T    │
│ Signal_003│        │   R   │    T    │
├─────────────────────────────────────┤

・サブセット選択で有効ECUバリ・Frame・Signalをフィルタリング
・行：Frame/Signal（Frameの直下にSignalを表示）
・列：ECUバリ×コネクター
・T/Rのマトリクス表示
・行クリック → P33/P34へ
```

#### P40: ECU Port参照画面
```
【レイアウト】ECU選択 → マトリクス表示 → Port詳細

┌─────────────────────────────────────┐
│ ECU選択：[ECU-A ▼]                  │
├─────────────────────────────────────┤
│ [FramePort] [SignalPort] タブ切替    │
├──────────┬──────────────────────────┤
│           │ ECU-A_00      │ ECU-A_10 │
│           │ CONN_A1│CONN_A2│CONN_A1  │
├──────────┼────────┼───────┼─────────┤
│ Frame_001 │ P-Port │       │ R-Port  │
│ Frame_002 │ R-Port │       │         │
│ Frame_003 │        │ R-Port│ P-Port  │
├──────────┴────────┴───────┴─────────┤
│ ※Port行を選択 → 下部にPort詳細表示  │
├─────────────────────────────────────┤
│ 【Port詳細】Frame_001 / ECU-A_00     │
│ 方向: P-Port                         │
│ E2E: ON / SecOC: ON / 途絶時間: -   │
├─────────────────────────────────────┤
│ [申請書を作成して更新]ボタン          │
│ ※ECU担当者・NW設計者のみ表示         │
└─────────────────────────────────────┘

【権限】
・参照：全ロール
・更新：ECU担当者（自担当ECUのみ）・NW設計者（全ECU）
・更新は申請書経由（承認フローを通す）
```

#### P33: Frame詳細画面（独立）
```
・左右ペイン構成
・左：ビット配置マトリクス（P30と同様）
・右：プロパティ一覧
　└ 表示バージョン選択
　└ 比較元バージョン選択（デフォルト：直前バージョン）
　└ 変更あり：前回値 → ★今回値（色付け）
・T/Rポート一覧
・所属Signal一覧（クリックでP34へ）
URL: /#/frames/{frameId}?version=01-a&subset=Gen1_HEV
```

#### P34: Signal詳細画面（独立）
```
・プロパティ一覧
　└ 表示バージョン選択
　└ 比較元バージョン選択（デフォルト：直前バージョン）
　└ 変更あり：前回値 → ★今回値（色付け）
・T/Rポート一覧
URL: /#/signals/{signalId}?version=01-b&subset=Gen1_HEV
```

#### P50: 公開バージョン一覧画面
```
・断面一覧（通番・確定日時・確定者）
・断面確定操作（approved→published）※NW設計者のみ
・過去断面クリック → P30でその断面のデータ表示
・変更履歴ボタン → P51へ
```

#### P51: 変更履歴画面
```
・比較断面選択
・ECU絞り込み・変更種別フィルター
・ECU単位グループで差分表示
・行クリック → P33/P34へ
```

#### P60: 出力画面
```
・全体通信マトリクスExcel出力（サブセット選択・断面選択）
・変更履歴Excel出力（比較断面選択・ECU選択）
・エラーチェック結果レポート出力（申請書選択）
・インポート雛形出力（ECU複数選択・フレーム選択・サブセット選択）
```

#### P70: アクセス権管理画面
```
・ロール×画面マトリクス表示
・活性/非活性をトグルで変更・保存
・初期値リセットボタン
```

### 画面遷移全体図
```
P00: ロール切替
　↓
P01: ホーム
　├→ P20: 申請書管理
　│    ├→ P21: 申請書作成 → P20
　│    └→ P22: 申請書詳細
　│         └→ P23: 承認操作 → P20
　├→ P10: LAN構成管理
　├→ P11: サブセット管理
　├→ P30: Frame・Signal参照
　│    ├→ P33: Frame詳細（独立）
　│    └→ P34: Signal詳細（独立）
　├→ P31: サブセット別参照
　│    ├→ P33: Frame詳細（独立）
　│    └→ P34: Signal詳細（独立）
　├→ P40: ECU Port参照
　├→ P50: 公開バージョン一覧
　│    └→ P51: 変更履歴
　│         ├→ P33: Frame詳細（独立）
　│         └→ P34: Signal詳細（独立）
　├→ P51: 変更履歴
　├→ P60: 出力
　└→ P70: アクセス権管理
```

---

## 15. ロール定義

| ロール | 主な権限 | 検証フェーズ |
|-------|---------|------------|
| ECU担当者 | 申請書作成・Excel登録・引き戻し・自担当ECU Port更新 | ロール切替で再現 |
| ECU部署上司 | 一次承認・差し戻し | ロール切替で再現 |
| LAN設計マネージャー | 二次承認・却下・in_review_2nd時編集 | ロール切替で再現 |
| ネットワーク設計者 | LAN構成管理・サブセット管理・断面確定・全出力・全ECU Port更新・アクセス権管理 | ロール切替で再現 |

---

## 16. IndexedDBスキーマ

### 設計方針
```
・各ドキュメントは_idをキーとしたJSONオブジェクト
・ArangoDBのコレクション構造に寄せた設計
・代表プロパティのみ定義・詳細は実装時に拡張
・共通メタデータを全ドキュメントに付与
```

### 共通メタデータ
```json
{
  "_id": "コレクション名/UUID",
  "createdAt": "2024-01-10T00:00:00Z",
  "createdBy": "ロールID",
  "updatedAt": "2024-01-10T00:00:00Z",
  "updatedBy": "ロールID",
  "deleted": false
}
```

### 1. projects
```json
{
  "_id": "projects/UUID",
  "name": "プロジェクト名",
  "description": "説明",
  "status": "active"
}
```

### 2. variants（サブセット定義）
```json
{
  "_id": "variants/UUID",
  "projectId": "projects/UUID",
  "generation": "Gen1",
  "powerTrain": "HEV",
  "name": "Gen1_HEV",
  "ecuConnectors": [
    {
      "ecuId": "ecus/UUID-A",
      "connectors": [
        { "connectorId": "CONN_A1", "busId": "buses/UUID-1" },
        { "connectorId": "CONN_A2", "busId": "buses/UUID-2" }
      ]
    },
    {
      "ecuId": "ecus/UUID-B",
      "connectors": [
        { "connectorId": "CONN_B1", "busId": "buses/UUID-1" }
      ]
    }
  ]
}
```

### 3. ecus
```json
{
  "_id": "ecus/UUID",
  "projectId": "projects/UUID",
  "name": "ECU-A",
  "variantNo": "00",
  "shortName": "ECUA",
  "department": "部署名",
  "connectors": [
    {
      "connectorId": "CONN_A1",
      "name": "Connector_A1",
      "busConnections": [
        {
          "busId": "buses/UUID-1",
          "variantIds": ["variants/UUID-Gen1-HEV"]
        }
      ],
      "framePorts": [
        {
          "framePortId": "FP_A1_001",
          "frameId": "frames/UUID",
          "direction": "P-Port",
          "e2eEnabled": true,
          "secocEnabled": true,
          "timeoutMs": null
        },
        {
          "framePortId": "FP_A1_002",
          "frameId": "frames/UUID-2",
          "direction": "R-Port",
          "e2eEnabled": true,
          "secocEnabled": false,
          "timeoutMs": 100
        }
      ],
      "signalPorts": [
        {
          "signalPortId": "SP_A1_001",
          "signalId": "signals/UUID",
          "direction": "P-Port",
          "e2eEnabled": true,
          "secocEnabled": true
        },
        {
          "signalPortId": "SP_A1_002",
          "signalId": "signals/UUID-2",
          "direction": "R-Port",
          "e2eEnabled": false,
          "secocEnabled": false
        }
      ]
    }
  ],
  "status": "published",
  "deleted": false
}
```

### 4. buses
```json
{
  "_id": "buses/UUID",
  "projectId": "projects/UUID",
  "name": "CAN-Bus1",
  "variantNo": "00",
  "protocol": "CAN-FD",
  "baudRate": 500000,
  "dataBaudRate": 2000000,
  "status": "published",
  "deleted": false
}
```

※CANの場合はdataBaudRateはnull

### 5. frames
```json
{
  "_id": "frames/UUID",
  "projectId": "projects/UUID",
  "applicationId": "applications/UUID",
  "name": "Frame_001",
  "variantNo": "00",
  "description": "フレーム説明",
  "protocol": "CAN-FD",
  "canId": "0x100",
  "dlc": 8,
  "cycleTime": 10,
  "powerSource": ["+B", "IG"],
  "eventFlag": true,
  "versionNo": "01-a",
  "e2e": {
    "enabled": true,
    "profile": "P02",
    "dataId": "0x0001",
    "reservedBits": 24,
    "reservedStartBit": 0
  },
  "secoc": {
    "enabled": true,
    "fvMethod": "トランケートFV",
    "secocId": "0x0001",
    "reservedBits": 32,
    "reservedStartBit": 32
  },
  "status": "published",
  "deleted": false
}
```

### 6. signals
```json
{
  "_id": "signals/UUID",
  "projectId": "projects/UUID",
  "frameId": "frames/UUID",
  "applicationId": "applications/UUID",
  "name": "Signal_001",
  "variantNo": "00",
  "description": "シグナル説明",
  "bitPosition": 0,
  "bitLength": 8,
  "endian": "Motorola",
  "eventCondition": "W",
  "unit": "km/h",
  "resolution": 0.1,
  "initialValue": 0,
  "failValue": 255,
  "versionNo": "01-a",
  "status": "published",
  "deleted": false
}
```

### 7. versionHistories
```json
{
  "_id": "versionHistories/UUID",
  "projectId": "projects/UUID",
  "targetType": "frame",
  "targetId": "frames/UUID",
  "versionNo": "00-a",
  "applicationId": "applications/UUID",
  "changedAt": "2024-01-10T00:00:00Z",
  "snapshot": {}
}
```

### 8. applications
```json
{
  "_id": "applications/UUID",
  "projectId": "projects/UUID",
  "title": "件名",
  "description": "変更概要",
  "comment": "コメント",
  "status": "in_review_1st",
  "applicantId": "ロールID",
  "importFileRef": "インポートファイル参照",
  "importFileBlob": "IndexedDBにBlobとして保管",
  "editHistories": [
    {
      "editedAt": "2024-01-10T00:00:00Z",
      "editedBy": "ロールID",
      "stage": "in_review_2nd",
      "method": "excel",
      "changes": []
    }
  ],
  "checkResults": {
    "level1": {
      "status": "error",
      "errors": [],
      "warnings": []
    },
    "level2": {
      "Gen1_HEV": { "status": "ok", "errors": [], "warnings": [] },
      "Gen1_EV": { "status": "error", "errors": [], "warnings": [] }
    }
  }
}
```

### 9. approvals
```json
{
  "_id": "approvals/UUID",
  "applicationId": "applications/UUID",
  "stage": "1st",
  "approverId": "ロールID",
  "action": "approved",
  "comment": "承認コメント",
  "actionAt": "2024-01-10T00:00:00Z"
}
```

### 10. gwRoutes
```json
{
  "_id": "gwRoutes/UUID",
  "projectId": "projects/UUID",
  "frameId": "frames/UUID",
  "frameVariantNo": "00",
  "sourceBusId": "buses/UUID",
  "targetBusId": "buses/UUID",
  "gwVariantNo": "00",
  "viaGwIds": ["ecus/UUID-GW1"],
  "isException": false,
  "applicationId": "applications/UUID",
  "status": "published",
  "deleted": false
}
```

### 11. snapshots
```json
{
  "_id": "snapshots/UUID",
  "projectId": "projects/UUID",
  "sequenceNo": 1,
  "confirmedAt": "2024-01-10T00:00:00Z",
  "confirmedBy": "ロールID",
  "ecuIds": ["ecus/UUID-A", "ecus/UUID-B"],
  "busIds": ["buses/UUID-1"],
  "frameIds": ["frames/UUID"],
  "signalIds": ["signals/UUID"],
  "gwRouteIds": ["gwRoutes/UUID"]
}
```

### 12. changelogs
```json
{
  "_id": "changelogs/UUID",
  "projectId": "projects/UUID",
  "snapshotId": "snapshots/UUID",
  "previousSnapshotId": "snapshots/UUID",
  "changes": [
    {
      "type": "added",
      "targetType": "frame",
      "targetId": "frames/UUID",
      "ecuId": "ecus/UUID-A",
      "before": {},
      "after": {}
    },
    {
      "type": "modified",
      "targetType": "signal",
      "targetId": "signals/UUID",
      "ecuId": "ecus/UUID-A",
      "before": {},
      "after": {}
    },
    {
      "type": "deleted",
      "targetType": "frame",
      "targetId": "frames/UUID",
      "ecuId": "ecus/UUID-A",
      "before": {},
      "after": {}
    }
  ]
}
```

### 13. accessControls
```json
{
  "_id": "accessControls/UUID",
  "projectId": "projects/UUID",
  "screenId": "P20",
  "screenName": "申請書管理",
  "permissions": {
    "ECU担当者": true,
    "ECU部署上司": true,
    "LANマネージャー": true,
    "NW設計者": true
  },
  "updatedAt": "2024-01-10T00:00:00Z",
  "updatedBy": "ロールID"
}
```

### コレクション関連図
```
projects
　├── variants（サブセット定義）
　│    └── ecuConnectors → ecus, buses（有効接続の正）
　├── ecus
　│    └── connectors（embedded）
　│         ├── busConnections → buses, variants
　│         ├── framePorts    → frames
　│         └── signalPorts   → signals
　├── buses
　├── frames
　│    └── signals
　├── versionHistories → frames / signals
　├── gwRoutes → frames, buses
　├── applications
　│    └── approvals
　├── snapshots
　│    ├── ecus / buses / frames / signals / gwRoutes
　├── changelogs
　│    ├── snapshots（current）
　│    └── snapshots（previous）
　└── accessControls
```

### ステータス適用コレクション一覧
```
ステータス管理対象
　├── ecus / buses / frames / signals / gwRoutes / applications

ステータス管理対象外（マスタ・履歴系）
　├── projects / variants / approvals / versionHistories
　├── snapshots / changelogs / accessControls
```
