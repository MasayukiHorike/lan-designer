# LAN Designer 実装プラン v2.0

---

## 1. プロジェクト概要

AUTOSARに対応した自動車メーカー独自の通信設計支援システム。
React + Vite + TypeScript で開発し、単一HTMLファイルとしてビルドする。

---

## 2. MVP定義（達成済み）

**目標：ExcelインポートしてFrame/Signalが参照できる状態**

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

上記は Phase1-1〜Phase1-5 の実装により**達成済み**。
2026年7月時点で P00〜P70 全画面のコンポーネントが実装され、
Repository層（14コレクション全て）・Service層（申請/承認/チェック/
Excel入出力/断面/変更履歴等）・共通コンポーネント（ビット配置
マトリクス・Frame/Signal詳細ビュー等）が一通り揃っている。

---

## 3. 実装済みフェーズ（完了・記録として保持）

### Phase1-1: 基盤構築 ✅完了
```
✅ React + Vite + TypeScript プロジェクト初期設定
✅ 単一HTMLファイルビルド設定（vite.config.ts）
✅ IndexedDB初期化・共通ユーティリティ
✅ Repository層の基底クラス・インターフェース定義
✅ 全コレクションのRepository実装
✅ 共通レイアウト（サイドメニュー・ヘッダー）
✅ ハッシュルーティング設定
✅ ロール切替画面（P00）
✅ ホーム画面（P01）
```

### Phase1-2: LAN構成管理 ✅完了
```
✅ P10: LAN構成管理画面（物理構成Excelインポート・タブ表示・差分更新・行削除）
✅ P11: サブセット管理画面（マトリクス表示・保存・追加削除・変更履歴）
```

### Phase1-3: 申請・承認フロー ✅完了（設計変更あり）
```
✅ P20: 申請書管理一覧
✅ P21: 申請書作成
✅ P22: 申請書詳細＋承認操作
   【設計変更】P23（承認操作）はP22に統合。独立画面化しなかった。
   　設計書 Part4 の画面一覧・画面遷移図は今後この実態に合わせて修正する。
```

### Phase1-4: 通信データDB取込 ✅完了
```
✅ 通信データExcelパース（A〜Dエリア）
✅ GW例外指定Excelパース
✅ Level1チェック実装
✅ Level2チェック実装（サブセット単位）
✅ 承認完了後のDB反映処理
```

### Phase1-5: Frame・Signal参照 ✅完了【MVPここまで達成】
```
✅ P30: Frame・Signal参照画面（ツリー・ビット配置マトリクス・詳細）
✅ P33/P34: Frame/Signal独立詳細画面
```

### Phase1-6: サブセット別参照・ECU Port参照 ✅完了
```
✅ P31: サブセット別参照
✅ P40: ECU Port参照
```

### Phase1-7: 断面管理・変更履歴 ✅完了
```
✅ P50: 公開バージョン一覧
✅ P51: 変更履歴
```

### Phase1-8: 出力機能 ✅完了
```
✅ P60: 出力画面（全体通信マトリクス・変更履歴・チェック結果・インポート雛形）
```

### Phase1-9: 残機能・仕上げ ✅完了
```
✅ P70: アクセス権管理画面
✅ P01: ホーム画面
```

---

## 4. 現在のフェーズ：Phase2 磨き込み・機能拡充

MVPおよび全画面の一次実装が完了した現在、以下3種のタスクを
継続的に扱うフェーズに移行する。

```
①設計書との差分解消
　└ 実装時の判断で設計書と異なる形になった箇所を
　　 都度ドキュメントに反映する

②項目追加・画面レイアウトのチューニング
　└ Masaさんが実際に触った上での改善要望を
　　 都度実装する

③不具合修正
　└ GitHub Issueで管理し、都度対応する
```

### Phase2-1: プロジェクト管理機能の新設（Issue #1 対応） ✅完了

