import * as XLSX from 'xlsx';
import type {
  EntityRef,
  ParsedBusRow,
  ParsedEcuRow,
  ParsedGwRow,
  ParsedTopologyEntry,
  PhysicalConfigParseResult,
} from '../../types/excel';

type SheetRow = (string | number)[];

const GW_BUS_COLUMN_COUNT = 20; // Sheet4 B～U列

function getSheetRows(workbook: XLSX.WorkBook, sheetIndex: number): SheetRow[] {
  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, defval: '' });
}

function cellStr(row: SheetRow, col: number): string {
  const v = row[col];
  return v == null ? '' : String(v).trim();
}

function stripAnnotation(text: string): string {
  // 行/列ヘッダーの "Engine_00（V6）" のような補足説明を除去する
  return text.replace(/[（(][^）)]*[）)]\s*$/, '').trim();
}

function buildKeyMap(entries: { name: string; variantNo: string }[]): Map<string, { name: string; variantNo: string }> {
  const map = new Map<string, { name: string; variantNo: string }>();
  for (const e of entries) {
    map.set(`${e.name}_${e.variantNo}`, e);
  }
  return map;
}

function resolveRef(raw: string, map: Map<string, { name: string; variantNo: string }>): EntityRef {
  const key = stripAnnotation(raw);
  const hit = map.get(key);
  if (hit) {
    return { raw, name: hit.name, variantNo: hit.variantNo, valid: true };
  }
  return { raw, name: key, variantNo: '', valid: false };
}

function parseEcuSheet(rows: SheetRow[]): ParsedEcuRow[] {
  const result: ParsedEcuRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = cellStr(row, 0);
    if (!name) continue;
    result.push({
      name,
      variantNo: cellStr(row, 1),
      shortName: cellStr(row, 2),
      department: cellStr(row, 3),
      remarks: cellStr(row, 4),
      rowNo: r + 1,
    });
  }
  return result;
}

function parseBusSheet(rows: SheetRow[]): ParsedBusRow[] {
  const result: ParsedBusRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = cellStr(row, 0);
    if (!name) continue;
    const dataBaudRateStr = cellStr(row, 4);
    result.push({
      name,
      variantNo: cellStr(row, 1),
      protocol: cellStr(row, 2) === 'CAN-FD' ? 'CAN-FD' : 'CAN',
      baudRate: Number(row[3]) || 0,
      dataBaudRate: dataBaudRateStr ? Number(dataBaudRateStr) : null,
      remarks: cellStr(row, 5),
      rowNo: r + 1,
    });
  }
  return result;
}

function parseTopologySheet(
  rows: SheetRow[],
  ecuKeyMap: Map<string, { name: string; variantNo: string }>,
  busKeyMap: Map<string, { name: string; variantNo: string }>,
): ParsedTopologyEntry[] {
  if (rows.length === 0) return [];
  const header = rows[0];
  const columns: { colIndex: number; bus: EntityRef }[] = [];
  for (let c = 1; c < header.length; c++) {
    const raw = cellStr(header, c);
    if (!raw) continue;
    columns.push({ colIndex: c, bus: resolveRef(raw, busKeyMap) });
  }

  const entries: ParsedTopologyEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawEcu = cellStr(row, 0);
    if (!rawEcu) continue;
    const ecu = resolveRef(rawEcu, ecuKeyMap);
    for (const { colIndex, bus } of columns) {
      const connectorId = cellStr(row, colIndex);
      if (!connectorId) continue;
      entries.push({ ecu, bus, connectorId, rowNo: r + 1, colNo: colIndex + 1 });
    }
  }
  return entries;
}

function parseGwSheet(
  rows: SheetRow[],
  ecuKeyMap: Map<string, { name: string; variantNo: string }>,
  busKeyMap: Map<string, { name: string; variantNo: string }>,
): ParsedGwRow[] {
  const result: ParsedGwRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawEcu = cellStr(row, 0);
    if (!rawEcu) continue;
    const ecu = resolveRef(rawEcu, ecuKeyMap);
    const busRefs: EntityRef[] = [];
    for (let c = 1; c <= GW_BUS_COLUMN_COUNT; c++) {
      const raw = cellStr(row, c);
      if (!raw) break; // 空白セル以降は無効扱い
      busRefs.push(resolveRef(raw, busKeyMap));
    }
    result.push({
      ecu,
      busRefs,
      remarks: cellStr(row, GW_BUS_COLUMN_COUNT + 1),
      rowNo: r + 1,
    });
  }
  return result;
}

export async function parsePhysicalConfigWorkbook(file: File): Promise<PhysicalConfigParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const ecuRows = parseEcuSheet(getSheetRows(workbook, 0));
  const busRows = parseBusSheet(getSheetRows(workbook, 1));
  const ecuKeyMap = buildKeyMap(ecuRows);
  const busKeyMap = buildKeyMap(busRows);
  const topology = parseTopologySheet(getSheetRows(workbook, 2), ecuKeyMap, busKeyMap);
  const gwRows = parseGwSheet(getSheetRows(workbook, 3), ecuKeyMap, busKeyMap);

  return { ecuRows, busRows, topology, gwRows };
}
