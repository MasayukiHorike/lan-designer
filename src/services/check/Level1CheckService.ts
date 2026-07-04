import type { CommunicationDataParseResult, ParsedFrameGroup, PhysicalConfigParseResult } from '../../types/excel';
import { buildResult, type CheckIssue } from '../../types/check';
import type { Bus, Ecu, Frame, Signal } from '../../types/schema';
import { compareVersions, isValidVersionFormat } from '../../utils/versionUtils';

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

export interface CommunicationDataCheckContext {
  existingFrames: Frame[];
  existingSignals: Signal[];
  ecus: Ecu[];
  buses: Bus[];
}

function checkFrameGroup(
  group: ParsedFrameGroup,
  context: CommunicationDataCheckContext,
  errors: CheckIssue[],
): void {
  const { frame, signals } = group;
  const loc = `Frame_${frame.name}_${frame.variantNo}（${frame.rowNo}行目）`;
  const existing = context.existingFrames.find(
    (f) => f.name === frame.name && f.variantNo === frame.variantNo,
  );

  if (frame.elementCommand) {
    if (!frame.versionNo) {
      errors.push({ code: 'VERSION_MISSING', message: `バージョンNo未記載です: ${loc}` });
    } else if (!isValidVersionFormat(frame.versionNo)) {
      errors.push({ code: 'VERSION_FORMAT_INVALID', message: `バージョンNoの形式が不正です: ${loc}` });
    }

    if (frame.elementCommand === '追加' && existing?.status === 'published' && !existing.deleted) {
      errors.push({ code: 'ADD_ON_PUBLISHED', message: `published済み要素に追加コマンドが指定されています: ${loc}` });
    }
    if (frame.elementCommand === '変更(verup)') {
      if (!existing) {
        errors.push({ code: 'VERUP_NOT_REGISTERED', message: `未登録要素に変更(verup)コマンドが指定されています: ${loc}` });
      } else if (existing.deleted) {
        errors.push({ code: 'VERUP_DELETED', message: `削除済み要素に変更(verup)コマンドが指定されています: ${loc}` });
      }
    }
    if (existing && !existing.deleted && frame.versionNo && isValidVersionFormat(frame.versionNo) && isValidVersionFormat(existing.versionNo)) {
      if (compareVersions(frame.versionNo, existing.versionNo) <= 0) {
        errors.push({ code: 'VERSION_NOT_NEWER', message: `既存より古い（または同一の）バージョンが指定されています: ${loc}` });
      }
    }
  }

  if (frame.e2eEnabled) {
    if (!frame.e2eProfile) {
      errors.push({ code: 'E2E_PROFILE_MISSING', message: `E2E有効時はプロファイルが必須です: ${loc}` });
    } else if (frame.e2eProfile !== 'P02') {
      errors.push({ code: 'E2E_PROFILE_INVALID', message: `E2Eプロファイルが規定値(P02)以外です: ${loc}` });
    }
    if (!frame.e2eDataId) {
      errors.push({ code: 'E2E_DATA_ID_MISSING', message: `E2E有効時はDataIdが必須です: ${loc}` });
    }
  }

  if (frame.secocEnabled) {
    if (!frame.secocFvMethod) {
      errors.push({ code: 'SECOC_FV_METHOD_MISSING', message: `SecOC有効時はFV方式が必須です: ${loc}` });
    }
    if (!frame.secocId) {
      errors.push({ code: 'SECOC_ID_MISSING', message: `SecOC有効時はSecOC用IDが必須です: ${loc}` });
    }
  }

  if (!frame.eventFlag && signals.some((s) => s.eventCondition === 'W' || s.eventCondition === 'C')) {
    errors.push({ code: 'EVENT_FLAG_OFF_BUT_SIGNAL_EVENT', message: `フレームイベントフラグOFFですが配下シグナルにW/Cが指定されています: ${loc}` });
  }
  if (frame.eventFlag && signals.length > 0 && signals.every((s) => s.eventCondition === '-')) {
    errors.push({ code: 'EVENT_FLAG_ON_BUT_NO_SIGNAL_EVENT', message: `フレームイベントフラグONですが配下シグナルが全て「-」です: ${loc}` });
  }
  for (const signal of signals) {
    if (signal.elementCommand && !signal.eventCondition) {
      errors.push({
        code: 'EVENT_CONDITION_MISSING',
        message: `イベント条件が未記載です: Signal_${signal.name}_${signal.variantNo}（${signal.rowNo}行目）`,
      });
    }
  }

  if (!context.ecus.some((e) => e.variantNo === frame.variantNo)) {
    errors.push({ code: 'FRAME_VARIANT_ECU_NOT_FOUND', message: `フレームバリ番号に対応するECUバリナンバーが物理構成に存在しません: ${loc}` });
  }
  if (!context.buses.some((b) => b.variantNo === frame.variantNo)) {
    errors.push({ code: 'FRAME_VARIANT_BUS_NOT_FOUND', message: `フレームバリ番号に対応するバスバリナンバーが物理構成に存在しません: ${loc}` });
  }

  for (let i = 0; i < frame.trCells.length; i++) {
    const fCell = frame.trCells[i];
    const connLoc = `${fCell.ecuName}_${fCell.ecuVariantNo}/${fCell.connectorId}`;

    if (fCell.tr === '' && (fCell.e2eUsed !== '' || fCell.secocUsed !== '')) {
      errors.push({ code: 'TR_BLANK_WITH_E2E_SECOC', message: `T/R空白でE2E/SecOCが記載されています: ${connLoc} ${loc}` });
    }
    if (!frame.e2eEnabled && fCell.e2eUsed !== '') {
      errors.push({ code: 'E2E_USED_WHILE_DISABLED', message: `フレームE2E無効なのにE2E利用が記載されています: ${connLoc} ${loc}` });
    }
    if (!frame.secocEnabled && fCell.secocUsed !== '') {
      errors.push({ code: 'SECOC_USED_WHILE_DISABLED', message: `フレームSecOC無効なのにSecOC利用が記載されています: ${connLoc} ${loc}` });
    }
    if (fCell.tr !== 'R' && fCell.timeoutMs != null) {
      errors.push({ code: 'TIMEOUT_WITHOUT_R', message: `R以外で途絶時間が記載されています: ${connLoc} ${loc}` });
    }

    for (const signal of signals) {
      const sCell = signal.trCells[i];
      const sigLoc = `Signal_${signal.name}_${signal.variantNo}（${signal.rowNo}行目）`;
      if (sCell.timeoutMs != null) {
        errors.push({ code: 'TIMEOUT_ON_SIGNAL_ROW', message: `途絶時間がS行に記載されています: ${connLoc} ${sigLoc}` });
      }
      if (sCell.tr === '' && (sCell.e2eUsed !== '' || sCell.secocUsed !== '')) {
        errors.push({ code: 'TR_BLANK_WITH_E2E_SECOC', message: `T/R空白でE2E/SecOCが記載されています: ${connLoc} ${sigLoc}` });
      }
      if (!frame.e2eEnabled && sCell.e2eUsed !== '') {
        errors.push({ code: 'E2E_USED_WHILE_DISABLED', message: `フレームE2E無効なのにE2E利用が記載されています: ${connLoc} ${sigLoc}` });
      }
      if (!frame.secocEnabled && sCell.secocUsed !== '') {
        errors.push({ code: 'SECOC_USED_WHILE_DISABLED', message: `フレームSecOC無効なのにSecOC利用が記載されています: ${connLoc} ${sigLoc}` });
      }
      if (fCell.tr === 'T' && sCell.tr === 'R') {
        errors.push({ code: 'FRAME_T_SIGNAL_R', message: `FrameがTのコネクターでSignalがRです: ${connLoc} ${sigLoc}` });
      }
      if (fCell.tr === 'R' && sCell.tr === 'T') {
        errors.push({ code: 'FRAME_R_SIGNAL_T', message: `FrameがRのコネクターでSignalがTです: ${connLoc} ${sigLoc}` });
      }
      if (fCell.tr === '' && sCell.tr !== '') {
        errors.push({ code: 'FRAME_NO_TR_SIGNAL_TR', message: `FrameにT/R記載がないコネクターにSignalのT/Rが記載されています: ${connLoc} ${sigLoc}` });
      }
    }
  }
}

/**
 * 通信データExcelのLevel1チェック
 * 参照: docs/design/system-design-v0.6-part2-excel-format.md §通信データExcelのLevel1チェック
 */
export function checkCommunicationData(
  parsed: CommunicationDataParseResult,
  context: CommunicationDataCheckContext,
) {
  const errors: CheckIssue[] = [];
  for (const group of parsed.frameGroups) {
    checkFrameGroup(group, context, errors);
  }
  return buildResult(errors);
}
