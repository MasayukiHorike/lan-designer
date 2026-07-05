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

### Phase1-3 追記：LAN承認者による直接編集・Excel再インポート ✅完了
```
設計書（Part3 §8、Part4 P22モックアップ）で「Phase1-4のDB取込機能実装後に
対応予定」として保留していた機能を、Phase1-4完了後に実装した。

✅ 二次審査（in_review_2nd）中、現在の対応順のLAN承認者のみが
   Excel再インポート・画面直接編集（Frame/Signalプロパティ、
   FramePort/SignalPort）を行えるようにした
✅ 対象はこの申請書が持ち込んだFrame/Signalのみに限定
✅ 画面直接編集はversionNoを変更せず、Application.editHistoriesに
   変更内容を記録（VersionHistoryは作らない）
✅ Excel再インポートはdraft時登録と同じLevel1→DB反映→Level2の
   パイプラインを再利用し、ステータス退行を防ぐ
✅ FramePort/SignalPort編集後、そのFrameのGWルートを自動再生成
✅ 上記いずれもapplication.status/firstStageTurn/secondStageTurn/
   approversを変更せず、一次承認やり直し不要を担保
✅ P22に「編集履歴」セクションを常時表示（書くだけで終わらせない）
   実装：src/services/ReviewEditService.ts（詳細はCLAUDE.md参照）
```

### Phase1-4: 通信データDB取込 ✅完了
```
✅ 通信データExcelパース（A〜Dエリア）
✅ GW例外指定Excelパース
✅ Level1チェック実装
✅ Level2チェック実装（サブセット単位）
✅ 承認完了後のDB反映処理

🐛不具合修正：「変更(verup)」「削除」コマンドが常に「未登録」エラーに
　なり実質バージョンアップができない不具合を修正（原因：Level1チェック
　コンテキストのexistingFrames/existingSignalsに常に空配列を渡していた。
　ApplicationService.buildCommunicationDataCheckContext()を新設し、
　DB上の現在の最新有効バージョンを正しく積むよう修正）
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

**テーマカラーの適用範囲（実装確定：ユーザーフィードバックにより背景色方式に統一）**
```
・ヘッダーバー・サイドバー全体の背景色に反映
　（左端カラーバーのみの案は「明るすぎる／背景を変えてほしい」との
　　フィードバックを受けて不採用とした）
・固定パレットはやや暗めのトーンに統一し、白文字の可読性を確保
・サイドメニューのアクティブ項目・ホバー状態は白の半透明オーバーレイ
　（bg-white/10〜/20）で表現し、どのテーマカラーでも視認可能にする
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
   （Layout.tsxのルート要素に--project-accentを設定し、Header/Sidebarから参照）
   【ユーザーフィードバックにより方式変更】当初はHeader左端カラーバー＋
     Sidebarアクティブ項目ハイライトのみだったが、「明るすぎる／背景色を
     変えてほしい」との要望を受け、Header/Sidebar全体の背景色をテーマカラー
     で塗る方式に変更。パレット自体もTailwindの800番台相当のより暗いトーンに
     変更し、白文字の可読性を確保した（src/constants/projectTheme.ts）。
✅ サンプルデータ投入機能
   └ samples/ 配下のサンプルファイルをViteの静的アセットとしてimportし、
     物理構成→申請書作成→一次承認→二次承認→断面確定までを自動実行して
     published状態まで一括投入する（新規プロジェクト作成時に選択可能）
✅ サイドバー全体の折り畳み機能（追加要望）
   └ サイドバー上部のトグルボタンで幅60→12（アイコンのみ）に切り替え。
     localStorageに状態を永続化。折り畳み時も全項目がクリック可能
     （既存のグループ単位の折り畳みとは別機能として共存）。
✅ サイドメニュー各項目へのアイコン付与（追加要望）
   └ src/constants/menu.tsのMenuItemにlucide-reactのアイコンを追加し、
     折り畳み時はアイコンのみのリストとして表示（title属性でラベル参照）。
