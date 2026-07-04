import type {
  CommunicationDataParseResult,
  ElementCommand,
  GwExceptionParseResult,
  ParsedFrameGroup,
  PhysicalConfigParseResult,
} from '../../types/excel';
import { buildResult, type CheckIssue } from '../../types/check';
import type { Bus, Ecu, Frame, GwRoute, Signal, Status } from '../../types/schema';
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

/**
 * コマンド×ステータスの許可マトリクス（Part2 §通信データExcel）
 * 現在のステータス | 追加 | 変更(verup) | 削除
 * 未登録           |  ○  |     ✗      |  ✗
 * draft           |  ○  |     ✗      |  ○
 * in_review_1st   |  ✗  |     ✗      |  ✗
 * in_review_2nd   |  ○  |     ○      |  ○ （LAN承認者のみ・本チェックではロールは判定しない）
 * approved        |  ✗  |     ✗      |  ✗
 * published       |  ✗  |     ○      |  ○
 */
function checkCommandAgainstStatus(
  command: ElementCommand,
  existing: { status: Status; deleted: boolean } | undefined,
  loc: string,
  errors: CheckIssue[],
): void {
  if (!existing || existing.deleted) {
    if (command !== '追加') {
      errors.push({
        code: 'COMMAND_ON_UNREGISTERED',
        message: `未登録（または削除済み）の要素に「${command}」コマンドは指定できません: ${loc}`,
      });
    }
    return;
  }

  if (existing.status === 'in_review_1st' || existing.status === 'approved') {
    errors.push({
      code: 'COMMAND_ON_LOCKED_STATUS',
      message: `ステータスが${existing.status}の間はいかなるコマンドも指定できません: ${loc}`,
    });
    return;
  }

  if (command === '追加' && (existing.status === 'published' || existing.status === 'in_review_2nd')) {
    if (existing.status === 'published') {
      errors.push({ code: 'ADD_ON_PUBLISHED', message: `published済み要素に追加コマンドが指定されています: ${loc}` });
    }
    // in_review_2nd での「追加」はLAN承認者のみ許可（ロール判定は呼び出し側の責務）
  }
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
      errors.push({ code: 'VERSION_MISSING', field: 'versionNo', message: `バージョンNo未記載です: ${loc}` });
    } else if (!isValidVersionFormat(frame.versionNo)) {
      errors.push({ code: 'VERSION_FORMAT_INVALID', field: 'versionNo', message: `バージョンNoの形式が不正です: ${loc}` });
    }

    checkCommandAgainstStatus(frame.elementCommand, existing, loc, errors);

    if (existing && !existing.deleted && frame.versionNo && isValidVersionFormat(frame.versionNo) && isValidVersionFormat(existing.versionNo)) {
      if (compareVersions(frame.versionNo, existing.versionNo) <= 0) {
        errors.push({ code: 'VERSION_NOT_NEWER', field: 'versionNo', message: `既存より古い（または同一の）バージョンが指定されています: ${loc}` });
      }
    }
  }

  if (frame.e2eEnabled) {
    if (!frame.e2eProfile) {
      errors.push({ code: 'E2E_PROFILE_MISSING', field: 'e2e', message: `E2E有効時はプロファイルが必須です: ${loc}` });
    } else if (frame.e2eProfile !== 'P02') {
      errors.push({ code: 'E2E_PROFILE_INVALID', field: 'e2e', message: `E2Eプロファイルが規定値(P02)以外です: ${loc}` });
    }
    if (!frame.e2eDataId) {
      errors.push({ code: 'E2E_DATA_ID_MISSING', field: 'e2e', message: `E2E有効時はDataIdが必須です: ${loc}` });
    }
  }

  if (frame.secocEnabled) {
    if (!frame.secocFvMethod) {
      errors.push({ code: 'SECOC_FV_METHOD_MISSING', field: 'secoc', message: `SecOC有効時はFV方式が必須です: ${loc}` });
    }
    if (!frame.secocId) {
      errors.push({ code: 'SECOC_ID_MISSING', field: 'secoc', message: `SecOC有効時はSecOC用IDが必須です: ${loc}` });
    }
  }

  if (!frame.eventFlag && signals.some((s) => s.eventCondition === 'W' || s.eventCondition === 'C')) {
    errors.push({ code: 'EVENT_FLAG_OFF_BUT_SIGNAL_EVENT', field: 'eventFlag', message: `フレームイベントフラグOFFですが配下シグナルにW/Cが指定されています: ${loc}` });
  }
  if (frame.eventFlag && signals.length > 0 && signals.every((s) => s.eventCondition === '-')) {
    errors.push({ code: 'EVENT_FLAG_ON_BUT_NO_SIGNAL_EVENT', field: 'eventFlag', message: `フレームイベントフラグONですが配下シグナルが全て「-」です: ${loc}` });
  }
  for (const signal of signals) {
    const sigLoc = `Signal_${signal.name}_${signal.variantNo}（${signal.rowNo}行目）`;
    if (signal.elementCommand && !signal.eventCondition) {
      errors.push({ code: 'EVENT_CONDITION_MISSING', field: 'eventCondition', message: `イベント条件が未記載です: ${sigLoc}` });
    }

    if (signal.elementCommand) {
      const existingSignal = context.existingSignals.find(
        (s) => s.name === signal.name && s.variantNo === signal.variantNo,
      );
      if (!signal.versionNo) {
        errors.push({ code: 'VERSION_MISSING', field: 'versionNo', message: `バージョンNo未記載です: ${sigLoc}` });
      } else if (!isValidVersionFormat(signal.versionNo)) {
        errors.push({ code: 'VERSION_FORMAT_INVALID', field: 'versionNo', message: `バージョンNoの形式が不正です: ${sigLoc}` });
      }

      checkCommandAgainstStatus(signal.elementCommand, existingSignal, sigLoc, errors);

      if (
        existingSignal &&
        !existingSignal.deleted &&
        signal.versionNo &&
        isValidVersionFormat(signal.versionNo) &&
        isValidVersionFormat(existingSignal.versionNo)
      ) {
        if (compareVersions(signal.versionNo, existingSignal.versionNo) <= 0) {
          errors.push({ code: 'VERSION_NOT_NEWER', field: 'versionNo', message: `既存より古い（または同一の）バージョンが指定されています: ${sigLoc}` });
        }
      }
    }
  }

  if (!context.ecus.some((e) => e.variantNo === frame.variantNo)) {
    errors.push({ code: 'FRAME_VARIANT_ECU_NOT_FOUND', field: 'variantNo', message: `フレームバリ番号に対応するECUバリナンバーが物理構成に存在しません: ${loc}` });
  }
  if (!context.buses.some((b) => b.variantNo === frame.variantNo)) {
    errors.push({ code: 'FRAME_VARIANT_BUS_NOT_FOUND', field: 'variantNo', message: `フレームバリ番号に対応するバスバリナンバーが物理構成に存在しません: ${loc}` });
  }

  for (let i = 0; i < frame.trCells.length; i++) {
    const fCell = frame.trCells[i];
    const connLoc = `${fCell.ecuName}_${fCell.ecuVariantNo}/${fCell.connectorId}`;

    if (fCell.tr === '' && (fCell.e2eUsed !== '' || fCell.secocUsed !== '')) {
      errors.push({ code: 'TR_BLANK_WITH_E2E_SECOC', field: 'trPorts', message: `T/R空白でE2E/SecOCが記載されています: ${connLoc} ${loc}` });
    }
    if (!frame.e2eEnabled && fCell.e2eUsed !== '') {
      errors.push({ code: 'E2E_USED_WHILE_DISABLED', field: 'trPorts', message: `フレームE2E無効なのにE2E利用が記載されています: ${connLoc} ${loc}` });
    }
    if (!frame.secocEnabled && fCell.secocUsed !== '') {
      errors.push({ code: 'SECOC_USED_WHILE_DISABLED', field: 'trPorts', message: `フレームSecOC無効なのにSecOC利用が記載されています: ${connLoc} ${loc}` });
    }
    if (fCell.tr !== 'R' && fCell.timeoutMs != null) {
      errors.push({ code: 'TIMEOUT_WITHOUT_R', field: 'trPorts', message: `R以外で途絶時間が記載されています: ${connLoc} ${loc}` });
    }

    for (const signal of signals) {
      const sCell = signal.trCells[i];
      const sigLoc = `Signal_${signal.name}_${signal.variantNo}（${signal.rowNo}行目）`;
      if (sCell.timeoutMs != null) {
        errors.push({ code: 'TIMEOUT_ON_SIGNAL_ROW', field: 'trPorts', message: `途絶時間がS行に記載されています: ${connLoc} ${sigLoc}` });
      }
      if (sCell.tr === '' && (sCell.e2eUsed !== '' || sCell.secocUsed !== '')) {
        errors.push({ code: 'TR_BLANK_WITH_E2E_SECOC', field: 'trPorts', message: `T/R空白でE2E/SecOCが記載されています: ${connLoc} ${sigLoc}` });
      }
      if (!frame.e2eEnabled && sCell.e2eUsed !== '') {
        errors.push({ code: 'E2E_USED_WHILE_DISABLED', field: 'trPorts', message: `フレームE2E無効なのにE2E利用が記載されています: ${connLoc} ${sigLoc}` });
      }
      if (!frame.secocEnabled && sCell.secocUsed !== '') {
        errors.push({ code: 'SECOC_USED_WHILE_DISABLED', field: 'trPorts', message: `フレームSecOC無効なのにSecOC利用が記載されています: ${connLoc} ${sigLoc}` });
      }
      if (fCell.tr === 'T' && sCell.tr === 'R') {
        errors.push({ code: 'FRAME_T_SIGNAL_R', field: 'trPorts', message: `FrameがTのコネクターでSignalがRです: ${connLoc} ${sigLoc}` });
      }
      if (fCell.tr === 'R' && sCell.tr === 'T') {
        errors.push({ code: 'FRAME_R_SIGNAL_T', field: 'trPorts', message: `FrameがRのコネクターでSignalがTです: ${connLoc} ${sigLoc}` });
      }
      if (fCell.tr === '' && sCell.tr !== '') {
        errors.push({ code: 'FRAME_NO_TR_SIGNAL_TR', field: 'trPorts', message: `FrameにT/R記載がないコネクターにSignalのT/Rが記載されています: ${connLoc} ${sigLoc}` });
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

export interface GwExceptionCheckContext {
  /** 同一申請内で登録された通信データExcelのフレームキー（name_variantNo） */
  frameKeys: Set<string>;
  ecus: Ecu[];
  existingRoutes: GwRoute[];
}

function gwExceptionKey(row: {
  frameName: string;
  frameVariantNo: string;
  sourceBus: { name: string; variantNo: string };
  targetBus: { name: string; variantNo: string };
  gwVariantNo: string;
}): string {
  return [
    row.frameName,
    row.frameVariantNo,
    row.sourceBus.name,
    row.sourceBus.variantNo,
    row.targetBus.name,
    row.targetBus.variantNo,
    row.gwVariantNo,
  ].join('/');
}

/**
 * GW例外指定ExcelのLevel1チェック
 * 参照: docs/design/system-design-v0.6-part2-excel-format.md §GW例外指定ExcelのLevel1チェック
 */
export function checkGwException(parsed: GwExceptionParseResult, context: GwExceptionCheckContext) {
  const errors: CheckIssue[] = [];
  const dupKeys = findDuplicates(parsed.rows, gwExceptionKey);

  for (const row of parsed.rows) {
    const loc = `Frame_${row.frameName}_${row.frameVariantNo}（${row.rowNo}行目）`;
    const frameKey = `${row.frameName}_${row.frameVariantNo}`;

    if (!context.frameKeys.has(frameKey)) {
      errors.push({ code: 'GW_EXCEPTION_FRAME_NOT_FOUND', message: `フレーム名+バリ番号が通信データに存在しません: ${loc}` });
    }
    if (!row.sourceBus.valid) {
      errors.push({ code: 'GW_EXCEPTION_SOURCE_BUS_NOT_FOUND', message: `送信元バス名+バリ番号が物理構成に存在しません: ${loc}` });
    }
    if (!row.targetBus.valid) {
      errors.push({ code: 'GW_EXCEPTION_TARGET_BUS_NOT_FOUND', message: `受信先バス名+バリ番号が物理構成に存在しません: ${loc}` });
    }
    if (row.sourceBus.valid && row.targetBus.valid && row.sourceBus.raw === row.targetBus.raw) {
      errors.push({ code: 'GW_EXCEPTION_SAME_BUS', message: `送信元バスと受信先バスが同一です: ${loc}` });
    }
    if (row.viaGwRefs.length < 1) {
      errors.push({ code: 'GW_EXCEPTION_VIA_GW_EMPTY', message: `経由GW列が空白です（J列必須）: ${loc}` });
    }
    for (const viaGw of row.viaGwRefs) {
      if (!viaGw.valid) {
        errors.push({ code: 'GW_EXCEPTION_VIA_GW_NOT_FOUND', message: `経由GW-ECU名+バリナンバーが物理構成に存在しません: ${loc}` });
        continue;
      }
      const ecu = context.ecus.find((e) => e.name === viaGw.name && e.variantNo === viaGw.variantNo);
      if (!ecu || ecu.gwBusIds.length === 0) {
        errors.push({ code: 'GW_EXCEPTION_VIA_GW_NOT_REGISTERED', message: `経由GWが物理構成GWリストに登録されていません: ${viaGw.raw}（${loc}）` });
      }
    }
    if (dupKeys.has(gwExceptionKey(row))) {
      errors.push({ code: 'GW_EXCEPTION_KEY_DUPLICATE', message: `一意キーが重複しています: ${loc}` });
    }
    if (row.command === '削除') {
      const exists = context.existingRoutes.some(
        (r) =>
          r.frameVariantNo === row.frameVariantNo &&
          !r.deleted &&
          gwExceptionKey({
            frameName: row.frameName,
            frameVariantNo: row.frameVariantNo,
            sourceBus: row.sourceBus,
            targetBus: row.targetBus,
            gwVariantNo: row.gwVariantNo,
          }) === gwExceptionKey(row),
      );
      if (!exists) {
        errors.push({ code: 'GW_EXCEPTION_DELETE_NOT_REGISTERED', message: `削除対象の経路が未登録です: ${loc}` });
      }
    }
  }

  return buildResult(errors);
}
