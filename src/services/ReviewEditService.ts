import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import { EcuRepository } from '../repositories/EcuRepository';
import { ApplicationRepository } from '../repositories/ApplicationRepository';
import { GwRouteRepository } from '../repositories/GwRouteRepository';
import { getCurrentApprovalSlot, buildFrameKeys } from './ApplicationService';
import { reflectCommunicationData, type ReflectionContext } from './CommunicationDataReflectionService';
import { regenerateGwRoutesForFrame, applyGwExceptions } from './GwRouteService';
import { runLevel2Checks } from './check/Level2CheckService';
import {
  checkCommunicationData,
  checkGwException,
  type CommunicationDataCheckContext,
} from './check/Level1CheckService';
import { parseCommunicationDataWorkbook } from './excel/CommunicationDataImportService';
import { parseGwExceptionWorkbook } from './excel/GwExceptionImportService';
import { getAvailableBits } from '../utils/bitLayout';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import type {
  Application,
  Direction,
  EditHistoryEntry,
  Frame,
  ImportFile,
  Role,
  Signal,
  Status,
} from '../types/schema';
import type { CommunicationDataParseResult, ParsedTrCell } from '../types/excel';

const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();
const ecuRepo = new EcuRepository();
const applicationRepo = new ApplicationRepository();
const gwRouteRepo = new GwRouteRepository();

/** 現在の対応順がLAN承認者（二次）かどうか（承認操作パネルの表示条件と同一基準） */
export function canLanApproverEdit(application: Application, role: Role | null): boolean {
  const slot = getCurrentApprovalSlot(application);
  return !!slot && slot.stage === '2nd' && role === 'LAN承認者';
}

function requireLanApproverTurn(application: Application, role: Role | null): void {
  if (!canLanApproverEdit(application, role)) {
    throw new Error('現在の対応順のLAN承認者のみ編集・再インポートができます');
  }
}

type ChangeEntry = { field: string; before: unknown; after: unknown };

function diffFields<T extends object>(current: T, patch: Partial<T>): ChangeEntry[] {
  const changes: ChangeEntry[] = [];
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const before = current[key];
    const after = patch[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ field: String(key), before, after });
    }
  }
  return changes;
}

async function appendEditHistory(
  application: Application,
  entry: Omit<EditHistoryEntry, 'editedAt'>,
  actorId: string,
): Promise<Application> {
  const editHistories = [...application.editHistories, { ...entry, editedAt: nowIso() }];
  return applicationRepo.update(application._id, { editHistories }, actorId);
}

/** Port編集後のLevel2再計算・反映（GWルート有無・孤立Tx/Rx等がPort状態に依存するため） */
export async function refreshLevel2(application: Application, actorId: string): Promise<Application> {
  const level2 = await runLevel2Checks(application.projectId);
  return applicationRepo.update(
    application._id,
    { checkResults: { ...application.checkResults, level2 } },
    actorId,
  );
}

// ── Frame/Signalプロパティ直接編集 ──────────────────────

export type FrameEditableFields = Pick<
  Frame,
  'description' | 'protocol' | 'canId' | 'dlc' | 'cycleTime' | 'powerSource' | 'eventFlag' | 'e2e' | 'secoc'
>;

export type SignalEditableFields = Pick<
  Signal,
  | 'description'
  | 'bitPosition'
  | 'bitLength'
  | 'endian'
  | 'eventCondition'
  | 'unit'
  | 'resolution'
  | 'initialValue'
  | 'failValue'
>;

/** ビット位置・ビット長の簡易範囲チェック（網羅的な重複検出はLevel2チェックに委ねる） */
function validateSignalBitRange(frame: Frame, bitPosition: number, bitLength: number): void {
  const totalBits = frame.dlc * 8;
  if (bitPosition < 0 || bitLength <= 0 || bitPosition + bitLength > totalBits) {
    throw new Error(`ビット位置・ビット長がフレーム長（${totalBits}ビット）の範囲外です`);
  }
  const available = getAvailableBits(frame.dlc, frame.e2e.enabled, frame.secoc.enabled, frame.secoc.fvMethod);
  if (bitLength > available) {
    throw new Error(`ビット長がSignal使用可能領域（${available}ビット）を超えています`);
  }
  if (
    frame.e2e.enabled &&
    bitPosition < frame.e2e.reservedStartBit + frame.e2e.reservedBits &&
    bitPosition + bitLength > frame.e2e.reservedStartBit
  ) {
    throw new Error('E2E予約領域と重複しています');
  }
  if (frame.secoc.enabled && bitPosition + bitLength > frame.secoc.reservedStartBit) {
    throw new Error('SecOC予約領域と重複しています');
  }
}