```

**設計書への反映**
```
✅ Part4（画面構成・遷移設計）にP02を追加（実装開始前に反映済みだった）
✅ Part4のサイドメニュー構成・ロール別権限マトリクスを更新（同上）
✅ Part5（IndexedDBスキーマ）のprojectsにthemeColorフィールド追加（同上）
✅ CLAUDE.mdのルーティング定義にP02を追加（同上）
```

---

### Phase2-2: Frame/Signalバージョン管理の是正（Issue #3・#4対応） ✅完了

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

**実装タスク**
```
✅ schema.ts: Frame/Signalに
　　previousVersionId: string | null
　　nextVersionId: string | null
　　を追加
✅ CommunicationDataReflectionService.ts
　　✅ 追加(初版)時：previousVersionId/nextVersionIdをnullで設定
　　✅ 変更(verup)時：新ドキュメントのpreviousVersionIdに旧_idを設定
　　✅ 変更(verup)時：旧ドキュメントのnextVersionIdに新_idを設定
　　　　（recordVersionHistoryと同じタイミングで実施）
　　✅ Frame verup時の未変更子Signalのframeid再紐付け(carry-over)処理
　　✅ 「既存」解決ロジックをnextVersionId === nullベースに変更
✅ 読み取り側へ現在版フィルタ（nextVersionId === null）を適用
　　✅ FrameSignalTreeService
　　✅ SubsetMatrixService
　　✅ EcuPortMatrixService
　　✅ Level2CheckService
   【実装時の重要な補足】スナップショット（過去断面）表示モードでは
     この現在版フィルタを適用しないよう分岐した（FrameSignalTreeServiceの
     snapshotFilter・SubsetMatrixServiceのsnapshotIds）。deletedと異なり
     nextVersionIdは時間経過とともに非nullへ変わりうるため、無条件で
     フィルタすると過去断面表示（当時published状態のFrame/Signal）が
     その後の別申請でverupされた際に見えなくなってしまう。この点は
     Playwrightでの断面互換性検証で確認済み。
✅ ApplicationService.latestNonDeletedByKeyをnextVersionIdベースに簡略化
✅ GwRouteService.latestFrameをnextVersionIdベースに簡略化
✅ VersionCompareService.getPreviousFrameVersion/
　　getPreviousSignalVersionをpreviousVersionId参照に置き換えて簡略化
　　（compareVersionsによる全件探索ロジックを削除）
✅ サンプルデータ・既存投入データがある場合の整合性確認
　　（新規投入分は自動的にnull/nullまたは正しいリンクが張られるため、
　　移行処理は不要と判断した通り、追加のマイグレーションは行っていない）
✅ 動作確認：verupシナリオ（Frameのみ変更／Signal追加を伴うverup／
　　Signal変更なしverup／3世代以上のverupを重ねた場合のリンクの
　　繋がり）をブラウザで一通り確認

**追加対応（調査中に発見・ユーザー確認済みの近縁バグ、まとめて修正）**
✅ P60_Export.tsxのインポート雛形出力Frame選択ドロップダウンが
　　`frameRepo.findByProjectId`の結果をそのまま使っており、verupで
　　置き換わった旧バージョンのFrameも選択肢に混在していた問題を修正
　　（`nextVersionId === null`でフィルタ）
✅ CommunicationDataReflectionService.reflectFrameGroupにおいて、
　　Frameコマンドが空欄（変更なし）の場合、子Signal行に「変更(verup)」
　　コマンドが指定されていても内部でframeがnullになりSignal側の変更が
　　静かに無視される不具合を修正（resolveFrameDocの構造変更：existing解決を
　　関数冒頭に移動し、コマンド空欄時もnullでなく解決済みのexistingを返す
　　ように変更）
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

### Phase2-3: ビット配置マトリクスの表示形式修正（Issue #2対応） ✅完了

**背景**
```
Issue #2: FrameにマッピングされたSignal配置の画面が
　　　　　8bit×DLCのマトリクスになっていない。
```