**背景（Issue #1: データベースの初期化機能不足）**
```
・開発中にデータをリセットしたいが手段がない
・初期データ（サンプルデータ）投入機能がない
・複数プロジェクトを試したいが切替・削除ができない
```

**対応方針：P02 プロジェクト管理画面を新設し、恒久機能とする**

```
【P02: プロジェクト管理】
URL: /#/projects
配置: サイドメニュー「システム管理」グループ
　▼ システム管理
　　├ P02: プロジェクト管理
　　└ P70: アクセス権管理

【権限】
・プロジェクト作成/削除/リセット/テーマカラー設定：LAN設計者のみ
・プロジェクト切替：全ロール可能

【画面構成】
┌────────────────────────────────────┐
│ プロジェクト一覧                      │
│ ●🔵 Gen1プロジェクト ┤01/01│[切替][リセット][削除]│
│ ●🟢 Gen2プロジェクト ┤02/01│[切替][リセット][削除]│
│                                     │
│ [新規プロジェクト作成]（LAN設計者のみ）│
│ 　└ プロジェクト名・テーマカラー選択  │
├────────────────────────────────────┤
│ 【データリセット】（LAN設計者のみ）    │
│ 対象プロジェクト：[Gen1プロジェクト▼] │
│ [リセット実行]ボタン                 │
│ ・確認ダイアログ：                   │
│ 　「削除するプロジェクト名を入力してください」│
│ 　[入力欄] [実行][キャンセル]        │
│ ・入力値が一致した場合のみ実行可能    │
└────────────────────────────────────┘

【削除操作】
・同様にプロジェクト名入力による確認方式（物理削除）

【リセット処理の実体】
・対象プロジェクトに紐づく全コレクションのレコードを物理削除
　ecus / buses / frames / signals / applications / approvals /
　gwRoutes / snapshots / changelogs / versionHistories /
　subsetHistories / variants / accessControls
・projectsレコード自体は保持（リセット）または削除（プロジェクト削除）

【削除操作の挙動】
・プロジェクト削除＝上記全コレクションのレコード削除＋
projectsレコード自体も削除
```

**ヘッダー共通UI：プロジェクト切替**

```
【配置】画面最上部の共通ヘッダーバー（全画面共通）

┌─────────────────────────────────────┐
│ 🔵 [Gen1プロジェクト ▼]    {ロール名}さん │
├─────────────────────────────────────┤
│ サイドメニュー │ メインコンテンツ         │

【ドロップダウン展開時】
┌───────────────┐
│ 🔵 Gen1プロジェクト  ✓│ ← 現在選択中
│ 🟢 Gen2プロジェクト   │
│ 🟡 Gen3プロジェクト   │
├───────────────┤
│ プロジェクト管理へ →  │ ← P02への導線
└───────────────┘

・プロジェクト名クリックで即座に切替（全ロール操作可）
・切替後、画面全体が選択プロジェクトのデータ・
　テーマカラーに切り替わる
・ヘッダー背景色（または左端のカラーバー）が
　選択中プロジェクトのテーマカラーで表示される
・「プロジェクト管理へ」リンクからP02へ遷移
```

**テーマカラーの適用範囲**
```
・ヘッダーバーの背景色・アクセントカラーに反映
・サイドメニュー等のUIパーツもテーマカラーに連動
・全画面共通で作業中プロジェクトが視覚的に判別可能
```

