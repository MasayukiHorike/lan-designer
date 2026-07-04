import { GwRouteRepository } from '../repositories/GwRouteRepository';
import { EcuRepository } from '../repositories/EcuRepository';
import { FrameRepository } from '../repositories/FrameRepository';
import { BusRepository } from '../repositories/BusRepository';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import { compareVersions } from '../utils/versionUtils';
import type { Ecu, Frame, Status } from '../types/schema';
import type { GwExceptionParseResult, ParsedTrCell } from '../types/excel';

const gwRouteRepo = new GwRouteRepository();
const ecuRepo = new EcuRepository();
const frameRepo = new FrameRepository();
const busRepo = new BusRepository();

/** コネクターが複数バスに接続可能な場合は先頭候補を採用する簡易解決（SubsetServiceと同様の簡略化） */
function resolveBusId(ecus: Ecu[], ecuName: string, ecuVariantNo: string, connectorId: string): string | undefined {
  const ecu = ecus.find((e) => e.name === ecuName && e.variantNo === ecuVariantNo);
  const connector = ecu?.connectors.find((c) => c.connectorId === connectorId);
  return connector?.busConnections[0]?.busId;
}

function latestFrame(frames: Frame[], name: string, variantNo: string): Frame | undefined {
  return frames
    .filter((f) => f.name === name && f.variantNo === variantNo && !f.deleted)
    .sort((a, b) => compareVersions(b.versionNo, a.versionNo))[0];
}

/**
 * フレームのTx/Rxバス差異からGW経路を自動生成・更新する（Part3 §9）。
 * 例外指定（isException:true）が既にある経路は自動生成で上書きしない。
 * 簡略化：GW-ECUが直接両バスを橋渡しする単一ホップのみ解決する（多段中継は対象外）。
 */
export async function regenerateGwRoutesForFrame(
  frame: Frame,
  trCells: ParsedTrCell[],
  projectId: string,
  applicationId: string,
  status: Status,
  actorId: string,
): Promise<void> {
  const ecus = await ecuRepo.findByProjectId(projectId);
  const txBuses = new Set<string>();
  const rxBuses = new Set<string>();

  for (const cell of trCells) {
    if (cell.tr === '') continue;
    const busId = resolveBusId(ecus, cell.ecuName, cell.ecuVariantNo, cell.connectorId);
    if (!busId) continue;
    (cell.tr === 'T' ? txBuses : rxBuses).add(busId);
  }

  const existingRoutes = await gwRouteRepo.findByFrameId(frame._id);
  const now = nowIso();

  for (const sourceBusId of txBuses) {
    for (const targetBusId of rxBuses) {
      if (sourceBusId === targetBusId) continue;
      const already = existingRoutes.find((r) => r.sourceBusId === sourceBusId && r.targetBusId === targetBusId);
      if (already?.isException) continue;

      const bridgingEcu = ecus.find((e) => e.gwBusIds.includes(sourceBusId) && e.gwBusIds.includes(targetBusId));
      const patch = {
        gwVariantNo: bridgingEcu?.variantNo ?? '',
        viaGwIds: bridgingEcu ? [bridgingEcu._id] : [],
        status,
        applicationId,
      };

      if (already) {
        await gwRouteRepo.update(already._id, patch, actorId);
      } else {
        await gwRouteRepo.create({
          _id: newId('gwRoutes'),
          projectId,
          frameId: frame._id,
          frameVariantNo: frame.variantNo,
          sourceBusId,
          targetBusId,
          isException: false,
          ...patch,
          createdAt: now,
          createdBy: actorId,
          updatedAt: now,
          updatedBy: actorId,
          deleted: false,
        });
      }
    }
  }
}

/**
 * GW例外指定Excelのパース結果をGwRoutesに反映する（Level1エラーなしの場合のみ呼び出すこと）。
 * 自動生成結果を上書きし、isException:trueとして扱う。
 */
export async function applyGwExceptions(
  parsed: GwExceptionParseResult,
  projectId: string,
  applicationId: string,
  status: Status,
  actorId: string,
): Promise<void> {
  const [frames, buses, ecus] = await Promise.all([
    frameRepo.findAllIncludingDeleted(projectId),
    busRepo.findByProjectId(projectId),
    ecuRepo.findByProjectId(projectId),
  ]);
  const now = nowIso();

  for (const row of parsed.rows) {
    if (!row.command) continue;
    const frame = latestFrame(frames, row.frameName, row.frameVariantNo);
    if (!frame) continue;

    const sourceBus = buses.find((b) => b.name === row.sourceBus.name && b.variantNo === row.sourceBus.variantNo);
    const targetBus = buses.find((b) => b.name === row.targetBus.name && b.variantNo === row.targetBus.variantNo);
    if (!sourceBus || !targetBus) continue;

    const existingRoutes = await gwRouteRepo.findByFrameId(frame._id);
    const existing = existingRoutes.find(
      (r) => r.sourceBusId === sourceBus._id && r.targetBusId === targetBus._id,
    );

    if (row.command === '削除') {
      if (existing) await gwRouteRepo.softDelete(existing._id, actorId);
      continue;
    }

    const viaGwIds = row.viaGwRefs
      .filter((ref) => ref.valid)
      .map((ref) => ecus.find((e) => e.name === ref.name && e.variantNo === ref.variantNo)?._id)
      .filter((id): id is string => !!id);

    const patch = {
      gwVariantNo: row.gwVariantNo,
      viaGwIds,
      isException: true,
      status,
      applicationId,
    };

    if (existing) {
      await gwRouteRepo.update(existing._id, patch, actorId);
    } else {
      await gwRouteRepo.create({
        _id: newId('gwRoutes'),
        projectId,
        frameId: frame._id,
        frameVariantNo: frame.variantNo,
        sourceBusId: sourceBus._id,
        targetBusId: targetBus._id,
        ...patch,
        createdAt: now,
        createdBy: actorId,
        updatedAt: now,
        updatedBy: actorId,
        deleted: false,
      });
    }
  }
}