**現状分析（`src/components/BitMatrix.tsx`）**
```
・現在の実装はDLC×8bit全体を1本の横長バー（flexの1行）として
  描画し、E2E/SecOC/Signal/未使用の各領域を色分けした帯状表示に
  なっている。「行＝バイト、列＝8bit」というマトリクス（表）形式には
  なっていない。DLCが大きい場合（CAN-FDで最大64バイト＝512bit）、
  1本の帯では各ビットの視認・特定が困難。

・bitPositionは0起点の線形インデックス（0〜DLC*8-1）として
  扱われており、Motorola/Intelのエンディアンはデータとして保持する
  のみでビット位置計算には使用されていない（Level2CheckServiceの
  重複チェックも線形範囲の比較のみ）。設計書（Part2/Part4）にも
  バイト内のビット順序（MSB/LSB）に関する規定はない。

・BitMatrixコンポーネントはFrameDetailView.tsx（P22申請書詳細・
  P33 Frame詳細独立画面の両方から共通利用）でのみ使用されている。
```

**ヒアリング結果（今回のスコープ確定）**
```
・バイト内8bitの並び順：MSBファースト（bit7を左端、bit0を右端）で
  表示する
・「別タブ／ポップアップでの表示」「グラフィカルなSignal配置編集
  （ドラッグ&ドロップ等）」は、Issue #2の対応範囲に含めない。
  別途新規Issueとして切り出し、今回はマトリクス形式への表示修正
  （FrameDetailView埋め込みのまま）のみを対応する。
```

**対応方針：BitMatrixをDLC行×8bit列のグリッド表示に変更する**
```
・行：バイト単位（Byte0, Byte1, ... Byte{DLC-1}）を上から下へ配置
・列：各行8列。バイト内の並びはMSBファースト
　　　（左端が該当バイトの最上位ビット、右端が最下位ビット）
　　　※現行のbitPositionは0起点の線形インデックスのみで、
　　　　バイト内のビット並び順（zig-zag等）を別途持たないため、
　　　　各バイト行内では「線形インデックスの大きい方を左」に
　　　　描画することでMSBファーストの見た目を実現する
　　　　（bitPositionの算出方法・データモデル自体は変更しない。
　　　　　あくまで表示上の並び替えに閉じる）
・既存のセグメント構築ロジック（buildSegments：E2E/SecOC/Signal/
　未使用の色分け・ツールチップ・クリックでSignal選択）は流用し、
　バイト境界（8bit単位）でセグメントをクリップして各行に描画する
　（1つのSignal・予約領域がバイトをまたぐ場合は行ごとに分割表示）
・列見出し（7,6,5,4,3,2,1,0）・行見出し（Byte0, Byte1, ...）を追加
・凡例（E2E予約領域／SecOC予約領域／未使用）は現状維持
・DLCが大きい場合は縦スクロールで対応（行数が増えるだけなので
　レイアウト崩れは想定しにくいが、実装後に確認する）
・影響範囲：FrameDetailView経由でP22・P33の両方に反映される
　（両画面とも埋め込み表示のまま。別タブ／ポップアップ化はしない）
```

**実装タスク**
```
✅ BitMatrix.tsx
　　✅ 行見出し（Byte0, 1, ...）・列見出し（7〜0）の表示を追加
　　✅ バイト内の描画順をMSBファースト（線形インデックス降順）に変更
   【実装時の判断】当初案の「buildSegmentsの結果をバイト行単位でクリップ」
     ではなく、1bit＝1セル（data-bit-index付きのdiv/button）を8列×DLC行の
     グリッドとして直接描画する方式にした。同一色の隣接セルは背景色の
     連続で視覚的に結合されて見えるため見た目の差はないが、実装がシンプルに
     なる上、Phase2-4のドラッグ機能で1bit単位のヒットテスト
     （data-bit-index属性）がそのまま使えるようになる副次効果があった。
✅ 動作確認
　　✅ DLCが小さい場合・大きい場合（DLC=16で確認）での表示崩れ確認
　　✅ バイトをまたぐSignal・E2E/SecOC予約領域の表示を確認
　　　　（Frame_001サンプルでE2E=Byte0-2、Signal=Byte3-6、SecOC=Byte12以降
　　　　の配置を実際に確認）
　　✅ P22・P33双方でSignal選択のハイライト・ツールチップが
　　　　従来通り機能することを確認
```

