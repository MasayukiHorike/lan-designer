# CLAUDE.md - LAN Designer 実装ガイド

このファイルはClaude Codeエージェントが本プロジェクトを実装する際の
ルール・コンテキスト・引き継ぎ情報を定義する。

---

## プロジェクト概要

AUTOSARに対応した自動車メーカー独自の通信設計支援システム。
複数ECU担当者が管理するExcelファイルをインポートし、
150%データセットとして一元管理する。

---

## 設計書の場所

全ての設計詳細は以下のファイルに記載されている。
実装前に必ず参照すること。

```
docs/design/
├── system-design-v0.6-part1-overview.md
│   └── システム概要・アーキテクチャ・インプットファイル構成
├── system-design-v0.6-part2-excel-format.md
│   └── Excelフォーマット詳細仕様（物理構成・通信データ・GW例外指定）
├── system-design-v0.6-part3-data-model.md
│   └── データモデル・ステータス管理・業務ロジック・処理フロー
├── system-design-v0.6-part4-screen-design.md
│   └── 画面構成・画面遷移・各画面詳細レイアウト（P02プロジェクト管理含む）
└── system-design-v0.6-part5-roles-schema.md
    └── ロール定義・IndexedDBスキーマ（全コレクション定義）
```

実装プランは以下を参照。

```
IMPLEMENTATION_PLAN.md
└── フェーズ定義・タスク一覧・技術スタック
```

---

## 技術スタック

```
React 18 + Vite + TypeScript
IndexedDB（idbライブラリ使用）
TailwindCSS
react-router-dom（ハッシュルーティング）
xlsx（Excelパース・出力）
lucide-react（アイコン）
```

---

## アーキテクチャ原則

### 1. Repository層を必ず経由する

```typescript
// NG: IndexedDBに直接アクセスしない
const db = await openDB('lan-designer', 1);
const frames = await db.getAll('frames');

// OK: Repository層を経由する
const frameRepo = new FrameRepository();
const frames = await frameRepo.findByProjectId(projectId);
```

### 2. ステータスフィルターはRepository層で強制適用

```typescript
// publishedデータのみ取得する場合
// Repository層でフィルタリングして返す
async findPublished(projectId: string): Promise<Frame[]> {
  const all = await this.findAll(projectId);
  return all.filter(f => f.status === 'published' && !f.deleted);
}
```

### 3. 論理削除を徹底する（プロジェクト削除・リセットを除く）

```typescript
// NG: 物理削除しない
await db.delete('frames', frameId);

// OK: 論理削除フラグを立てる
await frameRepo.update(frameId, { deleted: true, updatedAt: new Date().toISOString() });
```

※例外：P02プロジェクト管理の「削除」「リセット」操作のみ、
　開発・検証用の初期化手段として物理削除を用いる
　（Part5「プロジェクト削除・リセット時のカスケード処理」参照）。
　それ以外の画面・操作では引き続き論理削除を徹底すること。

### 4. IndexedDBスキーマはArangoDBドキュメント形式に寄せる

```typescript
// _id は "コレクション名/UUID" 形式
const frame: Frame = {
  _id: `frames/${uuid()}`,
  projectId: 'projects/xxx',
  // ...
};
```

---

## ディレクトリ構成

