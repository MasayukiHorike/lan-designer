import * as XLSX from 'xlsx';
import type { EntityRef, GwExceptionCommand, GwExceptionParseResult, ParsedGwExceptionRow } from '../../types/excel';
import type { Bus, Ecu } from '../../types/schema';

type SheetRow = (string | number)[];

const VIA_GW_COLUMN_COUNT = 20; // J～AC列（20列）
const VIA_GW_START_COLUMN = 9; // J列（0-based index）

function getFirstSheetRows(workbook: XLSX.WorkBook): SheetRow[] {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], { header: 1, defval: '' });
}

function cellStr(row: SheetRow, col: number): string {
  const v = row[col];
  return v == null ? '' : String(v).trim();
}

function buildKeyMap(entries: { name: string; variantNo: string }[]): Map<string, { name: string; variantNo: string }> {
  const map = new Map<string, { name: string; variantNo: string }>();
  for (const e of entries) map.set(`${e.name}_${e.variantNo}`, e);
  return map;
}

function resolveRef(name: string, variantNo: string, map: Map<string, { name: string; variantNo: string }>): EntityRef {
  const raw = `${name}_${variantNo}`;
  const hit = map.get(raw);
  return hit
    ? { raw, name: hit.name, variantNo: hit.variantNo, valid: true }
    : { raw, name, variantNo, valid: false };
}

function resolveEcuRef(raw: string, map: Map<string, { name: string; variantNo: string }>): EntityRef {
  const hit = map.get(raw);
  if (hit) return { raw, name: hit.name, variantNo: hit.variantNo, valid: true };
  return { raw, name: raw, variantNo: '', valid: false };
}

export async function parseGwExceptionWorkbook(
  file: Blob,
  existingBuses: Bus[],
  existingEcus: Ecu[],
): Promise<GwExceptionParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const rows = getFirstSheetRows(workbook);

  const busKeyMap = buildKeyMap(existingBuses);
  const ecuKeyMap = buildKeyMap(existingEcus);

  const result: ParsedGwExceptionRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const command = cellStr(row, 0) as GwExceptionCommand;
    const frameName = cellStr(row, 2);
    if (!command || !frameName) continue; // 空白行はスキップ

    const viaGwRefs: EntityRef[] = [];
    for (let c = VIA_GW_START_COLUMN; c < VIA_GW_START_COLUMN + VIA_GW_COLUMN_COUNT; c++) {
      const raw = cellStr(row, c);
      if (!raw) break; // 空白セル以降は無効扱い
      viaGwRefs.push(resolveEcuRef(raw, ecuKeyMap));
    }

    result.push({
      rowNo: r + 1,
      command,
      frameName,
      frameVariantNo: cellStr(row, 3),
      sourceBus: resolveRef(cellStr(row, 4), cellStr(row, 5), busKeyMap),
      targetBus: resolveRef(cellStr(row, 6), cellStr(row, 7), busKeyMap),
      gwVariantNo: cellStr(row, 8),
      viaGwRefs,
      remarks: cellStr(row, VIA_GW_START_COLUMN + VIA_GW_COLUMN_COUNT),
    });
  }

  return { rows: result };
}