**追加対応（ユーザー確認後に実施）：マトリクス内へのSignal名・範囲表示、重複表示の改善**
```
✅ 各Signalの占有セルにツールチップだけでなく、マトリクス内に直接
　　「⇔Signal名」（行内で連続する区間の中央に表示）を表示するよう変更。
　　2bit以上の区間にのみ表示し、1bitしかない区間はスペースがないため
　　従来通りツールチップのみで確認する。
　　【実装方法】行を position:relative にし、同一Signalが連続する
　　区間（getRowSignalRuns）ごとにpointer-events-noneの絶対配置オーバーレイを
　　重ねる方式にした。ドラッグ・クリックの当たり判定用セル（button/div）は
　　従来のまま変更していないため、P35のドラッグ機能への影響はない。
✅ Signal配置が重複した場合の表示を、単に赤枠（ring）を付けるだけでなく
　　以下の点を改善：
　　・重複しているセルには従来通り赤枠（ring-2 ring-red-500）を表示しつつ、
　　　重複マトリクス内ラベルにも「⚠」を追記
　　・ツールチップに重複している全Signal名を列挙するよう変更
　　　（従来は最後に処理されたSignal名のみ表示していた）
　　・凡例「他Signalと重複」の表示条件だった`draggableSignalIds`指定
　　　（＝P35でのみ表示）を撤廃し、P22/P33の参照専用表示でも常に
　　　凡例を表示するよう変更（読み取り専用画面でも赤枠の意味が
　　　伝わるようにするため）
　　【注意点】同一bitに3つ以上のSignalが重複した場合も名前は
　　　全て列挙されるが、マトリクス内には常に「最後に処理された
　　　Signal」の色・名前のみが前面表示される（他は背景に隠れる）。
　　　これはSignal同士の重複自体がLevel2チェックで警告対象となる
　　　異常系であり、正常系の表示を複雑にしてまで全Signalを
　　　同時に前面表示する必要はないと判断したため。
```

**再追加対応：「⇔＋名前」から実際の範囲ライン表示への変更**
```
✅ 上記の「⇔Signal名」表示について、「⇔はStartBitとEndBitを結ぶ線を
　　引きたかった」というユーザー要望を受けて再設計した。
　　【進め方】いきなり実装せず、まずArtifactでline-styleの異なる3案
　　（A:セル内に矢印付きの線を直接重ねる／B:セル上部に専用の帯を設けた
　　寸法線（CAD風ティックマーク）／C:セル下部の帯にアンダーライン
　　ブラケット）を同一のサンプル配置（バイトをまたぐSignalと1bit重複
　　するSignalの両方を含む）でモックアップし、ユーザーに選んでもらった。
　　→ 案A（セル内オーバーレイの矢印ライン、行の高さが変わらない案）を採用。
　　【実装（BitMatrix.tsx）】各Signalの行内連続区間（getRowSignalRuns）
　　ごとに、セル下部に細い線を引き、その両端に矢頭（▶／◀）を表示する。
　　【重要・端点の左右が実装時に問題になった点】列見出しが「7,6,5,4,
　　3,2,1,0」の順（＝bitInByteが小さいほど右側の列）で表示されるため、
　　bitPosition（開始bit）はbitInByteが小さいほど右寄りになる＝
　　「開始側の端点は行内では右端、終了側の端点は左端」が幾何学的に
　　正しい（モックアップ検討時は視認性優先で左=開始／右=終了という
　　直感的な向きにしていたが、これは実装前提としては誤りだったため
　　実装時に列見出しの並びから改めて導出し直した）。この導出は
　　「その行がSignalの最上位バイト（Math.floor(bitPosition/8)）か」
　　「最下位バイト（Math.floor(endBit/8)）か」で判定し、真の端点で
　　なければ行の絶対端（＝隣のバイト行へ続く）として⌃／⌄の継続
　　マークを表示する。
　　・重複している境界（cells[].conflictSignalsが空でない）では、
　　　矢頭や継続マークの代わりに赤い点を表示する（赤枠リングと役割を
　　　合わせ、優先表示する）。
　　・ドラッグ中のプレビュー位置（P35）でも矢印が正しい位置に追従する
　　　よう、bitPosition参照をすべてeffectivePosition()（ドラッグ中の
　　　overridePositionsを反映する関数）経由に統一した。ツールチップの
　　　bit番号表示も同じ関数を使うよう修正（従来はドラッグ中も
　　　signal.bitPosition固定値を表示しており、地味に不整合だった）。
```

