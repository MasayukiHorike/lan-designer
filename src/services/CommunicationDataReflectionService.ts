import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import { EcuRepository } from '../repositories/EcuRepository';
import { VersionHistoryRepository } from '../repositories/VersionHistoryRepository';
import { regenerateGwRoutesForFrame } from './GwRouteService';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import { compareVersions } from '../utils/versionUtils';
import type {
  CommunicationDataParseResult,
  ParsedFrameGroup,
  ParsedFrameRow,
  ParsedSignalRow,
  ParsedTrCell,
} from '../types/excel';
import type { Direction, Ecu, Frame, Signal, Status } from '../types/schema';

const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();
const ecuRepo = new EcuRepository();
const versionHistoryRepo = new VersionHistoryRepository();

interface ReflectionContext {
  projectId: string;
  applicationId: string;
  status: Status;
  actorId: string;
}

function latestOf<T extends { versionNo: string; deleted: boolean }>(docs: T[]): T | undefined {
  return docs
    .filter((d) => !d.deleted)
    .sort((a, b) => compareVersions(b.versionNo, a.versionNo))[0];
}

async function recordVersionHistory(
  targetType: 'frame' | 'signal',
  targetId: string,
  versionNo: string,
  snapshot: Frame | Signal,
  ctx: ReflectionContext,
): Promise<void> {
  const now = nowIso();
  await versionHistoryRepo.create({
    _id: newId('versionHistories'),
    projectId: ctx.projectId,
    targetType,
    targetId,
    versionNo,
    applicationId: ctx.applicationId,
    changedAt: now,
    snapshot: snapshot as unknown as Record<string, unknown>,
    createdAt: now,
    createdBy: ctx.actorId,
    updatedAt: now,
    updatedBy: ctx.actorId,
    deleted: false,
  });
}

async function resolveFrameDoc(row: ParsedFrameRow, ctx: ReflectionContext): Promise<Frame | null> {
  if (!row.elementCommand) return null;

  const all = await frameRepo.findAllIncludingDeleted(ctx.projectId);
  const candidates = all.filter((f) => f.name === row.name && f.variantNo === row.variantNo);
  const existing = latestOf(candidates);
  const now = nowIso();

  if (row.elementCommand === '削除') {
    if (!existing) return null;
    await recordVersionHistory('frame', existing._id, existing.versionNo, existing, ctx);
    await frameRepo.update(
      existing._id,
      { deleted: true, status: ctx.status, applicationId: ctx.applicationId },
      ctx.actorId,
    );
    return null;
  }

  const base: Omit<Frame, '_id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'deleted'> = {
    projectId: ctx.projectId,
    applicationId: ctx.applicationId,
    name: row.name,
    variantNo: row.variantNo,
    description: row.description,
    protocol: row.protocol,
    canId: row.canId,
    dlc: row.dlc,
    cycleTime: row.cycleTime,
    powerSource: row.powerSource,
    eventFlag: row.eventFlag,
    versionNo: row.versionNo,
    e2e: {
      enabled: row.e2eEnabled,
      profile: row.e2eProfile,
      dataId: row.e2eDataId,
      reservedBits: 24,
      reservedStartBit: 0,
    },
    secoc: {
      enabled: row.secocEnabled,
      fvMethod: row.secocFvMethod || 'truncatedFV',
      secocId: row.secocId,
      reservedBits: row.secocFvMethod === 'fullFV' ? 88 : 32,
      reservedStartBit: row.dlc * 8 - (row.secocFvMethod === 'fullFV' ? 88 : 32),
    },
    status: ctx.status,
  };

  if (row.elementCommand === '追加') {
    if (!existing) {
      const frame: Frame = { _id: newId('frames'), ...base, createdAt: now, createdBy: ctx.actorId, updatedAt: now, updatedBy: ctx.actorId, deleted: false };
      await frameRepo.create(frame);
      return frame;
    }
    // draft（またはin_review_2nd）中の要素への再登録＝上書き更新（Level1でstatus検証済み）
    return frameRepo.update(existing._id, base, ctx.actorId);
  }

  if (row.elementCommand === '変更(verup)') {
    if (!existing) return null; // Level1で検出済みのはずだが念のため
    await recordVersionHistory('frame', existing._id, existing.versionNo, existing, ctx);
    const frame: Frame = { _id: newId('frames'), ...base, createdAt: now, createdBy: ctx.actorId, updatedAt: now, updatedBy: ctx.actorId, deleted: false };
    await frameRepo.create(frame);
    return frame;
  }

  return null;
}