```
src/
├── components/          # 共通UIコンポーネント
│   ├── Layout/          # サイドメニュー・ヘッダー（プロジェクト切替含む）
│   ├── ErrorList/       # エラーリスト表示
│   └── ...
├── pages/               # 各画面コンポーネント
│   ├── P00_RoleSwitch/
│   ├── P01_Home/
│   ├── P02_Projects/        # プロジェクト管理（Phase2-1・Issue #1対応）
│   ├── P10_LanConfig/
│   ├── P11_Subsets/
│   ├── P20_Applications/
│   │   ├── P21_Create/      # 新規作成・下書き編集（/applications/:id/edit も同一コンポーネント）
│   │   └── P22_Detail/      # 詳細＋承認操作を統合（P23は廃止・下記「画面統合」参照）
│   ├── P30_FrameSignal/
│   │   ├── P33_FrameDetail/
│   │   └── P34_SignalDetail/
│   ├── P31_SubsetView/
│   ├── P40_EcuPort/
│   ├── P50_Snapshots/
│   ├── P51_Changelogs/
│   ├── P60_Export/
│   └── P70_AccessControl/
├── repositories/        # IndexedDB Repository層
│   ├── base/
│   │   ├── IRepository.ts
│   │   └── BaseRepository.ts
│   ├── ProjectRepository.ts     # findAllProjects()のみ。create/delete/resetは
│   │                             # ProjectManagementService.tsに実装（下記参照）
│   ├── VariantRepository.ts
│   ├── EcuRepository.ts
│   ├── BusRepository.ts
│   ├── FrameRepository.ts
│   ├── SignalRepository.ts
│   ├── ApplicationRepository.ts
│   ├── ApprovalRepository.ts
│   ├── GwRouteRepository.ts
│   ├── SnapshotRepository.ts
│   ├── ChangelogRepository.ts
│   ├── VersionHistoryRepository.ts
│   ├── SubsetHistoryRepository.ts
│   └── AccessControlRepository.ts
├── services/            # ビジネスロジック層
│   ├── excel/
│   │   ├── PhysicalConfigImportService.ts
│   │   ├── CommunicationDataImportService.ts
│   │   └── GwExceptionImportService.ts
│   ├── check/
│   │   ├── Level1CheckService.ts
│   │   └── Level2CheckService.ts
│   ├── ApplicationService.ts
│   ├── ApprovalService.ts
│   ├── GwRouteService.ts
│   ├── SnapshotService.ts
│   ├── ReviewEditService.ts       # LAN承認者による二次審査中の直接編集・Excel再インポート
│   ├── ProjectManagementService.ts # Phase2-1: createProject/resetProject/deleteProject
│   └── SampleDataService.ts       # Phase2-1: samples/配下データの初期投入
├── types/               # 型定義
│   ├── schema.ts        # DBスキーマ全型定義
│   ├── excel.ts         # Excelフォーマット型定義
│   └── check.ts         # チェック結果型定義
├── utils/               # ユーティリティ
│   ├── uuid.ts
│   ├── dateUtils.ts
│   └── applicationNo.ts # 申請書番号採番
├── contexts/            # React Context
│   ├── RoleContext.tsx        # ロール管理
│   └── ProjectContext.tsx     # 現在選択中プロジェクトのグローバル状態管理
│                               # Phase2-1でprojects一覧・switchProject・refreshProjects
│                               # を追加（既存のuseProject()フックは非破壊で拡張のみ。
│                               # 新規にCurrentProjectContextを作らなかった理由は
│                               # 下記「プロジェクト管理機能」参照）
├── hooks/               # カスタムフック
├── db/                  # IndexedDB初期化
│   └── database.ts
└── App.tsx
```

---

## データモデル重要事項

### Frame/Signalのバージョン管理（Phase2-2・Issue #3/#4対応）

```typescript
// frames/signals は「変更(verup)」のたびに新しい_idで新規ドキュメントを
// 作成する（同一_idを上書きしない。SnapshotServiceが過去のFrame/Signal _id
// からその時点のデータをfindByIdで再構成する設計のため）。
// 前後バージョンは自己参照リンクで管理する：
interface VersionLink {
  previousVersionId: string | null; // 直前バージョンの_id（初版はnull）
  nextVersionId: string | null;     // verupで置き換えた次バージョンの_id（最新版はnull）
}

// 「現在有効な最新版かどうか」は常にこれで判定する（別途isLatestフラグは持たない）
const isCurrent = (doc: { deleted: boolean; nextVersionId: string | null }) =>
  !doc.deleted && doc.nextVersionId === null;
```

**【重要・実装時の禁止事項】** 「現在の設計状態」を表示・チェックする全ての
読み取り処理（P30ツリー・P31/P60マトリクス・P40 ECU Port・Level1/Level2
チェック・GW例外反映時のFrame解決等）は、`findByProjectId`等で取得した
Frame/Signalに対して必ず`nextVersionId === null`（＋`!deleted`）で絞り込むこと。
これを忘れると、verupされた旧バージョンが現行データと並行して独立表示・
誤検出される（Issue #3/#4として実際に発生した不具合）。