**設計書への反映**
```
✅ Part4のP30「ビット配置マトリクス」の説明に、
　　DLC行×8bit列（MSBファースト）のグリッド形式である旨を明記
　　（P33はP30を参照する記載のため追随）
```

**切り出したフォローアップ（別Issueで対応予定・今回のスコープ外）**
```
・ビット配置のグラフィカル編集機能（別タブ／ポップアップ表示＋
  ドラッグ&ドロップ等によるSignal配置変更）
　└ Issue #6として起票済み（下記Phase2-4参照）
```

---

### Phase2-4: ビット配置グラフィック編集画面の新設（Issue #6対応） ✅完了

**背景**
```
Issue #6: ビット配置をグラフィカルに編集できる専用画面を追加したい
　　　　　（Issue #2対応検討中に切り出した派生要望）
1. ビット配置マトリクスを別タブ／ポップアップの独立画面として開けるようにする
2. その画面上でSignalの配置（bitPosition）をドラッグ&ドロップ等で
　 グラフィカルに変更できるようにする
```

**現状調査（既存の編集の仕組みとの関係）**
```
・Frame/Signalのプロパティ直接編集（bitPosition/bitLength含む）は
  既にP22（申請書詳細）内に実装済み（src/services/ReviewEditService.ts）。
  現状は数値入力フォーム（SignalPropertyEditForm）のみで、
  グラフィカルな配置変更手段がない。

・editSignalProperties()の制約（そのままグラフィック編集にも適用する）
　　- requireLanApproverTurn：二次審査(in_review_2nd)中、現在の
　　　対応順のLAN承認者のみ編集可能
　　- signal.applicationId === application._id：この申請書自身が
　　　持ち込んだSignalのみ編集可能（同じFrame配下でも他申請由来の
　　　Signalは編集不可）
　　- validateSignalBitRange：フレーム範囲外・E2E/SecOC予約領域との
　　　重複はハードエラーで保存不可
　　- Signal同士のビット重複はハードブロックせず、保存後に
　　　Level2チェック（非ブロッキング・エラー表示のみ）に委ねている
　　- 保存のたびにeditHistoriesへ記録・Level2チェックを再実行

・BitMatrixコンポーネント（Phase2-3でDLC行×8bit列・MSBファースト化
  予定）はFrameDetailView.tsxからのみ利用され、現状は表示専用。
```

**対応方針**
```
・既存の編集権限・対象制約（上記）をそのまま適用する
　（新しい権限ルールは作らない。「この申請書が持ち込んだSignalのみ・
　 かつ現在の対応順のLAN承認者のみ」ドラッグ操作可能とする）

・ドラッグ操作で変更できるのはbitPosition（配置の移動）のみ。
　bitLength（ビット長）は変更対象外（従来通り数値入力フォームで変更）

・新規独立画面（仮称 P35：ビット配置グラフィック編集画面）を追加する
　　- P33/P34と同様、window.openで別タブ／別ウィンドウとして開く
　　　（サイドメニューなし・URLに frameId・applicationId を含める）
　　- FrameDetailView側（P22のeditable時のみ）に
　　　「ビット配置をグラフィック編集」ボタンを追加し、そこから起動する
　　　（P33の参照専用表示には追加しない。編集専用機能のため）
　　- 画面はFrame配下の全Signalを表示するが、ドラッグ可能なのは
　　　「この申請書が持ち込んだSignal」のみ。他申請由来のSignalは
　　　コンテキスト表示（ドラッグ不可・見た目で区別）とする
　　- Phase2-3のDLC行×8bit列（MSBファースト）グリッドをそのまま
　　　流用し、ドラッグ機能を追加する形で実装する

・ドラッグ中の視覚フィードバック
　　- フレーム範囲外・E2E/SecOC予約領域との重複：ドロップ不可
　　　（editSignalPropertiesのハードエラーと整合させ、クライアント側でも
　　　　事前に弾く。保存時に初めてエラーになる体験を避ける）
　　- 他Signalとの重複：ドロップは許可するが警告色で表示する
　　　（既存の「Signal間重複はLevel2チェックに委ねる・ブロックしない」
　　　　方針に合わせる）

・保存方式：まとめて保存
　　- ドラッグ操作はコンポーネント内のローカル状態のみを更新し、
　　　即座にはDBへ反映しない
　　- 変更のあったSignal一覧（旧位置→新位置）を画面内に表示
　　- [保存]ボタン押下で、変更のあった各SignalについてeditSignalProperties
　　　を呼び出し、まとめて反映する。保存後はLevel2チェック結果
　　　（重複エラー等）を画面内に表示する
　　- [キャンセル]（またはリセット）でローカルの変更を破棄し、
　　　DB上の現在値を再読込する

・別タブで保存した内容をP22（元画面）へ反映する方法（要検討・暫定案）
　　- 別タブ・別ウィンドウで保存するため、開いたままのP22タブは
　　　自動的には最新状態にならない
　　- 暫定案：保存成功時、window.opener が存在すれば
　　　window.opener.location.reload() で元画面を再読込する
　　　（postMessageによる差分通知等の複雑な仕組みは今回は採用しない）
　　- window.openerが取得できない場合（別ウィンドウとして開かれた場合等）は
　　　「申請書詳細画面に戻り再読込してください」という案内を表示する

・ドラッグ実装：新規ライブラリは追加せず、pointer eventベースの
　自前実装とする（package.jsonに現状ドラッグ&ドロップ用ライブラリの
　依存がなく、必要な操作が「1次元的な範囲移動」に閉じるため、
　react-dnd等の汎用DnDライブラリを導入するほどの複雑さではないと判断）
```

