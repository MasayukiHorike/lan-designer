# LAN Designer 実装プラン v1.0

---

## 1. プロジェクト概要

AUTOSARに対応した自動車メーカー独自の通信設計支援システム。
React + Vite + TypeScript で開発し、単一HTMLファイルとしてビルドする。

---

## 2. MVP定義

**目標：ExcelインポートしてFrame/Signalが参照できる状態**

以下が一通り動く状態をMVPとする。

```
1. 物理構成Excelをインポート
   → ECU・バス・トポロジー・GWがDBに登録される

2. サブセットを画面で定義
   → ECU/コネクター・バスバリの割り当てが登録される

3. 申請書を作成して通信データExcelを登録
   → Level1/Level2チェックが実行される

4. 承認フローを経てDBに取込
   → Frame・SignalがDBに登録される

5. P30 Frame・Signal参照画面で確認
   → ツリー表示・ビット配置マトリクス・詳細表示ができる
```

---

## 3. 実装フェーズ

### Phase1-1: 基盤構築
**目標：開発環境・共通基盤の整備**

```
【タスク】
□ React + Vite + TypeScript プロジェクト初期設定
□ 単一HTMLファイルビルド設定（vite.config.ts）
□ IndexedDB初期化・共通ユーティリティ
□ Repository層の基底クラス・インターフェース定義
□ 全コレクションのRepository実装
  └ projects / variants / ecus / buses / frames / signals
  └ versionHistories / applications / approvals
  └ gwRoutes / snapshots / changelogs
  └ subsetHistories / accessControls
□ 共通レイアウト（サイドメニュー・ヘッダー）
□ ハッシュルーティング設定
□ ロール切替画面（P00）
□ ホーム画面（P01）の骨格
```

### Phase1-2: LAN構成管理
**目標：物理構成・サブセット定義の登録**

```
【タスク】
□ P10: LAN構成管理画面
  └ 物理構成Excelパース（Sheet1～4）
  └ Level1チェック実装
  └ ECU/バス/トポロジー/GWリストのタブ表示
  └ 差分更新ロジック（追加・変更）
  └ 行削除（参照チェック・警告ダイアログ）
  └ エラーリスト表示領域
□ P11: サブセット管理画面
  └ ECU/コネクター×サブセット マトリクス表示
  └ バスバリ×サブセット マトリクス表示
  └ チェックボックスで割り当て設定
  └ [保存]ボタンで一括確定
  └ サブセット追加・削除
  └ 変更履歴記録（subsetHistories）
```

### Phase1-3: 申請・承認フロー
**目標：申請書の作成・回覧・承認が動作する状態**

```
【タスク】
□ P20: 申請書管理一覧
  └ 自分の申請書/ALL表示トグル
  └ ステータスフィルター
  └ 申請書番号自動採番
     （APP-{ECU名}-{年月日}-{連番2桁}）
□ P21: 申請書作成
  └ 基本情報入力（件名・変更概要・コメント）
  └ ECU単位ファイル登録（通信データ・GW例外指定）
  └ 承認者指定（メールアドレス入力）
  └ Level1チェック自動実行（ファイル登録直後）
  └ Level2チェック自動実行（Level1後）
  └ チェック結果表示
  └ 一時保存・申請提出
□ P22: 申請書詳細
  └ 申請基本情報表示
  └ 登録ファイル一覧・ダウンロード
  └ チェック結果表示
  └ ステータス・承認状況表示
  └ 引き戻し操作
□ P23: 承認操作
  └ インポート内容確認（差分/全件切替）
  └ 一次承認・差し戻し（ECU承認者）
  └ 二次承認・却下（LAN承認者）
  └ LAN承認者による直接編集
     └ Frame/Signalプロパティ編集
     └ FramePort/SignalPort編集
```

### Phase1-4: 通信データDB取込
**目標：承認済みデータがDBに反映される**

```
【タスク】
□ 通信データExcelパース
  └ Aエリア（コマンド・ステータス）
  └ Bエリア（フレームエリア）
  └ Cエリア（シグナルエリア）
  └ Dエリア（T/Rエリア：ECU×コネクター単位）
□ GW例外指定Excelパース
□ Level1チェック実装
  └ バージョン関連チェック
  └ E2E/SecOC関連チェック
  └ イベント条件関連チェック
  └ T/R関連チェック
  └ フレームバリ番号関連チェック
□ Level2チェック実装（サブセット単位）
  └ CAN ID重複チェック
  └ ビット位置重複チェック
  └ 孤立Tx/Rxチェック
  └ 物理構成との不整合チェック
  └ E2E/SecOC予約領域チェック
□ 承認完了後のDB反映処理
  └ frames / signals / ecus(FramePort/SignalPort)登録
  └ gwRoutes自動生成・例外指定上書き
  └ ステータス管理（draft→in_review→approved）
```

