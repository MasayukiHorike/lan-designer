# 通信設計支援システム 全体設計書 v0.6
## Part5: ロール定義・IndexedDBスキーマ

---

## 15. ロール定義

| ロール | 主な権限 | 検証フェーズ |
|-------|---------|------------|
| ECU設計者 | 申請書作成・Excel登録・引き戻し・自担当ECU Port参照 | ロール切替で再現 |
| ECU承認者 | 一次承認・差し戻し・参照全般 | ロール切替で再現 |
| LAN設計者 | LAN構成管理・サブセット管理・断面確定・全出力・アクセス権管理・プロジェクト管理 | ロール切替で再現 |
| LAN承認者 | 二次承認・却下・in_review_2nd時編集・参照全般 | ロール切替で再現 |

---

## 16. IndexedDBスキーマ

### 設計方針
```
・各ドキュメントは_idをキーとしたJSONオブジェクト
・ArangoDBのコレクション構造に寄せた設計
・代表プロパティのみ定義・詳細は実装時に拡張
・共通メタデータを全ドキュメントに付与
```

### 共通メタデータ（全コレクション共通）
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
  "themeColor": "#3B82F6",
  "status": "active"
}
```

※themeColorはPhase2-1（P02プロジェクト管理・Issue #1対応）で追加。
　ヘッダーバー・サイドメニュー等のUIに反映し、
　複数プロジェクトを切り替える際に作業中プロジェクトを
　視覚的に判別できるようにするためのフィールド。
　カラーコード（#RRGGBB形式）で保持する。

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
  ],
  "busVariantIds": ["buses/UUID-1", "buses/UUID-2"]
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
  "applicationNo": "APP-EngineECU-20240110-01",
  "applicantEcuName": "EngineECU",
  "title": "件名",
  "description": "変更概要",
  "comment": "コメント",
  "status": "in_review_1st",
  "applicantId": "ロールID",
  "approvers": {
    "firstStage": [
      {
        "ecuName": "ECU-A",
        "approvers": [
          { "email": "tanaka@example.com", "status": "approved", "actionAt": "2024-01-10T00:00:00Z" },
          { "email": "suzuki@example.com", "status": "pending" }
        ]
      },
      {
        "ecuName": "ECU-B",
        "approvers": [
          { "email": "sato@example.com", "status": "pending" }
        ]
      }
    ],
    "secondStage": [
      { "email": "yamamoto@example.com", "status": "pending" },
      { "email": "ito@example.com", "status": "pending" }
    ]
  },
  "firstStageTurn": 1,
  "secondStageTurn": 0,
  "importFiles": [
    {
      "ecuName": "ECU-A",
      "communicationDataFileRef": "ref_001",
      "communicationDataFileBlob": "Blob",
      "gwExceptionFileRef": "ref_002",
      "gwExceptionFileBlob": "Blob"
    },
    {
      "ecuName": "ECU-B",
      "communicationDataFileRef": "ref_003",
      "communicationDataFileBlob": "Blob"
    }
  ],
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

※firstStageTurn/secondStageTurnは順番制承認（Part3 §8参照）における
　現在の対応順インデックス。一次承認者は「ECU登録順→各ECU内の登録順」
　でフラットに並べた待ち行列の何番目が対応中かを表す
　（上記例ではtanaka@example.comが対応済＝index0のためfirstStageTurn:1、
　　suzuki@example.comが現在の対応順）。二次承認者も同様に登録順の
　待ち行列とし、secondStageTurnで管理する。

### 9. approvals
```json
{
  "_id": "approvals/UUID",
  "applicationId": "applications/UUID",
  "stage": "1st",
  "ecuName": "ECU-A",
  "approverId": "tanaka@example.com",
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
  "sequenceNo": 5,
  "snapshotName": "v1.5",
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

### 13. subsetHistories（サブセット変更履歴）
```json
{
  "_id": "subsetHistories/UUID",
  "projectId": "projects/UUID",
  "variantId": "variants/UUID",
  "changedAt": "2024-01-10T00:00:00Z",
  "changedBy": "ロールID",
  "before": {},
  "after": {}
}
```

### 14. accessControls
```json
{
  "_id": "accessControls/UUID",
  "projectId": "projects/UUID",
  "screenId": "P20",
  "screenName": "申請書管理",
  "permissions": {
    "ECU設計者": "full",
    "ECU承認者": "full",
    "LAN設計者": "full",
    "LAN承認者": "full"
  },
  "updatedAt": "2024-01-10T00:00:00Z",
  "updatedBy": "ロールID"
}
```

※permissions値: "full"=○ / "readonly"=△ / "none"=✗

---

### コレクション関連図
```
projects（themeColorを保持・Phase2-1）
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
　├── subsetHistories → variants
　└── accessControls
```

### ステータス適用コレクション一覧
```
ステータス管理対象（published/approved/in_review等）
　├── ecus
　├── buses
　├── frames
　├── signals
　├── gwRoutes
　└── applications

ステータス管理対象外（マスタ・履歴系・即時公開）
　├── projects
　├── variants      ※登録＝即時公開
　├── approvals
　├── versionHistories
　├── snapshots
　├── changelogs
　├── subsetHistories
　└── accessControls
```

### プロジェクト削除・リセット時のカスケード処理（Phase2-1で新設）
```
【対象】P02プロジェクト管理画面からの削除・リセット操作

【リセット】対象projectIdに紐づく以下コレクションの
　　　　　　レコードを全て物理削除。projectsレコード自体は保持。
　ecus / buses / frames / signals / applications / approvals /
　gwRoutes / snapshots / changelogs / versionHistories /
　subsetHistories / variants / accessControls

【削除】リセットの全処理に加え、projectsレコード自体も物理削除。

【通常運用時の論理削除ルールとの関係】
　通常運用時（P10行削除・P11サブセット削除等）は
　引き続き論理削除（deletedフラグ）を用いる。
　本カスケード処理は開発・検証用のプロジェクト単位初期化に
　限定した例外的な物理削除であり、既存の論理削除ルールを
　変更するものではない。
```