**実装タスク**
```
✅ projects スキーマに themeColor フィールド追加
✅ create / delete（カスケード削除含む）/ reset（カスケード削除、
     projectsレコードは保持）
   【実装時の判断】ProjectRepositoryへの直接追加ではなく、新規
     src/services/ProjectManagementService.tsに実装した。カスケード削除の
     実体（hardDelete/deleteAllByProjectId）はBaseRepositoryに追加し、
     全13コレクション（approvalsはapplications経由の2ホップ）へ一律適用できる
     ようにした。ビジネスロジックはRepository層でなくService層に置くという
     CLAUDE.mdの既存方針に合わせた判断。
✅ 各Repositoryにプロジェクト単位カスケード削除処理を追加
   （BaseRepository.deleteAllByProjectId / ApprovalRepository.hardDeleteByApplicationId）
✅ P02画面実装
   └ プロジェクト一覧・新規作成・削除・リセット
   └ 確認ダイアログ（プロジェクト名入力必須・完全一致まで実行不可）
✅ 共通ヘッダーにプロジェクト切替ドロップダウン実装
✅ CurrentProjectContext（現在選択中プロジェクトのグローバル状態管理）実装
   【実装時の判断】新規に別名のContextを作らず、既存ProjectContext.tsxを
     拡張した（project/loadingは既存のまま、projects/switchProject/
     refreshProjectsを追加）。useProject()を使う10箇所以上の呼び出し元を
     一括修正するリスクを避けるため。
✅ テーマカラーをCSS変数として全画面に反映する仕組みを実装
   （Layout.tsxのルート要素に--project-accentを設定し、Header左端カラーバー・
     Sidebarのアクティブ項目ハイライトで参照）
✅ サンプルデータ投入機能
   └ samples/ 配下のサンプルファイルをViteの静的アセットとしてimportし、
     物理構成→申請書作成→一次承認→二次承認→断面確定までを自動実行して
     published状態まで一括投入する（新規プロジェクト作成時に選択可能）
```

**設計書への反映**
```
✅ Part4（画面構成・遷移設計）にP02を追加（実装開始前に反映済みだった）
✅ Part4のサイドメニュー構成・ロール別権限マトリクスを更新（同上）
✅ Part5（IndexedDBスキーマ）のprojectsにthemeColorフィールド追加（同上）
✅ CLAUDE.mdのルーティング定義にP02を追加（同上）
```

---

### Phase2-2: Frame/Signalバージョン管理の是正（Issue #3・#4対応） 📝設計書反映済み・実装未着手

**背景**
```
Issue #3: Frame,Signal参照画面において全てのバージョンのFrameや
　　　　　Signalが独立表示されてしまう。
Issue #4: FrameやSignalのバージョン関係が管理されておらず
　　　　　すべてが独立した要素として並行存在している。
```
両Issueは同一の原因に起因するため、まとめて対応する
（#4がデータモデル上の根本原因、#3がその結果として画面に出る症状）。

**原因調査（`src/services/CommunicationDataReflectionService.ts`）**
```
・「変更(verup)」時、resolveFrameDoc/resolveSignalDocは新しい_idで
  Frame/Signalドキュメントを新規作成するだけで、旧バージョンの
  ドキュメントを非活性化していない（deleted: falseのまま残る）。
  versionHistoriesへの記録は行われているが、生きているコレクション
  側からの「非活性化」が抜けていた。

・applyPortEditsは新バージョンのFrameId/SignalIdに対して新しい
  FramePort/SignalPortを追加(push)するだけで、旧バージョンを指す
  既存ポートを削除・付け替えしない。

・この結果、frames/signalsコレクションに新旧バージョンが両方とも
  deleted: falseの独立ドキュメントとして残り、ECUのconnectorには
  新旧両方のFrameId/SignalIdを指すポートが残る。P30ツリー
  （FrameSignalTreeService.buildFrameSignalTree）はconnectorの
  全FramePortを辿るだけなので、新旧バージョンが別々の独立した
  項目として並行表示される（Issue #3の症状）。

・そもそもデータモデルに「これは同一Frame/Signalの旧版である」
  というリンク（isLatestやsupersededBy等の関連フィールド）が
  存在せず、name+variantNoが一致する別ドキュメントというだけの
  緩い関連しかない（Issue #4の根本原因）。

・同種の「name+variantNoで最新バージョンを求める」ロジックが
  ApplicationService.latestNonDeletedByKey /
  GwRouteService.latestFrame / CommunicationDataReflectionService.
  latestOf の3箇所に重複実装されており、Level1CheckServiceの
  existingFrames/existingSignals解決（.find()で先頭一致を採用）は
  最新版でなく配列内の最初の一致を拾ってしまう潜在バグがある。

・Snapshot機構（SnapshotService）はFrame/Signalの_idをそのまま
  スナップショットに保存し、後で findById で当時のデータを
  再構成する設計になっている。そのため「verup時は同一_idのまま
  内容を上書きする」方式には変更できない（過去断面の内容が
  後から書き換わってしまう）。_idを維持したまま更新する方式は
  不採用とし、新規ドキュメント作成方式は維持した上で
  各ドキュメントに前後バージョンへの明示的な関連を持たせる
  方針とする。
```