**実装タスク**
```
✅ 新規画面 P35: ビット配置グラフィック編集画面
　　✅ ルーティング追加（/#/frames/:frameId/bit-layout-editor、
　　　　applicationIdをクエリパラメータで受け取る）
　　✅ Frame・Application・Frame配下の全Signalを読み込み
　　✅ canLanApproverEdit + signal.applicationId一致でドラッグ可否を判定
　　✅ Phase2-3のグリッド表示をベースにドラッグ機能を実装
　　　　（pointer event・範囲外/予約領域との重複はドロップ不可、
　　　　Signal間重複は警告色表示のみでドロップ許可）
　　　　実装：src/utils/bitLayout.ts の isBitPlacementValid（フレーム範囲・
　　　　E2E/SecOC判定を例外を投げないbool版として追加。保存時の最終検証
　　　　である既存のReviewEditService.validateSignalBitRangeとは別に、
　　　　ドラッグ中プレビュー専用として新設した）
　　✅ 変更差分一覧表示・[保存][キャンセル]
　　✅ 保存時：変更SignalごとにeditSignalProperties呼び出し→
　　　　Level2チェック結果表示
　　✅ 保存後、window.opener.location.reload()（存在する場合）
✅ FrameDetailView.tsx: editable時のみ「グラフィック編集」起動ボタン追加
✅ 動作確認（Playwrightでpointer eventによるドラッグを実機シミュレーションして確認）
　　✅ 二次承認者の対応順である場合に編集可能（参照専用バナーが出ない）ことの確認
　　✅ ドラッグでSignalが実際に新しいbitPositionへ移動し、
　　　　DB上もversionNo・nextVersionIdを変更せずin-placeで更新されることを
　　　　IndexedDB直接確認（画面直接編集と同じ「versionNoは変えない」方針の通り）
　　✅ 保存後、元のP22タブ（window.opener）が実際にreloadされることの確認
　　✅ 権限なし（対応順でない・別ロール）で画面を開くとエラーにならず
　　　　参照専用として扱われることの確認

【実装時に発見した不具合（本Phase内で修正）】
　FrameDetailView.tsxの起動ボタンで当初window.open(url, '_blank', 'noopener')
　としていたため、window.openerが常にnullになりP35の「保存後にopenerを
　reloadする」機能が動作しなかった（P33/P34の起動ボタンをコピーした際に
　'noopener'も一緒にコピーしてしまったため）。P35はwindow.openerへの
　参照を意図的に必要とする唯一の独立画面であるため、'noopener'を外して
　修正した。Playwrightでwindow.openerの有無を直接検証しなければ
　気づけなかった不具合であり、単に画面が開くことだけを確認する検証では
　見逃していた。
```

**設計書への反映**
```
✅ Part4：新規画面P35のモックアップ・画面遷移（P22からの起動）を追加
✅ CLAUDE.mdのルーティング定義にP35を追加
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