**ただし例外**：P50の過去断面をP30等で表示するスナップショット表示モード
（`snapshotFilter`/`snapshotIds`引数がある場合）ではこのフィルタを適用しない。
`deleted`と異なり`nextVersionId`は時間経過で非nullに変わりうるため、無条件で
フィルタすると「当時published状態だったが後で別申請によりverupされた」
Frame/Signalが過去断面から見えなくなってしまう（スナップショットは
確定時点のframeIds/signalIdsを明示的に保持しており、それを信頼すればよい）。

verup時は併せて、内容変更が指定されなかった（コマンド空白の）配下Signalの
`frameId`を新Frameの`_id`へ再紐付けする（carry-over）こと。これを忘れると
変更のないSignalが旧Frame配下に取り残される。実装：
`src/services/CommunicationDataReflectionService.ts`の`carryOverSignalToNewFrame`。

### ステータス定義
```typescript
type Status =
  | 'draft'
  | 'in_review_1st'
  | 'in_review_2nd'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'withdrawn';
```

### ロール定義
```typescript
type Role =
  | 'ECU設計者'
  | 'ECU承認者'
  | 'LAN設計者'
  | 'LAN承認者';
```

### 申請書番号採番ルール
```typescript
// APP-{申請ECU名（バリナンバーなし）}-{年月日}-{連番2桁}
// 例）APP-EngineECU-20240110-01
function generateApplicationNo(ecuName: string, date: Date, seq: number): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const seqStr = String(seq).padStart(2, '0');
  return `APP-${ecuName}-${dateStr}-${seqStr}`;
}
```

---

## 画面とURLのマッピング

```typescript
// ハッシュルーティング
const routes = [
  { path: '/',                              component: P01_Home },
  { path: '/role',                          component: P00_RoleSwitch },
  { path: '/projects',                      component: P02_Projects }, // Phase2-1新設
  { path: '/lan-config',                    component: P10_LanConfig },
  { path: '/subsets',                       component: P11_Subsets },
  { path: '/applications',                  component: P20_Applications },
  { path: '/applications/new',              component: P21_Create },
  { path: '/applications/:id',              component: P22_Detail },
  { path: '/applications/:id/edit',         component: P21_Create }, // 下書きの編集再開
  // P23（承認操作）はP22に統合済み。/applications/:id/approve は廃止。
  { path: '/frame-signal',                  component: P30_FrameSignal },
  { path: '/frame-signal/subset',           component: P31_SubsetView },
  { path: '/frames/:frameId',               component: P33_FrameDetail },
  { path: '/signals/:signalId',             component: P34_SignalDetail },
  { path: '/frames/:frameId/bit-layout-editor', component: P35_BitLayoutEditor }, // Phase2-4新設（Issue #6対応）
  { path: '/ecu-port',                      component: P40_EcuPort },
  { path: '/snapshots',                     component: P50_Snapshots },
  { path: '/changelogs',                    component: P51_Changelogs },
  { path: '/export',                        component: P60_Export },
  { path: '/access-control',               component: P70_AccessControl },
];
```

---

## E2E・SecOC ビット配置ルール

```typescript
// E2E予約領域：フレーム先頭から固定
const E2E_RESERVED_BITS = 24;
const E2E_START_BIT = 0;

// SecOC予約領域：フレーム末尾から固定
const SECOC_RESERVED_BITS = {
  truncatedFV: 32,
  fullFV: 88,
};

function getSecocStartBit(dlc: number, fvMethod: 'truncatedFV' | 'fullFV'): number {
  return dlc * 8 - SECOC_RESERVED_BITS[fvMethod];
}

// 利用可能Signal領域
function getAvailableBits(dlc: number, e2eEnabled: boolean, secocEnabled: boolean, fvMethod?: string): number {
  let bits = dlc * 8;
  if (e2eEnabled) bits -= E2E_RESERVED_BITS;
  if (secocEnabled && fvMethod) bits -= SECOC_RESERVED_BITS[fvMethod as keyof typeof SECOC_RESERVED_BITS];
  return bits;
}
```

---

## アクセス権制御ルール