**対応方針：Frame/Signalに前後バージョンへの参照フィールドを追加する**
```
【方針転換の経緯】
当初はisLatest: boolean（現在有効な版かどうかのフラグ）のみを
追加する方針を検討したが、「過去・未来のバージョン関係を
明確にしたい」という要望を踏まえ、単なる真偽値ではなく
前後バージョンのドキュメントを直接たどれる参照フィールドを
持たせる方式に変更する。

・frames/signalsスキーマに以下2フィールドを追加する
　　previousVersionId: string | null
　　　→ このバージョンが置き換えた直前バージョンの_id（過去方向）
　　　　初版の場合はnull
　　nextVersionId: string | null
　　　→ このバージョンをverupで置き換えた次バージョンの_id（未来方向）
　　　　現在有効な最新版の場合はnull
　（同一コレクション内の自己参照。Frame→Frame、Signal→Signal）

・「現在有効な最新版かどうか」は nextVersionId === null && !deleted
　で判定する（isLatestのような別フラグは持たず、リンクの有無から
  導出する。二重管理による不整合を避けるため）

・verup時の更新内容
　　新規ドキュメント：previousVersionId = 旧ドキュメントの_id、
  　　　　　　　　　　nextVersionId = null
　　旧ドキュメント　：nextVersionId = 新ドキュメントの_id に更新
  　　　　　　　　　　（recordVersionHistoryによる履歴記録と併せて実施）
　　　　　　　　　　　previousVersionIdは変更しない（そのまま維持）

・「追加」（初版）時：previousVersionId = null、nextVersionId = null

・Frame verup時、この操作で明示的にコマンドが指定されなかった
　（＝内容変更なしの）配下Signalを新Frameのframeidへ再紐付けする
　処理を追加する（これを行わないと、内容が変わっていないだけの
　Signalが旧（非activeな）Frameの配下に取り残され、新Frameの配下
　から見えなくなってしまう。これはisLatest方式・リンク方式の
　どちらを採るかに関わらず必要な対応）

・「現在の設計状態」を表示・チェックする全ての参照系に
　現在版フィルタ（!deleted && nextVersionId === null）を適用する。
　対象：
　　- FrameSignalTreeService（P30ツリー）
　　- SubsetMatrixService（P31サブセット別参照・P60全体通信マトリクス出力）
　　- EcuPortMatrixService（P40 ECU Port参照）
　　- Level2CheckService（サブセット単位チェック）
　　- ApplicationService.latestNonDeletedByKey
　　（Level1チェック用コンテキスト構築。nextVersionIdベースに簡略化）
　　- CommunicationDataReflectionService（Excel反映時の「既存」解決）
　　- GwRouteService.latestFrame（GW例外指定Excel反映時のFrame解決）

　※VersionCompareService（P22の変化点表示・直前バージョン取得）は
　　このリンクを使うことで大幅に簡略化できる。現状は全件取得＋
　　name/variantNo一致＋バージョン文字列比較(compareVersions)で
　　直前バージョンを探索しているが、previousVersionIdを使えば
　　frameRepo.findById(frame.previousVersionId) で一発解決できる。
　　（compareVersionsによる探索ロジックが丸ごと不要になる）
　　SnapshotServiceは断面確定時点のpublished一覧を対象とする
　　既存ロジックのままで良く、変更不要。

・P33/P34（Frame/Signal詳細画面）の「バージョン履歴」欄は、
　将来的にpreviousVersionIdを繰り返したどることで全履歴を
　一覧表示できるようになる（今回のスコープでは直前バージョンの
　表示のみ据え置き、UI拡張は別タスクとして切り出す）
```

