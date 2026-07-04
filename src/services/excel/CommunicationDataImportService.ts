import * as XLSX from 'xlsx';
import type {
  CommunicationDataParseResult,
  ConnectorGroup,
  ElementCommand,
  ParsedFrameGroup,
  ParsedFrameRow,
  ParsedSignalRow,
  ParsedTrCell,
  PortCommand,
  TrValue,
} from '../../types/excel';
import type { Ecu } from '../../types/schema';

type SheetRow = (string | number)[];

const FIXED_COLUMN_COUNT = 33; // Aエリア(5) + Bエリア(16) + Cエリア(12)
const D_GROUP_WIDTH = 4;

function getFirstSheetRows(workbook: XLSX.WorkBook): SheetRow[] {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], { header: 1, defval: '' });
}

function cellStr(row: SheetRow, col: number): string {
  const v = row[col];
  return v == null ? '' : String(v).trim();
}

function cellNum(row: SheetRow, col: number): number {
  const v = row[col];
  if (v === '' || v == null) return 0;
  return Number(v) || 0;
}

function cellNumOrNull(row: SheetRow, col: number): number | null {
  const raw = cellStr(row, col);
  return raw ? Number(raw) || 0 : null;
}

function toTrValue(raw: string): TrValue {
  return raw === 'T' || raw === 'R' ? raw : '';
}

function buildConnectorGroups(headerRow: SheetRow, existingEcus: Ecu[]): ConnectorGroup[] {
  const prefixes = existingEcus
    .map((e) => `${e.name}_${e.variantNo}`)
    .sort((a, b) => b.length - a.length); // 最長一致を優先

  const groups: ConnectorGroup[] = [];
  for (let col = FIXED_COLUMN_COUNT; col < headerRow.length; col += D_GROUP_WIDTH) {
    const label = cellStr(headerRow, col);
    if (!label) break;

    const prefix = prefixes.find((p) => label === p || label.startsWith(`${p}_`));
    if (prefix) {
      const ecu = existingEcus.find((e) => `${e.name}_${e.variantNo}` === prefix)!;
      groups.push({
        ecuName: ecu.name,
        ecuVariantNo: ecu.variantNo,
        connectorId: label.slice(prefix.length + 1),
        colNo: col + 1,
        valid: true,
      });
    } else {
      groups.push({ ecuName: label, ecuVariantNo: '', connectorId: '', colNo: col + 1, valid: false });
    }
  }
  return groups;
}

function parseTrCells(row: SheetRow, connectorGroups: ConnectorGroup[], isFrameRow: boolean): ParsedTrCell[] {
  return connectorGroups.map((group) => {
    const base = group.colNo - 1;
    const tr = toTrValue(cellStr(row, base));
    const e2eUsed = toTrValue(cellStr(row, base + 1));
    const secocUsed = toTrValue(cellStr(row, base + 2));
    const timeoutMs = isFrameRow && tr === 'R' ? cellNumOrNull(row, base + 3) : null;
    return {
      ecuName: group.ecuName,
      ecuVariantNo: group.ecuVariantNo,
      connectorId: group.connectorId,
      tr,
      e2eUsed,
      secocUsed,
      timeoutMs,
      colNo: group.colNo,
    };
  });
}

function parseFrameRow(row: SheetRow, rowNo: number, connectorGroups: ConnectorGroup[]): ParsedFrameRow {
  return {
    rowNo,
    elementCommand: cellStr(row, 1) as ElementCommand,
    portCommand: cellStr(row, 3) as PortCommand,
    name: cellStr(row, 5),
    variantNo: cellStr(row, 6),
    description: cellStr(row, 7),
    protocol: cellStr(row, 8) === 'CAN-FD' ? 'CAN-FD' : 'CAN',
    canId: cellStr(row, 9),
    dlc: cellNum(row, 10),
    cycleTime: cellNum(row, 11),
    powerSource: cellStr(row, 12)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    eventFlag: cellStr(row, 13) === 'ON',
    versionNo: cellStr(row, 14),
    e2eEnabled: cellStr(row, 15) === 'ON',
    e2eProfile: cellStr(row, 16),
    e2eDataId: cellStr(row, 17),
    secocEnabled: cellStr(row, 18) === 'ON',
    secocFvMethod: cellStr(row, 19) === 'フルFV' ? 'fullFV' : cellStr(row, 19) === 'トランケートFV' ? 'truncatedFV' : '',
    secocId: cellStr(row, 20),
    trCells: parseTrCells(row, connectorGroups, true),
  };
}

function parseSignalRow(row: SheetRow, rowNo: number, connectorGroups: ConnectorGroup[]): ParsedSignalRow {
  return {
    rowNo,
    elementCommand: cellStr(row, 1) as ElementCommand,
    portCommand: cellStr(row, 3) as PortCommand,
    name: cellStr(row, 21),
    variantNo: cellStr(row, 22),
    description: cellStr(row, 23),
    bitPosition: cellNum(row, 24),
    bitLength: cellNum(row, 25),
    endian: cellStr(row, 26) === 'Intel' ? 'Intel' : 'Motorola',
    eventCondition: cellStr(row, 27),
    unit: cellStr(row, 28),
    resolution: cellNum(row, 29),
    initialValue: cellNum(row, 30),
    failValue: cellNum(row, 31),
    versionNo: cellStr(row, 32),
    trCells: parseTrCells(row, connectorGroups, false),
  };
}

export async function parseCommunicationDataWorkbook(
  file: Blob,
  existingEcus: Ecu[],
): Promise<CommunicationDataParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const rows = getFirstSheetRows(workbook);
  if (rows.length === 0) {
    return { frameGroups: [], connectorGroups: [] };
  }

  const connectorGroups = buildConnectorGroups(rows[0], existingEcus);

  const frameGroups: ParsedFrameGroup[] = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const kind = cellStr(row, 0);
    if (kind !== 'F' && kind !== 'S') continue; // 空白行はスキップ

    if (kind === 'F') {
      frameGroups.push({ frame: parseFrameRow(row, r + 1, connectorGroups), signals: [] });
    } else if (frameGroups.length > 0) {
      frameGroups[frameGroups.length - 1].signals.push(parseSignalRow(row, r + 1, connectorGroups));
    }
  }

  return { frameGroups, connectorGroups };
}