```typescript
// メニュー活性判定
type Permission = 'full' | 'readonly' | 'none';

// 初期値（P70で変更可能）
const DEFAULT_PERMISSIONS: Record<string, Record<Role, Permission>> = {
  'P02': { 'ECU設計者': 'readonly', 'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P10': { 'ECU設計者': 'readonly', 'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P11': { 'ECU設計者': 'readonly', 'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P40': { 'ECU設計者': 'full',     'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P50': { 'ECU設計者': 'readonly', 'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P70': { 'ECU設計者': 'none',     'ECU承認者': 'none',     'LAN設計者': 'full', 'LAN承認者': 'none' },
  // その他の画面はデフォルトfull
};
```

※P02について：一覧参照とプロジェクト切替は上記に関わらず常に
　全ロール可能（`readonly`は「作成/削除/リセット/テーマカラー設定不可」の意）。
　共通ヘッダーのプロジェクト切替ドロップダウンも同様に全ロール操作可能。

---

## LAN構成データの承認フロー

```
【重要】
物理構成（ECU/バス/トポロジー/GW）とサブセット定義は
申請・承認フロー不要。
LAN設計者が直接登録→即時published。
```

---

## 申請書の承認フロー（順番制・Phase1-3で確定）

```
【承認方式】全員並列承認ではなく、順番制（1人ずつ判定→明示的に回覧）

・一次承認者は「ECU登録順→各ECU内の登録順」でフラットな1本の待ち行列にする
・二次承認者も登録順の待ち行列
・Application._idに firstStageTurn / secondStageTurn（現在の対応順インデックス）を持つ
・現在の対応順の承認者だけが[承認]/[差し戻し]を操作できる
・[承認]は判定を記録するだけ（ステータス・対応順インデックスは変えない）
・判定後に[次の承認者へ回覧]ボタンが現れ、押すと初めて
  　次の承認者に対応順が進む（同一ステージ内）、または
  　次のステージ（in_review_2nd）／承認完了（approved）に遷行する
・[差し戻し]/[却下]はコメント必須・即座にdraftへ戻る（回覧不要、対応順インデックスも０にリセット）
・承認・差し戻し・却下は必ずapprovalsコレクションにコメント付きで記録し、
  画面側（P22）で必ず参照・表示する（記録するだけで表示しないのは禁止）
```

## 画面統合：P22とP23（Phase1-3で確定・設計書Part4より優先）

```
【重要】
申請書詳細（P22）と承認操作（P23）は1画面に統合済み。
P23（/applications/:id/approve）は廃止。承認操作のUIはP22内に
「現在の対応順の承認者への操作パネル」として直接組み込む。
新規に画面を追加する際もP23への参照は行わないこと。
```

---

## プロジェクト管理機能（Phase2-1・Issue #1対応）