**実装タスク（未着手）**
```
🔲 schema.ts: Frame/Signalに
　　previousVersionId: string | null
　　nextVersionId: string | null
　　を追加
🔲 CommunicationDataReflectionService.ts
　　🔲 追加(初版)時：previousVersionId/nextVersionIdをnullで設定
　　🔲 変更(verup)時：新ドキュメントのpreviousVersionIdに旧_idを設定
　　🔲 変更(verup)時：旧ドキュメントのnextVersionIdに新_idを設定
　　　　（recordVersionHistoryと同じタイミングで実施）
　　🔲 Frame verup時の未変更子Signalのframeid再紐付け(carry-over)処理
　　🔲 「既存」解決ロジックをnextVersionId === nullベースに変更
🔲 読み取り側へ現在版フィルタ（nextVersionId === null）を適用
　　🔲 FrameSignalTreeService
　　🔲 SubsetMatrixService
　　🔲 EcuPortMatrixService
　　🔲 Level2CheckService
🔲 ApplicationService.latestNonDeletedByKeyをnextVersionIdベースに簡略化
🔲 GwRouteService.latestFrameをnextVersionIdベースに簡略化
🔲 VersionCompareService.getPreviousFrameVersion/
　　getPreviousSignalVersionをpreviousVersionId参照に置き換えて簡略化
　　（compareVersionsによる全件探索ロジックを削除）
🔲 サンプルデータ・既存投入データがある場合の整合性確認
　　（新規投入分は自動的にnull/nullまたは正しいリンクが張られるため、
　　開発中DBのリセットで対応可能な場合は移行処理は不要と判断）
🔲 動作確認：verupシナリオ（Frameのみ変更／Signal追加を伴うverup／
　　Signal変更なしverup／3世代以上のverupを重ねた場合のリンクの
　　繋がり）をブラウザで一通り目視確認
```

**設計書への反映**
```
✅ Part5（IndexedDBスキーマ）: frames/signalsのJSON例に
　　previousVersionId / nextVersionId フィールドを追記
✅ Part3 §10（バージョン管理）: verup時に新規ドキュメントを
　　作成する方式の理由、previous/nextVersionIdの自己参照リンクで
　　前後バージョンを管理する方式、「現在有効な版」は
　　nextVersionId === null && !deleted で判定する方針、
　　参照系は必ずこの条件でフィルタする方針、Frame verup時の
　　未変更子Signal再紐付け方針を明記
```

---

## 5. 今後のタスク管理方針

```
・不具合・改善要望はGitHub Issueで管理する
・Issue対応が完了したら本ドキュメントのPhase2配下に
  実施内容を記録として残す
・画面レイアウトの細かいチューニングは
  都度チャットで相談しながら進める
```

---

## 6. 技術スタック詳細

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

【ディレクトリ構成】（実装済み）
src/
├── components/       # 共通UIコンポーネント
│   ├── Layout/
│   ├── ErrorList/
│   ├── BitMatrix.tsx
│   ├── FrameDetailView.tsx
│   ├── SignalDetailView.tsx
│   └── ...
├── pages/            # 各画面コンポーネント（P00〜P70）
├── repositories/     # IndexedDB Repository層（14コレクション）
│   └── base/
├── services/         # ビジネスロジック層
│   ├── check/        # Level1/Level2チェック
│   ├── excel/        # Excelインポート
│   ├── export/        # Excelエクスポート
│   └── ...
├── types/            # 型定義
├── utils/            # ユーティリティ
├── contexts/         # React Context（ロール管理等）
├── db/               # IndexedDB初期化
└── App.tsx
```

---

## 7. 実装上の重要ルール

設計書（docs/design/）を必ず参照し、設計書に従って実装すること。
詳細は CLAUDE.md を参照。