### Phase1-5: Frame・Signal参照
**目標：MVPの完成**

```
【タスク】
□ P30: Frame・Signal参照画面
  └ 左ペイン：ECU→Frame→Signalツリー表示
  └ 削除済みアイコン表示・トグル
  └ 検索欄によるフィルタリング
  └ 右ペイン：Frame詳細
     └ プロパティ一覧＋エラーアイコン（✓⚠✗）
     └ ビット配置マトリクス（グラフィカル表示）
        └ E2E予約領域・SecOC予約領域・Signal領域を色分け
        └ Signal選択でハイライト
        └ ツールチップ（Signal名・ビット位置・ビット長）
     └ 送受信ECU参考表示
     └ バージョン履歴拡張パネル（折り畳み可能）
  └ 右ペイン：Signal詳細
     └ プロパティ一覧＋エラーアイコン
     └ T/Rポート一覧
  └ 通常表示/変化点表示切替
     └ 変化点表示：直前バージョンとの比較固定
  └ エラー表示領域（画面下部）
  └ [独立画面で開く]ボタン → P33/P34
□ P33/P34: Frame/Signal独立詳細画面
  └ サイドメニューなし・[閉じる]ボタン
  └ 新規独立ウィンドウで開く
  └ URL直接アクセス対応

【MVPここまで】
```

### Phase1-6: サブセット別参照・ECU Port参照

```
【タスク】
□ P31: サブセット別参照
  └ サブセット選択でフィルタリング
  └ Frame/Signal×ECUバリ×コネクター マトリクス
  └ 行クリック→P33/P34を新規独立ウィンドウで開く
□ P40: ECU Port参照
  └ 複数ECU選択
  └ FramePort/SignalPortタブ切替
  └ マトリクス表示・Port詳細表示
```

### Phase1-7: 断面管理・変更履歴

```
【タスク】
□ P50: 公開バージョン一覧
  └ 断面確定操作（断面名入力→published）
  └ スナップショット永続化
  └ 過去断面をP30で新規ウィンドウ表示
□ P51: 変更履歴
  └ 比較断面選択（デフォルト：直前断面）
  └ ECU単位グループで差分表示
  └ 行クリック→P33/P34を新規独立ウィンドウで開く
□ changelogs自動生成ロジック
```

### Phase1-8: 出力機能

```
【タスク】
□ P60: 出力画面
  └ 全体通信マトリクスExcel出力
     └ サブセット複数選択・断面選択
     └ ECU単位シート生成
  └ 変更履歴Excel出力
  └ エラーチェック結果レポート出力
  └ インポート雛形Excel出力
```

### Phase1-9: 残機能・仕上げ

```
【タスク】
□ P70: アクセス権管理画面
□ P01: ホーム画面の完成
  └ 申請書サマリー・承認待ち件数・直近断面情報
  └ お知らせ表示
□ 全体的なエラーハンドリング整備
□ 単一HTMLファイルビルド確認
```

---

## 4. 技術スタック詳細

```
【フレームワーク】
React 18 + Vite + TypeScript

【主要ライブラリ】
・react-router-dom（ハッシュルーティング）
・xlsx（Excelパース・出力）
・idb（IndexedDB操作）
・tailwindcss（スタイリング）
・lucide-react（アイコン）

【ビルド設定】
vite.config.ts で以下を設定
・base: './'
・build.rollupOptions で単一HTMLにインライン化

【ディレクトリ構成】
src/
├── components/       # 共通UIコンポーネント
├── pages/            # 各画面コンポーネント
│   ├── P10_LanConfig/
│   ├── P11_Subsets/
│   ├── P20_Applications/
│   ├── P30_FrameSignal/
│   └── ...
├── repositories/     # IndexedDB Repository層
│   ├── base/
│   ├── EcuRepository.ts
│   ├── FrameRepository.ts
│   └── ...
├── services/         # ビジネスロジック層
│   ├── ExcelImportService.ts
│   ├── Level1CheckService.ts
│   ├── Level2CheckService.ts
│   └── ...
├── types/            # 型定義
│   ├── schema.ts     # DBスキーマ型
│   └── ...
├── utils/            # ユーティリティ
└── App.tsx
```

---

## 5. 実装上の重要ルール

設計書（docs/design/）を必ず参照し、設計書に従って実装すること。
詳細は CLAUDE.md を参照。
