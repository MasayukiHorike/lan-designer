# LAN Designer

AUTOSARに対応した自動車メーカー独自のCAN通信設計支援ツールです。
複数ECU担当者が管理するExcelファイルをインポートし、150%データセットとして一元管理します。
サブセット管理・承認フロー・断面管理を備え、通信マトリクスExcelなどを出力します。

## 特徴

- **Excelインポート**: 物理構成・通信データ・GW例外指定の各種 Excel を取込み、Level1/Level2 チェックを自動実行
- **150%データセット**: 全世代・全パワトレの通信仕様を一元管理し、サブセット単位でフィルタリング
- **順番制承認フロー**: ECU承認者（一次）→LAN承認者（二次）の2段階承認を順番制で管理
- **Frame/Signal参照**: ECU→Frame→Signalのツリー表示と、E2E/SecOC予約領域を含むビット配置マトリクスのグラフィカル表示
- **断面管理**: publish断面の確定・過去断面参照・変更履歴の可視化
- **プロジェクト管理**: 複数プロジェクト（車種等）の作成・切替・リセット・削除をテーマカラー付きで管理
- ブラウザの IndexedDB のみで完結する単位HTMLアプリとして動作（サーバー不要）

## 技術スタック

| 区分 | 内容 |
|------|------|
| フレームワーク | React + TypeScript + Vite |
| ルーティング | react-router-dom（ハッシュルーティング） |
| データ永続化 | IndexedDB（idb） |
| Excel入出力 | xlsx |
| スタイリング | Tailwind CSS |
| アイコン | lucide-react |
| ビルド | vite-plugin-singlefile（単一HTML化） |

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 開発サーバー起動
npm run dev

# 本番ビルド（単一HTMLに出力）
npm run build

# ビルド成果のプレビュー
npm run preview

# Lint
npm run lint
```

ビルド成果は `dist/` 以下に単一の HTML ファイル（JS・CSSインライン）として出力され、
ブラウザで開くだけでサーバーなしに単体で動作します（データはIndexedDBに保存）。

## ディレクトリ構成

```
lan-designer/
├── CLAUDE.md                # Claude Codeエージェント向け実装ガイド（必須参照）
├── IMPLEMENTATION_PLAN.md   # 実装フェーズ・タスク一覧
├── docs/
│   └── design/              # 全体設計書（v0.6・全て必読）
│       ├── system-design-v0.6-part1-overview.md
│       ├── system-design-v0.6-part2-excel-format.md
│       ├── system-design-v0.6-part3-data-model.md
│       ├── system-design-v0.6-part4-screen-design.md
│       └── system-design-v0.6-part5-roles-schema.md
├── samples/                 # Excelインポート用サンプルファイル
└── src/
    ├── components/          # 共通UIコンポーネント
    ├── pages/               # 各画面（P00〜P70）
    ├── repositories/        # IndexedDB Repository層
    ├── services/            # Excel入出力・チェック・承認等のビジネスロジック
    ├── types/               # 型定義（DBスキーマ・Excel・チェック結果）
    ├── contexts/            # React Context（ロール・プロジェクト管理）
    ├── utils/               # ユーティリティ
    └── db/                  # IndexedDB初期化
```

## 主な画面

| ID | 画面名 | 概要 |
|----|-------|------|
| P00 | ロール切替 | 検証用に4ロール（ECU設計者/ECU承認者/LAN設計者/LAN承認者）を切替 |
| P01 | ホーム | 申請書サマリー・承認待ち件数・直近断面情報 |
| P02 | プロジェクト管理 | プロジェクトの作成・切替・リセット・削除・テーマカラー設定 |
| P10 | LAN構成管理 | 物理構成Excelのインポート・ECU/バス/トポロジー/GW一覧 |
| P11 | サブセット管理 | ECU/コネクター・バスバリ×サブセットの割当てマトリクス |
| P20〜P22 | 申請書管理 | 一覧・作成・詳細＋承認操作（順番制） |
| P30/P31 | Frame・Signal参照 | ツリー表示・サブセット別マトリクス・ビット配置表示 |
| P33/P34 | Frame/Signal詳細 | 独立ウィンドウ表示・バージョン変化点比較 |
| P40 | ECU Port参照 | ECU別 FramePort/SignalPort マトリクス |
| P50/P51 | 断面管理 | 公開バージョン一覧・変更履歴 |
| P60 | 出力 | 通信マトリクス・変更履歴・チェック結果・インポート雛形のExcel出力 |
| P70 | アクセス権管理 | ロール×画面の権限（○/△/✗）編集 |

画面の詳細仕様は `docs/design/system-design-v0.6-part4-screen-design.md` を参照してください。

## ロール

| ロール | 主な権限 |
|-------|---------|
| ECU設計者 | 申請書作成・Excel登録・引き戻し・自担当ECU Port参照 |
| ECU承認者 | 一次承認・差し戻し・参照全般 |
| LAN設計者 | LAN構成管理・サブセット管理・断面確定・全出力・アクセス権管理・プロジェクト管理 |
| LAN承認者 | 二次承認・却下・in_review_2nd時編集・参照全般 |

P00ロール切替画面から任意のロールに切替えて各ロールの挙動を検証できます。

## ドキュメント

| ドキュメント | 内容 |
|-----------|------|
| `CLAUDE.md` | アーキテクチャ原則・ディレクトリ構成・実装済み仕様・実装時の教訓をまとめたClaude Code向けガイド |
| `IMPLEMENTATION_PLAN.md` | 実装済みフェーズ（Phase1-1〜1-9）と現在進行中の磨き込みフェーズ（Phase2）の一覧 |
| `docs/design/` | 全体設計書（アーキテクチャ・Excelフォーマット・データモデル・画面設計・DBスキーマの5分割版） |

新規に実装を行う際は必ず `CLAUDE.md` と `docs/design/` 配下の設計書を先に参照してください。

## データの保存先

全データはブラウザの IndexedDB に保存されます。サーバーへの送信は行われません。
開発・検証中にデータを初期化したい場合は P02 プロジェクト管理画面から
対象プロジェクトのリセット・削除を実行してください（復元不可な物理削除です）。

## ライセンス

個人検証用プロジェクト。
