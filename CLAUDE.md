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
│   └── 画面構成・画面遷移・各画面詳細レイアウト
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

### 3. 論理削除を徹底する

```typescript
// NG: 物理削除しない
await db.delete('frames', frameId);

// OK: 論理削除フラグを立てる
await frameRepo.update(frameId, { deleted: true, updatedAt: new Date().toISOString() });
```

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
│   ├── Layout/          # サイドメニュー・ヘッダー
│   ├── ErrorList/       # エラーリスト表示
│   └── ...
├── pages/               # 各画面コンポーネント
│   ├── P00_RoleSwitch/
│   ├── P01_Home/
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
│   ├── ProjectRepository.ts
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
│   └── SnapshotService.ts
├── types/               # 型定義
│   ├── schema.ts        # DBスキーマ全型定義
│   ├── excel.ts         # Excelフォーマット型定義
│   └── check.ts         # チェック結果型定義
├── utils/               # ユーティリティ
│   ├── uuid.ts
│   ├── dateUtils.ts
│   └── applicationNo.ts # 申請書番号採番
├── contexts/            # React Context
│   └── RoleContext.tsx  # ロール管理
├── hooks/               # カスタムフック
├── db/                  # IndexedDB初期化
│   └── database.ts
└── App.tsx
```

---

## データモデル重要事項

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
  'P10': { 'ECU設計者': 'readonly', 'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P11': { 'ECU設計者': 'readonly', 'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P40': { 'ECU設計者': 'full',     'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P50': { 'ECU設計者': 'readonly', 'ECU承認者': 'readonly', 'LAN設計者': 'full', 'LAN承認者': 'readonly' },
  'P70': { 'ECU設計者': 'none',     'ECU承認者': 'none',     'LAN設計者': 'full', 'LAN承認者': 'none' },
  // その他の画面はデフォルトfull
};
```

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
  　次のステージ（in_review_2nd）／承認完了（approved）に遷移する
・[差し戻し]/[却下]はコメント必須・即座にdraftへ戻る（回覧不要、対応順インデックスも0にリセット）
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
・物理削除（論理削除のみ）
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

【不備1】一時保存後、下書きに戻って編集・提出する手段がなかった
　原因：P22（詳細画面）を設計書のモックアップ通り「参照＋一部操作」
　　　　としてのみ実装し、draft状態のエンティティが再度編集画面に
　　　　戻れるかを確認していなかった。
　対策：状態を持つ画面を実装する際は、エンティティのライフサイクル
　　　　（作成→編集→中断→再開→提出→完了）を洗い出し、
　　　　すべての状態から次に進める導線があるか確認すること。
　　　　「一時保存」「離脱」のような操作を作ったら、必ず
　　　　「そこから戻ってこれるか」をセットで確認する。

【不備2】承認者を1人も設定しなくても申請提出できてしまった
　原因：「提出可能条件」を設計書の文言（ファイル1件以上・Level1
　　　　エラーなし）だけをそのまま実装し、その先のワークフローが
　　　　実際に完了できるかを逆算していなかった。
　対策：「〇〇できる条件」を実装する際は、それを満たした後の
　　　　ワークフローが行き詰まらずに完了できるかを逆算して確認する。
　　　　条件が不足している場合はユーザーに理由が伝わるメッセージを
　　　　画面に出す（無効化するだけで理由を示さないのは不親切）。

【不備3】操作成功直後なのに失敗したような警告が出た
　原因：「権限がない」と「ステージが進んで自分の番ではなくなった」を
　　　　同じ条件・同じ警告色で表示していた。機能的な正しさ（状態が
　　　　正しく遷移したか）だけ確認し、その直後にユーザーが実際に
　　　　見る画面の見た目・トーンを確認していなかった。
　対策：状態遷移が発生する操作を実装したら、遷移直後の画面を必ず
　　　　目視確認する。「成功した操作の直後に警告色のメッセージが
　　　　出ていないか」を確認する。

【不備4】承認時に入力したコメントがどこにも表示されなかった
　原因：approvalsコレクションへの書き込み（記録）は設計書通り実装
　　　　したが、対応する参照・表示側の実装を忘れていた。
　対策：DBへの書き込みを実装したら、その値を表示する画面が同じ
　　　　Phase内に存在するか必ず確認する。書くだけで終わらせない。

【不備5】承認方式（並列承認か順番制か）が設計書に明記されておらず、
　　　　実装時に確認せず一方を仮定してしまった
　対策：設計書に業務ロジックの詳細（承認順序・同時実行可否など）が
　　　　明記されていないと気づいた時点で、実装前にユーザーに確認する。
　　　　気づかずに実装してしまうと、後から手戻りが大きくなる。

【共通の教訓】
　ブラウザでの動作検証は「意図したハッピーパス」だけでなく、
　「画面を離れて戻ってくる」「一時保存して再開する」「同じ操作を
　繰り返す」といった中断・再開・繰り返し系のシナリオも
　最低1つは含めること。
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
```
