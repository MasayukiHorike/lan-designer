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
│   │   ├── P21_Create/
│   │   ├── P22_Detail/
│   │   └── P23_Approve/
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
  { path: '/applications/:id/approve',      component: P23_Approve },
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