```
【背景】
開発・検証中にデータをリセットする手段、サンプルデータ投入手段、
複数プロジェクトの切替・削除手段がなかった（Issue #1）ことへの対応。

【P02: プロジェクト管理画面】
・URL: /#/projects
・一覧参照・プロジェクト切替：全ロール可能
・新規作成・削除・リセット・テーマカラー設定：LAN設計者のみ
・削除・リセットは物理削除。プロジェクト名を入力させて
  一致した場合のみ実行可能とする確認ダイアログを必須とする
  （src/pages/P02_Projects/P02_Projects.tsx内のNameConfirmDialog）。

【カスケード削除・リセットの実装（設計時の想定から変更あり）】
・ProjectRepository自体にはcreate/delete/resetを実装せず、
  新規のsrc/services/ProjectManagementService.tsに集約した
  （ビジネスロジックはRepository層でなくService層に置くという
  既存方針との一貫性を優先）。
・削除・リセットの実体はBaseRepositoryに追加した
  hardDelete(id) / deleteAllByProjectId(projectId) を全Repositoryが
  継承する形で共通化。approvalsのみprojectIdを持たないため、
  ApprovalRepository.hardDeleteByApplicationId(applicationId)で
  applications経由の2ホップで削除する。
・対象コレクション：ecus / buses / frames / signals / applications /
  approvals / gwRoutes / snapshots / changelogs / versionHistories /
  subsetHistories / variants / accessControls
・リセット：上記を全削除し、projectsレコード自体は保持
・削除　　：上記を全削除し、projectsレコード自体も削除
・作業中プロジェクトを削除・リセットした場合：他の既存プロジェクトへ
  自動切替、無ければ新規デフォルトプロジェクトを自動生成する
  （ProjectContext.tsxのload()が空リスト時に自動生成する既存ロジックを
  そのまま利用）。

【共通ヘッダーのプロジェクト切替】
・全画面共通のヘッダーバーにドロップダウンを常設
・全ロールがいつでも切替可能（P02を開かなくてもよい）
・新規にCurrentProjectContextは作らず、既存のProjectContext.tsx
  （useProject()）を拡張した：project/loadingは既存のまま、
  projects（一覧）・switchProject・refreshProjectsを追加。
  useProject()を使う既存10箇所以上を書き換えずに済ませるための判断。
・選択中プロジェクトIDはlocalStorage（キー：
  lan-designer:selectedProjectId）で永続化する
  （RoleContextの永続化パターンを踏襲）。

【テーマカラーの適用範囲（ユーザーフィードバックにより方針変更）】
・当初はヘッダー左端の細いカラーバーのみで表現していたが、
  「明るすぎる／背景色を変えてほしい」というフィードバックにより、
  ヘッダー・サイドバー全体の背景色をテーマカラーで塗る方式に変更した。
・Layout.tsxのルート要素にCSS変数--project-accentを設定し、
  Header.tsx（bg-[var(--project-accent)]）・Sidebar.tsx
  （同上）・SidebarMenuItem.tsx（アクティブ項目はbg-white/20など
  白の半透明オーバーレイ）から参照する。背景色そのものを差し替えても
  白文字の可読性が保てるよう、固定パレット（src/constants/projectTheme.ts）
  は元の案より暗いトーン（Tailwindでいう800番台相当）に統一している。
・ドロップダウン等の浮遊パネルはテーマカラーに追従させず、
  常にbg-slate-800（ニュートラル）を使う（可読性優先）。

【サイドバーのアイコン・折り畳み】
・src/constants/menu.tsの各MenuItemにlucide-reactのicon
  （LucideIcon型）を追加必須とした。
・サイドバー全体の折り畳み（幅60→12のアイコンのみレールに変更、
  localStorageキー：lan-designer:sidebarCollapsed）を追加。
  既存の「グループ単位の折り畳み」（▼マスタ管理 等）とは別機能。
  折り畳み時はグループを解いて全項目をフラットなアイコンリストとして
  表示し、クリック操作（NavLink・権限判定）は折り畳み前と同一のまま
  維持する（アイコンだけの見た目にするために別実装を作らない）。

【サンプルデータ投入】
・新規プロジェクト作成時に「サンプルデータで開始」を選択可能。
・単に物理構成のみでなく、物理構成＋通信データ＋GW例外指定を
  投入したうえで、申請書作成→一次承認→二次承認→断面確定まで
  SampleDataService内でApplicationService/SnapshotServiceの
  既存関数を順に呼んで自動実行し、published状態まで持っていく
  （「触ってすぐ試せる」状態を再現するため）。
・samples/配下の実ファイルをViteの静的アセットとして
  `?url`importし、fetchで取得したBlobを既存のパース・チェック・
  反映パイプラインにそのまま流す（Excel相当データをコード側で
  再生成せず、既存の整合したサンプルファイルを単一のソースとする）。
```

---

## LAN承認者による直接編集・Excel再インポート（Phase1-4以降で実装）

```
【背景】
設計書（Part3 §8、Part4 P22モックアップ）には当初から
「二次審査（in_review_2nd）中のLAN承認者はExcel再インポートまたは
画面直接編集ができる」と記載されていたが、「Phase1-4のDB取込機能
実装後に対応予定」として保留されていた。DB取込機能の実装完了後に
この保留機能を実装した。

【対象範囲】
・この申請書がapplicationIdとして持ち込んだFrame/Signalのみが対象
  （他の申請書や既存publishedデータは対象外）。
・操作可能なのは現在の対応順のLAN承認者のみ（承認操作パネルと
  同じcanActOnSlot判定を流用）。

【画面直接編集】
・src/services/ReviewEditService.ts が本体。editFrameProperties /
  editSignalProperties で対象ドキュメントをパッチ更新する。
・versionNoは変更せず、VersionHistoryも作成しない。変更内容は
  Application.editHistories（既存スキーマにmethod:'excel'|'manual'
  で定義済みだった）にのみ記録する。
・FrameDetailView/SignalDetailViewにeditable/onSaveProperties/
  onUpsertPort/onRemovePortの各propsを追加し、既存の読み取り専用
  呼び出し元（P33/P34の独立ポップアップ等）はpropsを渡さないことで
  非破壊のまま維持している。
・FramePort/SignalPort編集後はそのFrameのGWルートを
  regenerateGwRoutesForFrame（既存関数を無変更のまま再利用）で
  自動再生成する。

【Excel再インポート】
・ApplicationService.registerCommunicationDataFileと同じ
  パイプライン（Level1→DB反映→Level2）を再利用するが、
  ctx.statusに申請書の現在ステータス（in_review_2nd）を
  渡すためFrame/Signalのステータスは退行しない。

【承認状態への非干渉】
・上記いずれの編集もapplication.status/firstStageTurn/
  secondStageTurn/approversを一切変更しない
  （＝一次承認やり直し不要。設計書の記載と整合）。

【編集履歴の表示】
・P22に「編集履歴」セクションを常時表示し、editHistoriesを
  新しい順に一覧表示する（教訓4「書くだけで終わらせない」の
  再発防止として、実装直後に表示側も必ず作る）。
```

