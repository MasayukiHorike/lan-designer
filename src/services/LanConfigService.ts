import { EcuRepository } from '../repositories/EcuRepository';
import { BusRepository } from '../repositories/BusRepository';
import { VariantRepository } from '../repositories/VariantRepository';
import { GwRouteRepository } from '../repositories/GwRouteRepository';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import type { Bus, Ecu, EcuConnector } from '../types/schema';
import type { PhysicalConfigParseResult } from '../types/excel';

const ecuRepo = new EcuRepository();
const busRepo = new BusRepository();
const variantRepo = new VariantRepository();
const gwRouteRepo = new GwRouteRepository();

export interface ImportSummary {
  createdEcus: number;
  updatedEcus: number;
  createdBuses: number;
  updatedBuses: number;
}

function keyOf(name: string, variantNo: string): string {
  return `${name}_${variantNo}`;
}

/**
 * 物理構成Excelの取込（差分更新：追加・変更のみ。削除は行削除操作で行う）
 */
export async function importPhysicalConfig(
  projectId: string,
  parsed: PhysicalConfigParseResult,
  actorId: string,
): Promise<ImportSummary> {
  const summary: ImportSummary = { createdEcus: 0, updatedEcus: 0, createdBuses: 0, updatedBuses: 0 };
  const now = nowIso();

  // 1. バスをupsertし、name_variantNo → busId のマップを作る
  const existingBuses = await busRepo.findAll(projectId);
  const busByKey = new Map(existingBuses.map((b) => [keyOf(b.name, b.variantNo), b]));
  const busIdByKey = new Map<string, string>();

  for (const row of parsed.busRows) {
    const key = keyOf(row.name, row.variantNo);
    const existing = busByKey.get(key);
    if (existing) {
      await busRepo.update(
        existing._id,
        {
          protocol: row.protocol,
          baudRate: row.baudRate,
          dataBaudRate: row.dataBaudRate,
          remarks: row.remarks,
        },
        actorId,
      );
      busIdByKey.set(key, existing._id);
      summary.updatedBuses++;
    } else {
      const bus: Bus = {
        _id: newId('buses'),
        projectId,
        name: row.name,
        variantNo: row.variantNo,
        protocol: row.protocol,
        baudRate: row.baudRate,
        dataBaudRate: row.dataBaudRate,
        remarks: row.remarks,
        status: 'published',
        createdAt: now,
        createdBy: actorId,
        updatedAt: now,
        updatedBy: actorId,
        deleted: false,
      };
      await busRepo.create(bus);
      busIdByKey.set(key, bus._id);
      summary.createdBuses++;
    }
  }

  // 2. ECUをupsert（トポロジー・GWリストからconnectorsを構築、追加・変更のみ）
  const existingEcus = await ecuRepo.findAll(projectId);
  const ecuByKey = new Map(existingEcus.map((e) => [keyOf(e.name, e.variantNo), e]));

  for (const row of parsed.ecuRows) {
    const key = keyOf(row.name, row.variantNo);
    const existing = ecuByKey.get(key);

    const topologyForEcu = parsed.topology.filter(
      (t) => t.ecu.valid && keyOf(t.ecu.name, t.ecu.variantNo) === key,
    );
    const connectorIds = [...new Set(topologyForEcu.map((t) => t.connectorId))];

    const gwRow = parsed.gwRows.find((g) => g.ecu.valid && keyOf(g.ecu.name, g.ecu.variantNo) === key);
    const gwBusIds = gwRow
      ? gwRow.busRefs
          .filter((b) => b.valid)
          .map((b) => busIdByKey.get(keyOf(b.name, b.variantNo)))
          .filter((id): id is string => !!id)
      : [];

    if (existing) {
      const connectors: EcuConnector[] = [...existing.connectors];
      for (const connectorId of connectorIds) {
        const busIdsForConnector = topologyForEcu
          .filter((t) => t.connectorId === connectorId)
          .map((t) => busIdByKey.get(keyOf(t.bus.name, t.bus.variantNo)))
          .filter((id): id is string => !!id);

        let connector = connectors.find((c) => c.connectorId === connectorId);
        if (!connector) {
          connector = { connectorId, name: connectorId, busConnections: [], framePorts: [], signalPorts: [] };
          connectors.push(connector);
        }
        for (const busId of busIdsForConnector) {
          if (!connector.busConnections.some((bc) => bc.busId === busId)) {
            connector.busConnections.push({ busId, variantIds: [] });
          }
        }
      }

      await ecuRepo.update(
        existing._id,
        { shortName: row.shortName, department: row.department, remarks: row.remarks, connectors, gwBusIds },
        actorId,
      );
      summary.updatedEcus++;
    } else {
      const connectors: EcuConnector[] = connectorIds.map((connectorId) => ({
        connectorId,
        name: connectorId,
        busConnections: topologyForEcu
          .filter((t) => t.connectorId === connectorId)
          .map((t) => busIdByKey.get(keyOf(t.bus.name, t.bus.variantNo)))
          .filter((id): id is string => !!id)
          .map((busId) => ({ busId, variantIds: [] })),
        framePorts: [],
        signalPorts: [],
      }));

      const ecu: Ecu = {
        _id: newId('ecus'),
        projectId,
        name: row.name,
        variantNo: row.variantNo,
        shortName: row.shortName,
        department: row.department,
        remarks: row.remarks,
        gwBusIds,
        connectors,
        status: 'published',
        createdAt: now,
        createdBy: actorId,
        updatedAt: now,
        updatedBy: actorId,
        deleted: false,
      };
      await ecuRepo.create(ecu);
      summary.createdEcus++;
    }
  }

  return summary;
}

/** ECU削除時の参照チェック（参照がある場合は警告表示のうえ削除可能） */
export async function getEcuReferences(projectId: string, ecuId: string): Promise<string[]> {
  const refs: string[] = [];
  const variants = await variantRepo.findByProjectId(projectId);
  for (const v of variants) {
    if (v.ecuConnectors.some((ec) => ec.ecuId === ecuId)) {
      refs.push(`サブセット「${v.name}」`);
    }
  }
  const gwRoutes = await gwRouteRepo.findByProjectId(projectId);
  if (gwRoutes.some((r) => r.viaGwIds.includes(ecuId))) {
    refs.push('GW経路（経由GWとして使用）');
  }
  return refs;
}

/** バス削除時の参照チェック（参照がある場合は警告表示のうえ削除可能） */
export async function getBusReferences(projectId: string, busId: string): Promise<string[]> {
  const refs: string[] = [];
  const variants = await variantRepo.findByProjectId(projectId);
  for (const v of variants) {
    if (v.busVariantIds.includes(busId)) {
      refs.push(`サブセット「${v.name}」`);
    }
  }
  const ecus = await ecuRepo.findByProjectId(projectId);
  for (const e of ecus) {
    const used = e.connectors.some((c) => c.busConnections.some((bc) => bc.busId === busId));
    if (used) {
      refs.push(`ECU「${e.name}_${e.variantNo}」の接続`);
    }
  }
  const gwRoutes = await gwRouteRepo.findByProjectId(projectId);
  if (gwRoutes.some((r) => r.sourceBusId === busId || r.targetBusId === busId)) {
    refs.push('GW経路（送信元/受信先バス）');
  }
  return refs;
}

export async function deleteEcu(ecuId: string, actorId: string): Promise<void> {
  await ecuRepo.softDelete(ecuId, actorId);
}

export async function deleteBus(busId: string, actorId: string): Promise<void> {
  await busRepo.softDelete(busId, actorId);
}
