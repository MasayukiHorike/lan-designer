// 物理構成Excel（Sheet1～4）パース結果の中間表現
// 参照: docs/design/system-design-v0.6-part2-excel-format.md §① 物理構成Excel

export interface ParsedEcuRow {
  name: string;
  variantNo: string;
  shortName: string;
  department: string;
  remarks: string;
  rowNo: number;
}

export interface ParsedBusRow {
  name: string;
  variantNo: string;
  protocol: 'CAN' | 'CAN-FD';
  baudRate: number;
  dataBaudRate: number | null;
  remarks: string;
  rowNo: number;
}

/** Sheet3/4のヘッダー文字列（"{名前}_{バリナンバー}"形式）をSheet1/2と突合した結果 */
export interface EntityRef {
  raw: string;
  name: string;
  variantNo: string;
  valid: boolean;
}

/** トポロジーシート上の1接続（ECUバリ×バスバリの交点にコネクターIDがある場合のみ生成） */
export interface ParsedTopologyEntry {
  ecu: EntityRef;
  bus: EntityRef;
  connectorId: string;
  rowNo: number;
  colNo: number;
}

export interface ParsedGwRow {
  ecu: EntityRef;
  busRefs: EntityRef[];
  remarks: string;
  rowNo: number;
}

export interface PhysicalConfigParseResult {
  ecuRows: ParsedEcuRow[];
  busRows: ParsedBusRow[];
  topology: ParsedTopologyEntry[];
  gwRows: ParsedGwRow[];
}

// ── 通信データExcel ──────────────────────────
// 参照: docs/design/system-design-v0.6-part2-excel-format.md §② 通信データExcel

export type ElementCommand = '追加' | '変更(verup)' | '削除' | '';
export type PortCommand = '追加' | '変更(verup)' | '削除' | '';
export type TrValue = 'T' | 'R' | '';

/** Dエリア：ECU×コネクター単位のT/R指定（F行・S行共通） */
export interface ParsedTrCell {
  ecuName: string;
  ecuVariantNo: string;
  connectorId: string;
  tr: TrValue;
  e2eUsed: TrValue;
  secocUsed: TrValue;
  /** 途絶時間（ms）。R以外・S行では常にnull */
  timeoutMs: number | null;
  colNo: number;
}

export interface ParsedFrameRow {
  rowNo: number;
  elementCommand: ElementCommand;
  portCommand: PortCommand;
  name: string;
  variantNo: string;
  description: string;
  protocol: 'CAN' | 'CAN-FD';
  canId: string;
  dlc: number;
  cycleTime: number;
  powerSource: string[];
  eventFlag: boolean;
  versionNo: string;
  e2eEnabled: boolean;
  e2eProfile: string;
  e2eDataId: string;
  secocEnabled: boolean;
  secocFvMethod: 'truncatedFV' | 'fullFV' | '';
  secocId: string;
  trCells: ParsedTrCell[];
}

export interface ParsedSignalRow {
  rowNo: number;
  elementCommand: ElementCommand;
  portCommand: PortCommand;
  name: string;
  variantNo: string;
  description: string;
  bitPosition: number;
  bitLength: number;
  endian: 'Motorola' | 'Intel';
  eventCondition: string;
  unit: string;
  resolution: number;
  initialValue: number;
  failValue: number;
  versionNo: string;
  trCells: ParsedTrCell[];
}

export interface ParsedFrameGroup {
  frame: ParsedFrameRow;
  signals: ParsedSignalRow[];
}

export interface ConnectorGroup {
  ecuName: string;
  ecuVariantNo: string;
  connectorId: string;
  colNo: number;
  valid: boolean;
}

export interface CommunicationDataParseResult {
  frameGroups: ParsedFrameGroup[];
  connectorGroups: ConnectorGroup[];
}

// ── GW例外指定Excel ──────────────────────────
// 参照: docs/design/system-design-v0.6-part2-excel-format.md §③ GW例外指定Excel

export type GwExceptionCommand = '追加' | '削除' | '';

export interface ParsedGwExceptionRow {
  rowNo: number;
  command: GwExceptionCommand;
  frameName: string;
  frameVariantNo: string;
  sourceBus: EntityRef;
  targetBus: EntityRef;
  gwVariantNo: string;
  viaGwRefs: EntityRef[];
  remarks: string;
}

export interface GwExceptionParseResult {
  rows: ParsedGwExceptionRow[];
}