---

## Excelパース時の注意事項

```
【通信データExcelのヘッダー構造】
・ヘッダー行が2行ある（ECU×コネクター・項目名）
・Dエリア（T/Rエリア）の列数はプロジェクトにより可変
・行種別識別列（A列）でF（フレーム）/S（シグナル）を判別
・Fの直下にそのフレームのSが続く構造

【コマンド処理】
・空白行はスキップ
・「追加」「変更(verup)」「削除」のみ処理
・コマンドとステータスの整合性チェックをLevel1で実施
```

---

## 実装時の禁止事項

```
・IndexedDBへの直接アクセス（Repository層を必ず経由）
・物理削除（P02のプロジェクト削除・リセット操作を除き、論理削除のみ）
・ステータスフィルターなしでの全件取得（参照系では必ずフィルタリング）
・設計書に記載のないスキーマの独自拡張（必ず設計書と相談）
```

---

## 実装時に設計書を確認すべき項目

```
・各画面の詳細レイアウト → Part4を参照
・DBスキーマの詳細 → Part5を参照
・Excelフォーマットの列定義 → Part2を参照
・チェックルール → Part3を参照
・ステータス遷移 → Part3を参照
・ロールと権限 → Part4・Part5を参照
```

---

## 実装時の教訓（Phase1-3の不具合から）