/** LAN承認者による二次審査中のFrameプロパティ直接編集（この申請書が持ち込んだFrameのみ対象） */
export async function editFrameProperties(
  application: Application,
  frameId: string,
  patch: Partial<FrameEditableFields>,
  role: Role | null,
  actorId: string,
): Promise<Application> {
  requireLanApproverTurn(application, role);
  const frame = await frameRepo.findById(frameId);
  if (!frame) throw new Error('対象のFrameが見つかりません');
  if (frame.applicationId !== application._id) {
    throw new Error('この申請書が持ち込んだFrameのみ編集できます');
  }

  const changes = diffFields(frame, patch);
  if (changes.length === 0) return application;

  await frameRepo.update(frameId, patch, actorId);
  const withHistory = await appendEditHistory(
    application,
    { editedBy: actorId, stage: application.status, method: 'manual', changes },
    actorId,
  );
  const level2 = await runLevel2Checks(application.projectId);
  return applicationRepo.update(
    withHistory._id,
    { checkResults: { ...withHistory.checkResults, level2 } },
    actorId,
  );
}

/** LAN承認者による二次審査中のSignalプロパティ直接編集（この申請書が持ち込んだSignalのみ対象） */
export async function editSignalProperties(
  application: Application,
  signalId: string,
  patch: Partial<SignalEditableFields>,
  role: Role | null,
  actorId: string,
): Promise<Application> {
  requireLanApproverTurn(application, role);
  const signal = await signalRepo.findById(signalId);
  if (!signal) throw new Error('対象のSignalが見つかりません');
  if (signal.applicationId !== application._id) {
    throw new Error('この申請書が持ち込んだSignalのみ編集できます');
  }

  const bitPosition = patch.bitPosition ?? signal.bitPosition;
  const bitLength = patch.bitLength ?? signal.bitLength;
  const frame = await frameRepo.findById(signal.frameId);
  if (frame && (patch.bitPosition !== undefined || patch.bitLength !== undefined)) {
    validateSignalBitRange(frame, bitPosition, bitLength);
  }

  const changes = diffFields(signal, patch);
  if (changes.length === 0) return application;

  await signalRepo.update(signalId, patch, actorId);
  const withHistory = await appendEditHistory(
    application,
    { editedBy: actorId, stage: application.status, method: 'manual', changes },
    actorId,
  );
  const level2 = await runLevel2Checks(application.projectId);
  return applicationRepo.update(
    withHistory._id,
    { checkResults: { ...withHistory.checkResults, level2 } },
    actorId,
  );
}

// ── Excel再インポート ──────────────────────────────

function upsertImportFile(importFiles: ImportFile[], ecuName: string, patch: Partial<ImportFile>): ImportFile[] {
  const next = [...importFiles];
  const idx = next.findIndex((f) => f.ecuName === ecuName);
  if (idx >= 0) next[idx] = { ...next[idx], ...patch };
  else next.push({ ecuName, ...patch });
  return next;
}

function summarizeFrameGroups(parsed: CommunicationDataParseResult): ChangeEntry[] {
  const changes: ChangeEntry[] = [];
  for (const group of parsed.frameGroups) {
    if (group.frame.elementCommand) {
      changes.push({
        field: `frame:${group.frame.name}_${group.frame.variantNo}`,
        before: '',
        after: group.frame.elementCommand,
      });
    }
    for (const s of group.signals) {
      if (s.elementCommand) {
        changes.push({ field: `signal:${s.name}_${s.variantNo}`, before: '', after: s.elementCommand });
      }
    }
  }
  return changes;
}

/**
 * 二次審査中のLAN承認者によるExcel再インポート。draft時のregisterCommunicationDataFileと
 * 同じパイプライン（Level1→DB反映→Level2）を再利用するが、ctx.statusを申請書の現在ステータス
 * （in_review_2nd）のまま渡すためFrame/Signalのステータスは退行しない。
 */
export async function reimportCommunicationDataFile(
  application: Application,
  ecuName: string,
  file: File,
  context: CommunicationDataCheckContext,
  role: Role | null,
  actorId: string,
): Promise<Application> {
  requireLanApproverTurn(application, role);
  const parsed = await parseCommunicationDataWorkbook(file, context.ecus);
  const level1 = checkCommunicationData(parsed, context);

  const importFiles = upsertImportFile(application.importFiles, ecuName, {
    communicationDataFileRef: newId('files'),
    communicationDataFileBlob: file,
  });

  if (level1.status === 'error') {
    return applicationRepo.update(
      application._id,
      { importFiles, checkResults: { ...application.checkResults, level1 } },
      actorId,
    );
  }

  const ctx: ReflectionContext = {
    projectId: application.projectId,
    applicationId: application._id,
    status: application.status,
    actorId,
  };
  await reflectCommunicationData(parsed, ctx);

  const level2 = await runLevel2Checks(application.projectId);
  const updated = await applicationRepo.update(
    application._id,
    { importFiles, checkResults: { level1, level2 } },
    actorId,
  );
  return appendEditHistory(
    updated,
    { editedBy: actorId, stage: application.status, method: 'excel', changes: summarizeFrameGroups(parsed) },
    actorId,
  );
}

