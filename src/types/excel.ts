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