```
Phase1-3（申請・承認フロー）の初期実装では、ビルド・単発の
ハッピーパス検証は通っていたにも関わらず、複数の実運用上の
不備が後から見つかった。原因と対策は以下の通り。

【不唈1】一時保存後、下書きに戻って編集・提出する手段がなかった
　原因：P22（詳細画面）を設計書のモックアップ通り「参照＋一部操作」
　　　としてのみ実装し、draft状態のエンティティが再度編集画面に
　　　戻れるかを確認していなかった。
　対策：状態を持つ画面を実装する際は、エンティティのライフサイクル
　　　（作成→編集→中断→再開→提出→完了）を洗い出し、
　　　すべての状態から次に進める導線があるか確認すること。
　　　「一時保存」「離脱」のような操作を作ったら、必ず
　　　「そこから戻ってこれるか」をセットで確認する。

【不唈2】承認者を1人も設定しなくても申請提出できてしまった
　原因：「提出可能条件」を設計書の文言（ファイル1件以上・Level1
　　　エラーなし）だけをそのまま実装し、その先のワークフローが
　　　実際に完了できるかを逆算していなかった。
　対策：「〇〇できる条件」を実装する際は、それを満たした後の
　　　ワークフローが行き詰まずに完了できるかを逆算して確認する。
　　　条件が不足している場合はユーザーに理由が伝わるメッセージを
　　　画面に出す（無効化するだけで理由を示さないのは不親切）。

【不唈3】操作成功直後なのに失敗したような警告が出た
　原因：「権限がない」と「ステージが進んで自分の番ではなくなった」を
　　　同じ条件・同じ警告色で表示していた。機能的な正しさ（状態が
　　　正しく遷移したか）だけ確認し、その直後にユーザーが実際に
　　　見る画面の見た目・トーンを確認していなかった。
　対策：状態遷移が発生する操作を実装したら、遷移直後の画面を必ず
　　　目視確認する。「成功した操作の直後に警告色のメッセージが
　　　出ていないか」を確認する。

【不唈4】承認時に入力したコメントがどこにも表示されなかった
　原因：approvalsコレクションへの書き込み（記録）は設計書通り実装
　　　したが、対応する参照・表示側の実装を忘れていた。
　対策：DBへの書き込みを実装したら、その値を表示する画面が同じ
　　　Phase内に存在するか必ず確認する。書くだけで終わらせない。

【不唈5】承認方式（並列承認か順番制か）が設計書に明記されておらず、
　　　実装時に確認せず一方を仮定してしまった
　対策：設計書に業務ロジックの詳細（承認順序・同時実行可否など）が
　　　明記されていないと気づいた時点で、実装前にユーザーに確認する。
　　　気づかずに実装してしまうと、後から手戻りが大きくなる。

【共通の教訓】
　ブラウザでの動作検証は「意図したハッピーパス」だけでなく、
　「画面を離れて戻ってくる」「一時保存して再開する」「同じ操作を
　繰り返す」といった中断・再開・繰り返し系シナリオも
　最低1つは含めること。

【Phase2-1実装時の留意点（上記教訓の適用）】
　プロジェクト削除・リセットは本システムで唱一の物理削除操作であり
　取り消せない。実装時は以下を必ず確認すること。
　・削除対象を誤って選択しても実行前に気づけるか
　　（確認ダイアログでのプロジェクト名入力必須化で担保）
　・削除・リセット直後に画面が壊れないか
　　（現在選択中プロジェクトが削除された場合の遷移先を用意する）
　・カスケード削除の対象コレクションに漏れがないか
　　（Part5のカスケード対象一覧と実装を突き合わせて確認する）

【不備6】通信データExcelの「変更(verup)」「削除」コマンドが
　　　　常に「未登録（または削除済み）の要素にはコマンド指定不可」
　　　　エラーになり、実質バージョンアップができなかった
　原因：Level1チェック用のCommunicationDataCheckContextを組み立てる
　　　箇所（P21_Create.tsxのbuildContext等）が、existingFrames/
　　　existingSignalsに常に空配列を渡していた。既存要素の有無を
　　　空配列との照合で判定していたため、既存要素が実際にDBに
　　　あっても「未登録」と誤判定されていた。ハッピーパス（新規
　　　「追加」コマンドのみ）の検証では顕在化せず、実運用で
　　　「変更(verup)」を試して初めて発覚した。
　対策：ApplicationService.buildCommunicationDataCheckContext()を
　　　新設し、DBの現在の最新有効バージョン（name+variantNo単位で
　　　削除済みを除く最新versionNo）を正しく積んで返すよう統一。
　　　「チェックに渡すコンテキストが実際のDB状態を正しく反映して
　　　いるか」は、追加コマンドだけでなく変更・削除コマンドも
　　　含めて検証すること。

【不備7】React.StrictMode下でデフォルトプロジェクトが2件
　　　　重複生成された
　原因：ProjectContextのuseEffectはStrictMode（開発時のみ）で
　　　二重実行される。「プロジェクトが0件なら自動生成する」
　　　処理がfindAllProjects()の非同期完了を待ってから作成する
　　　実装だったため、2つの並行呼び出しがどちらも「0件」を見て
　　　しまい、両方が生成を実行するTOCTOU競合が発生した。単発の
　　　動作確認では発覚せず、P02でプロジェクト一覧を実際に
　　　表示して初めて重複に気づいた。
　対策：作成中のPromiseをモジュール単位でシングルトン共有し
　　　（getDb()のdbPromiseと同じパターン）、後続の並行呼び出しは
　　　同じPromiseを待つようにして二重生成を防いだ。「初回のみ
　　　実行されるべき副作用」を書いたら、StrictMode下の二重
　　　マウントで競合しないかを疑うこと。
```

---

## コミットメッセージ規約

```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
docs: ドキュメント更新
style: スタイル変更
test: テスト追加・修正
chore: ビルド設定等

例）
feat(P10): 物理構成Excelインポート機能を実装
feat(P11): サブセット管理マトリクス画面を実装
feat(check): Level1チェックサービスを実装
feat(P02): プロジェクト管理画面を実装
```
