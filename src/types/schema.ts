// DBスキーマ全型定義
// 参照: docs/design/system-design-v0.6-part5-roles-schema.md

import type { CheckResult } from './check';

export type Role = 'ECU設計者' | 'ECU承認者' | 'LAN設計者' | 'LAN承認者';

export type Status =
  | 'draft'
  | 'in_review_1st'
  | 'in_review_2nd'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'withdrawn';

export type Permission = 'full' | 'readonly' | 'none';

export type Protocol = 'CAN' | 'CAN-FD';

export type Direction = 'P-Port' | 'R-Port';

export type Endian = 'Motorola' | 'Intel';

export type FvMethod = 'truncatedFV' | 'fullFV';

/** 全コレクション共通メタデータ */
export interface BaseDocument {
  _id: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  deleted: boolean;
}

// ── 1. projects ─────────────────────────────
export interface Project extends BaseDocument {
  name: string;
  description: string;
  status: 'active';
}

// ── 2. variants（サブセット定義）─────────────
export interface VariantEcuConnector {
  ecuId: string;
  connectors: {
    connectorId: string;
    busId: string;
  }[];
}

export interface Variant extends BaseDocument {
  projectId: string;
  generation: string;
  powerTrain: string;
  name: string;
  ecuConnectors: VariantEcuConnector[];
  busVariantIds: string[];
}

// ── 3. ecus ──────────────────────────────────
export interface FramePort {
  framePortId: string;
  frameId: string;
  direction: Direction;
  e2eEnabled: boolean;
  secocEnabled: boolean;
  timeoutMs: number | null;
}

export interface SignalPort {
  signalPortId: string;
  signalId: string;
  direction: Direction;
  e2eEnabled: boolean;
  secocEnabled: boolean;
}

export interface BusConnection {
  busId: string;
  variantIds: string[];
}

export interface EcuConnector {
  connectorId: string;
  name: string;
  busConnections: BusConnection[];
  framePorts: FramePort[];
  signalPorts: SignalPort[];
}

export interface Ecu extends BaseDocument {
  projectId: string;
  name: string;
  variantNo: string;
  shortName: string;
  department: string;
  /** 物理構成ExcelのSheet4（GWリスト）由来。GW-ECUでない場合は空配列 */
  gwBusIds: string[];
  remarks: string;
  connectors: EcuConnector[];
  status: Status;
}

// ── 4. buses ─────────────────────────────────
export interface Bus extends BaseDocument {
  projectId: string;
  name: string;
  variantNo: string;
  protocol: Protocol;
  baudRate: number;
  dataBaudRate: number | null;
  remarks: string;
  status: Status;
}

// ── 5. frames ────────────────────────────────
export interface FrameE2eConfig {
  enabled: boolean;
  profile: string;
  dataId: string;
  reservedBits: number;
  reservedStartBit: number;
}

export interface FrameSecocConfig {
  enabled: boolean;
  fvMethod: FvMethod;
  secocId: string;
  reservedBits: number;
  reservedStartBit: number;
}

export interface Frame extends BaseDocument {
  projectId: string;
  applicationId: string;
  name: string;
  variantNo: string;
  description: string;
  protocol: Protocol;
  canId: string;
  dlc: number;
  cycleTime: number;
  powerSource: string[];
  eventFlag: boolean;
  versionNo: string;
  e2e: FrameE2eConfig;
  secoc: FrameSecocConfig;
  status: Status;
}

// ── 6. signals ───────────────────────────────
export interface Signal extends BaseDocument {
  projectId: string;
  frameId: string;
  applicationId: string;
  name: string;
  variantNo: string;
  description: string;
  bitPosition: number;
  bitLength: number;
  endian: Endian;
  eventCondition: string;
  unit: string;
  resolution: number;
  initialValue: number;
  failValue: number;
  versionNo: string;
  status: Status;
}

// ── 7. versionHistories ──────────────────────
export interface VersionHistory extends BaseDocument {
  projectId: string;
  targetType: 'frame' | 'signal';
  targetId: string;
  versionNo: string;
  applicationId: string;
  changedAt: string;
  snapshot: Record<string, unknown>;
}

// ── 8. applications ──────────────────────────
export type ApproverStatus = 'pending' | 'approved' | 'rejected';

export interface ApproverEntry {
  email: string;
  status: ApproverStatus;
  actionAt?: string;
}

export interface FirstStageApprovers {
  ecuName: string;
  approvers: ApproverEntry[];
}

export interface ApplicationApprovers {
  firstStage: FirstStageApprovers[];
  secondStage: ApproverEntry[];
}

export interface ImportFile {
  ecuName: string;
  communicationDataFileRef?: string;
  communicationDataFileBlob?: Blob;
  gwExceptionFileRef?: string;
  gwExceptionFileBlob?: Blob;
}

export interface EditHistoryEntry {
  editedAt: string;
  editedBy: string;
  stage: Status;
  method: 'excel' | 'manual';
  changes: unknown[];
}

export interface ApplicationCheckResults {
  level1: CheckResult;
  level2: Record<string, CheckResult>;
}

export interface Application extends BaseDocument {
  projectId: string;
  applicationNo: string;
  applicantEcuName: string;
  title: string;
  description: string;
  comment: string;
  status: Status;
  applicantId: string;
  approvers: ApplicationApprovers;
  importFiles: ImportFile[];
  editHistories: EditHistoryEntry[];
  checkResults: ApplicationCheckResults;
}

// ── 9. approvals ─────────────────────────────
export interface Approval extends BaseDocument {
  applicationId: string;
  stage: '1st' | '2nd';
  ecuName: string;
  approverId: string;
  action: 'approved' | 'rejected' | 'withdrawn';
  comment: string;
  actionAt: string;
}

// ── 10. gwRoutes ─────────────────────────────
export interface GwRoute extends BaseDocument {
  projectId: string;
  frameId: string;
  frameVariantNo: string;
  sourceBusId: string;
  targetBusId: string;
  gwVariantNo: string;
  viaGwIds: string[];
  isException: boolean;
  applicationId: string;
  status: Status;
}

// ── 11. snapshots ─────────────────────────────
export interface Snapshot extends BaseDocument {
  projectId: string;
  sequenceNo: number;
  snapshotName: string;
  confirmedAt: string;
  confirmedBy: string;
  ecuIds: string[];
  busIds: string[];
  frameIds: string[];
  signalIds: string[];
  gwRouteIds: string[];
}

// ── 12. changelogs ────────────────────────────
export interface ChangelogEntry {
  type: 'added' | 'modified' | 'deleted';
  targetType: 'frame' | 'signal';
  targetId: string;
  ecuId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface Changelog extends BaseDocument {
  projectId: string;
  snapshotId: string;
  previousSnapshotId: string | null;
  changes: ChangelogEntry[];
}

// ── 13. subsetHistories ──────────────────────
export interface SubsetHistory extends BaseDocument {
  projectId: string;
  variantId: string;
  changedAt: string;
  changedBy: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

// ── 14. accessControls ────────────────────────
export interface AccessControl extends BaseDocument {
  projectId: string;
  screenId: string;
  screenName: string;
  permissions: Record<Role, Permission>;
}
