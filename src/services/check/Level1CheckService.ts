import type { PhysicalConfigParseResult } from '../../types/excel';
import { buildResult, type CheckIssue } from '../../types/check';

const CONNECTOR_ID_PATTERN = /^[A-Za-z0-9_]+$/;

function findDuplicates<T>(items: T[], keyOf: (item: T) => string): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) {
      dupes.add(key);
    }
    seen.add(key);
  }
  return dupes;
}

/**
 * 物理構成Excel（Sheet1～4）のLevel1チェック
 * 参照: docs/design/system-design-v0.6-part2-excel-format.md §物理構成ExcelのLevel1チェック
 */
export function checkPhysicalConfig(parsed: PhysicalConfigParseResult) {
  const errors: CheckIssue[] = [];

  const dupEcuKeys = findDuplicates(parsed.ecuRows, (r) => `${r.name}_${r.variantNo}`);
  for (const row of parsed.ecuRows) {
    if (dupEcuKeys.has(`${row.name}_${row.variantNo}`)) {
      errors.push({
        code: 'ECU_KEY_DUPLICATE',
        message: `ECU名+バリナンバーが重複しています: ${row.name}_${row.variantNo}（${row.rowNo}行目）`,
      });
    }
  }

  const dupBusKeys = findDuplicates(parsed.busRows, (r) => `${r.name}_${r.variantNo}`);
  for (const row of parsed.busRows) {
    if (dupBusKeys.has(`${row.name}_${row.variantNo}`)) {
      errors.push({
        code: 'BUS_KEY_DUPLICATE',
        message: `バス名+バリナンバーが重複しています: ${row.name}_${row.variantNo}（${row.rowNo}行目）`,
      });
    }
  }

  const dupShortNames = findDuplicates(parsed.ecuRows, (r) => r.shortName);
  for (const row of parsed.ecuRows) {
    if (dupShortNames.has(row.shortName)) {
      errors.push({
        code: 'SHORT_NAME_DUPLICATE',
        message: `ShortNameが重複しています: ${row.shortName}（${row.rowNo}行目）`,
      });
    }
  }

  for (const row of parsed.busRows) {
    if (row.protocol === 'CAN-FD' && row.dataBaudRate == null) {
      errors.push({
        code: 'DATA_BAUD_RATE_MISSING',
        message: `CAN-FD選択時はdataBaudRateが必須です: ${row.name}_${row.variantNo}（${row.rowNo}行目）`,
      });
    }
  }

  for (const entry of parsed.topology) {
    if (!entry.ecu.valid) {
      errors.push({
        code: 'TOPOLOGY_ECU_NOT_FOUND',
        message: `トポロジーの行ヘッダーがSheet1に存在しません: ${entry.ecu.raw}（${entry.rowNo}行目）`,
      });
    }
    if (!entry.bus.valid) {
      errors.push({
        code: 'TOPOLOGY_BUS_NOT_FOUND',
        message: `トポロジーの列ヘッダーがSheet2に存在しません: ${entry.bus.raw}（${entry.colNo}列目）`,
      });
    }
    if (!CONNECTOR_ID_PATTERN.test(entry.connectorId)) {
      errors.push({
        code: 'CONNECTOR_ID_INVALID',
        message: `コネクターIDの形式が不正です: ${entry.connectorId}（${entry.rowNo}行目, ${entry.colNo}列目）`,
      });
    }
  }

  for (const row of parsed.gwRows) {
    if (!row.ecu.valid) {
      errors.push({
        code: 'GW_ECU_NOT_FOUND',
        message: `GW-ECU名+バリナンバーがSheet1に存在しません: ${row.ecu.raw}（${row.rowNo}行目）`,
      });
    }
    for (const busRef of row.busRefs) {
      if (!busRef.valid) {
        errors.push({
          code: 'GW_BUS_NOT_FOUND',
          message: `対応バス名+バリナンバーがSheet2に存在しません: ${busRef.raw}（${row.rowNo}行目）`,
        });
      }
    }
    if (row.busRefs.length < 1) {
      errors.push({
        code: 'GW_BUS_EMPTY',
        message: `対応バスが1つも指定されていません: ${row.ecu.raw}（${row.rowNo}行目）`,
      });
    }
  }

  return buildResult(errors);
}