/** 二次審査中のLAN承認者によるGW例外指定Excel再インポート（registerGwExceptionFileと同じパイプライン） */
export async function reimportGwExceptionFile(
  application: Application,
  ecuName: string,
  file: File,
  context: CommunicationDataCheckContext,
  role: Role | null,
  actorId: string,
): Promise<Application> {
  requireLanApproverTurn(application, role);

  const importFiles = upsertImportFile(application.importFiles, ecuName, {
    gwExceptionFileRef: newId('files'),
    gwExceptionFileBlob: file,
  });

  const { keys: frameKeys } = await buildFrameKeys(importFiles, context.ecus);
  const existingRoutes = await gwRouteRepo.findByProjectId(application.projectId);
  const parsed = await parseGwExceptionWorkbook(file, context.buses, context.ecus);
  const level1 = checkGwException(parsed, { frameKeys, ecus: context.ecus, existingRoutes });

  if (level1.status === 'error') {
    return applicationRepo.update(
      application._id,
      { importFiles, checkResults: { ...application.checkResults, level1 } },
      actorId,
    );
  }

  await applyGwExceptions(parsed, application.projectId, application._id, application.status, actorId);

  const level2 = await runLevel2Checks(application.projectId);
  const updated = await applicationRepo.update(
    application._id,
    { importFiles, checkResults: { level1, level2 } },
    actorId,
  );
  return appendEditHistory(
    updated,
    {
      editedBy: actorId,
      stage: application.status,
      method: 'excel',
      changes: parsed.rows
        .filter((r) => r.command)
        .map((r) => ({ field: `gwException:${r.frameName}_${r.frameVariantNo}`, before: '', after: r.command })),
    },
    actorId,
  );
}

// ── FramePort/SignalPort直接編集 ──────────────────────

export interface EditableFramePort {
  ecuId: string;
  ecuName: string;
  ecuVariantNo: string;
  connectorId: string;
  connectorName: string;
  framePortId: string;
  direction: Direction;
  e2eEnabled: boolean;
  secocEnabled: boolean;
  timeoutMs: number | null;
}

export interface EditableSignalPort {
  ecuId: string;
  ecuName: string;
  ecuVariantNo: string;
  connectorId: string;
  connectorName: string;
  signalPortId: string;
  direction: Direction;
  e2eEnabled: boolean;
  secocEnabled: boolean;
}

export interface ConnectorOption {
  ecuId: string;
  ecuName: string;
  ecuVariantNo: string;
  connectorId: string;
  connectorName: string;
}

export async function listConnectorOptions(projectId: string): Promise<ConnectorOption[]> {
  const ecus = await ecuRepo.findPublished(projectId);
  const options: ConnectorOption[] = [];
  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      options.push({
        ecuId: ecu._id,
        ecuName: ecu.name,
        ecuVariantNo: ecu.variantNo,
        connectorId: connector.connectorId,
        connectorName: connector.name,
      });
    }
  }
  return options;
}

export async function getEditableFramePorts(projectId: string, frameId: string): Promise<EditableFramePort[]> {
  const ecus = await ecuRepo.findByProjectId(projectId);
  const result: EditableFramePort[] = [];
  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      for (const fp of connector.framePorts) {
        if (fp.frameId === frameId) {
          result.push({
            ecuId: ecu._id,
            ecuName: ecu.name,
            ecuVariantNo: ecu.variantNo,
            connectorId: connector.connectorId,
            connectorName: connector.name,
            framePortId: fp.framePortId,
            direction: fp.direction,
            e2eEnabled: fp.e2eEnabled,
            secocEnabled: fp.secocEnabled,
            timeoutMs: fp.timeoutMs,
          });
        }
      }
    }
  }
  return result;
}

export async function getEditableSignalPorts(projectId: string, signalId: string): Promise<EditableSignalPort[]> {
  const ecus = await ecuRepo.findByProjectId(projectId);
  const result: EditableSignalPort[] = [];
  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      for (const sp of connector.signalPorts) {
        if (sp.signalId === signalId) {
          result.push({
            ecuId: ecu._id,
            ecuName: ecu.name,
            ecuVariantNo: ecu.variantNo,
            connectorId: connector.connectorId,
            connectorName: connector.name,
            signalPortId: sp.signalPortId,
            direction: sp.direction,
            e2eEnabled: sp.e2eEnabled,
            secocEnabled: sp.secocEnabled,
          });
        }
      }
    }
  }
  return result;
}