async function resolveSignalDoc(row: ParsedSignalRow, frameId: string, ctx: ReflectionContext): Promise<Signal | null> {
  if (!row.elementCommand) return null;

  const all = await signalRepo.findAllIncludingDeleted(ctx.projectId);
  const candidates = all.filter((s) => s.name === row.name && s.variantNo === row.variantNo);
  const existing = latestOf(candidates);
  const now = nowIso();

  if (row.elementCommand === '削除') {
    if (!existing) return null;
    await recordVersionHistory('signal', existing._id, existing.versionNo, existing, ctx);
    await signalRepo.update(
      existing._id,
      { deleted: true, status: ctx.status, applicationId: ctx.applicationId },
      ctx.actorId,
    );
    return null;
  }

  const base: Omit<Signal, '_id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'deleted'> = {
    projectId: ctx.projectId,
    frameId,
    applicationId: ctx.applicationId,
    name: row.name,
    variantNo: row.variantNo,
    description: row.description,
    bitPosition: row.bitPosition,
    bitLength: row.bitLength,
    endian: row.endian,
    eventCondition: row.eventCondition,
    unit: row.unit,
    resolution: row.resolution,
    initialValue: row.initialValue,
    failValue: row.failValue,
    versionNo: row.versionNo,
    status: ctx.status,
  };

  if (row.elementCommand === '追加') {
    if (!existing) {
      const signal: Signal = { _id: newId('signals'), ...base, createdAt: now, createdBy: ctx.actorId, updatedAt: now, updatedBy: ctx.actorId, deleted: false };
      await signalRepo.create(signal);
      return signal;
    }
    return signalRepo.update(existing._id, base, ctx.actorId);
  }

  if (row.elementCommand === '変更(verup)') {
    if (!existing) return null;
    await recordVersionHistory('signal', existing._id, existing.versionNo, existing, ctx);
    const signal: Signal = { _id: newId('signals'), ...base, createdAt: now, createdBy: ctx.actorId, updatedAt: now, updatedBy: ctx.actorId, deleted: false };
    await signalRepo.create(signal);
    return signal;
  }

  return null;
}

interface PortEdit {
  ecuKey: string;
  connectorId: string;
  targetId: string;
  kind: 'frame' | 'signal';
  cell: ParsedTrCell | null; // nullならポート削除
}

async function applyPortEdits(edits: PortEdit[], ctx: ReflectionContext): Promise<void> {
  if (edits.length === 0) return;
  const ecus = await ecuRepo.findByProjectId(ctx.projectId);
  const byKey = new Map(ecus.map((e) => [`${e.name}_${e.variantNo}`, e]));
  const touched = new Set<string>();

  for (const edit of edits) {
    const ecu = byKey.get(edit.ecuKey);
    if (!ecu) continue;
    const connector = ecu.connectors.find((c) => c.connectorId === edit.connectorId);
    if (!connector) continue;

    if (edit.kind === 'frame') {
      const idx = connector.framePorts.findIndex((p) => p.frameId === edit.targetId);
      if (!edit.cell) {
        if (idx >= 0) connector.framePorts.splice(idx, 1);
      } else {
        const direction: Direction = edit.cell.tr === 'T' ? 'P-Port' : 'R-Port';
        const patch = {
          frameId: edit.targetId,
          direction,
          e2eEnabled: edit.cell.e2eUsed !== '',
          secocEnabled: edit.cell.secocUsed !== '',
          timeoutMs: edit.cell.timeoutMs,
        };
        if (idx >= 0) connector.framePorts[idx] = { ...connector.framePorts[idx], ...patch };
        else connector.framePorts.push({ framePortId: crypto.randomUUID(), ...patch });
      }
    } else {
      const idx = connector.signalPorts.findIndex((p) => p.signalId === edit.targetId);
      if (!edit.cell) {
        if (idx >= 0) connector.signalPorts.splice(idx, 1);
      } else {
        const direction: Direction = edit.cell.tr === 'T' ? 'P-Port' : 'R-Port';
        const patch = {
          signalId: edit.targetId,
          direction,
          e2eEnabled: edit.cell.e2eUsed !== '',
          secocEnabled: edit.cell.secocUsed !== '',
        };
        if (idx >= 0) connector.signalPorts[idx] = { ...connector.signalPorts[idx], ...patch };
        else connector.signalPorts.push({ signalPortId: crypto.randomUUID(), ...patch });
      }
    }
    touched.add(edit.ecuKey);
  }

  for (const key of touched) {
    const ecu = byKey.get(key) as Ecu;
    await ecuRepo.update(ecu._id, { connectors: ecu.connectors }, ctx.actorId);
  }
}

async function reflectFrameGroup(group: ParsedFrameGroup, ctx: ReflectionContext): Promise<void> {
  const frame = await resolveFrameDoc(group.frame, ctx);
  const portEdits: PortEdit[] = [];

  if (frame) {
    for (const cell of group.frame.trCells) {
      portEdits.push({
        ecuKey: `${cell.ecuName}_${cell.ecuVariantNo}`,
        connectorId: cell.connectorId,
        targetId: frame._id,
        kind: 'frame',
        cell: cell.tr === '' ? null : cell,
      });
    }
  }

  for (const signalRow of group.signals) {
    const signal = frame ? await resolveSignalDoc(signalRow, frame._id, ctx) : null;
    if (!signal) continue;
    for (const cell of signalRow.trCells) {
      portEdits.push({
        ecuKey: `${cell.ecuName}_${cell.ecuVariantNo}`,
        connectorId: cell.connectorId,
        targetId: signal._id,
        kind: 'signal',
        cell: cell.tr === '' ? null : cell,
      });
    }
  }

  await applyPortEdits(portEdits, ctx);

  if (frame) {
    await regenerateGwRoutesForFrame(frame, group.frame.trCells, ctx.projectId, ctx.applicationId, ctx.status, ctx.actorId);
  }
}

/**
 * 通信データExcelのパース結果をDBに反映する（Level1エラーなしの場合のみ呼び出すこと）。
 * Frame/Signal/FramePort/SignalPortをファイル登録直後にdraft相当のステータスで作成・更新し、
 * 以降はApplication側のステータス遷移に合わせて同期する（Part3 Step2準拠）。
 */
export async function reflectCommunicationData(
  parsed: CommunicationDataParseResult,
  ctx: ReflectionContext,
): Promise<void> {
  for (const group of parsed.frameGroups) {
    await reflectFrameGroup(group, ctx);
  }
}

export type { ReflectionContext };