export interface PortEditContext {
  projectId: string;
  applicationId: string;
  status: Status;
  actorId: string;
}

/** FramePort編集後、そのFrameのGWルートを現在のPort状態から自動再生成する */
async function regenerateGwRoutesFromLivePorts(frame: Frame, ctx: PortEditContext): Promise<void> {
  const ports = await getEditableFramePorts(ctx.projectId, frame._id);
  const trCells: ParsedTrCell[] = ports.map((p) => ({
    ecuName: p.ecuName,
    ecuVariantNo: p.ecuVariantNo,
    connectorId: p.connectorId,
    tr: p.direction === 'P-Port' ? 'T' : 'R',
    e2eUsed: p.e2eEnabled ? (p.direction === 'P-Port' ? 'T' : 'R') : '',
    secocUsed: p.secocEnabled ? (p.direction === 'P-Port' ? 'T' : 'R') : '',
    timeoutMs: p.timeoutMs,
    colNo: 0,
  }));
  await regenerateGwRoutesForFrame(frame, trCells, ctx.projectId, ctx.applicationId, ctx.status, ctx.actorId);
}

export async function upsertFramePort(
  ecuId: string,
  connectorId: string,
  port: {
    framePortId?: string;
    frameId: string;
    direction: Direction;
    e2eEnabled: boolean;
    secocEnabled: boolean;
    timeoutMs: number | null;
  },
  ctx: PortEditContext,
): Promise<void> {
  const ecu = await ecuRepo.findById(ecuId);
  if (!ecu) throw new Error('ECUが見つかりません');
  const connector = ecu.connectors.find((c) => c.connectorId === connectorId);
  if (!connector) throw new Error('コネクターが見つかりません');

  const idx = port.framePortId ? connector.framePorts.findIndex((p) => p.framePortId === port.framePortId) : -1;
  if (idx >= 0) {
    connector.framePorts[idx] = { ...connector.framePorts[idx], ...port };
  } else {
    connector.framePorts.push({ framePortId: crypto.randomUUID(), ...port });
  }
  await ecuRepo.update(ecuId, { connectors: ecu.connectors }, ctx.actorId);

  const frame = await frameRepo.findById(port.frameId);
  if (frame) await regenerateGwRoutesFromLivePorts(frame, ctx);
}

export async function removeFramePort(
  ecuId: string,
  connectorId: string,
  framePortId: string,
  frameId: string,
  ctx: PortEditContext,
): Promise<void> {
  const ecu = await ecuRepo.findById(ecuId);
  if (!ecu) throw new Error('ECUが見つかりません');
  const connector = ecu.connectors.find((c) => c.connectorId === connectorId);
  if (!connector) throw new Error('コネクターが見つかりません');
  connector.framePorts = connector.framePorts.filter((p) => p.framePortId !== framePortId);
  await ecuRepo.update(ecuId, { connectors: ecu.connectors }, ctx.actorId);

  const frame = await frameRepo.findById(frameId);
  if (frame) await regenerateGwRoutesFromLivePorts(frame, ctx);
}

export async function upsertSignalPort(
  ecuId: string,
  connectorId: string,
  port: { signalPortId?: string; signalId: string; direction: Direction; e2eEnabled: boolean; secocEnabled: boolean },
  actorId: string,
): Promise<void> {
  const ecu = await ecuRepo.findById(ecuId);
  if (!ecu) throw new Error('ECUが見つかりません');
  const connector = ecu.connectors.find((c) => c.connectorId === connectorId);
  if (!connector) throw new Error('コネクターが見つかりません');

  const idx = port.signalPortId ? connector.signalPorts.findIndex((p) => p.signalPortId === port.signalPortId) : -1;
  if (idx >= 0) {
    connector.signalPorts[idx] = { ...connector.signalPorts[idx], ...port };
  } else {
    connector.signalPorts.push({ signalPortId: crypto.randomUUID(), ...port });
  }
  await ecuRepo.update(ecuId, { connectors: ecu.connectors }, actorId);
}

export async function removeSignalPort(
  ecuId: string,
  connectorId: string,
  signalPortId: string,
  actorId: string,
): Promise<void> {
  const ecu = await ecuRepo.findById(ecuId);
  if (!ecu) throw new Error('ECUが見つかりません');
  const connector = ecu.connectors.find((c) => c.connectorId === connectorId);
  if (!connector) throw new Error('コネクターが見つかりません');
  connector.signalPorts = connector.signalPorts.filter((p) => p.signalPortId !== signalPortId);
  await ecuRepo.update(ecuId, { connectors: ecu.connectors }, actorId);
}
