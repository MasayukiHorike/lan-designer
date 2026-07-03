import { VariantRepository } from '../repositories/VariantRepository';
import { SubsetHistoryRepository } from '../repositories/SubsetHistoryRepository';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import type { Bus, Ecu, Variant, VariantEcuConnector } from '../types/schema';

const variantRepo = new VariantRepository();
const subsetHistoryRepo = new SubsetHistoryRepository();

export interface EcuConnectorRow {
  ecuId: string;
  connectorId: string;
  label: string;
  /** このコネクターが接続しうるバスID一覧（トポロジー由来） */
  candidateBusIds: string[];
}

export interface BusRow {
  busId: string;
  label: string;
}

export function buildEcuConnectorRows(ecus: Ecu[]): EcuConnectorRow[] {
  const rows: EcuConnectorRow[] = [];
  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      if (connector.busConnections.length === 0) continue;
      rows.push({
        ecuId: ecu._id,
        connectorId: connector.connectorId,
        label: `${ecu.name}_${ecu.variantNo}/${connector.connectorId}`,
        candidateBusIds: connector.busConnections.map((bc) => bc.busId),
      });
    }
  }
  return rows;
}

export function buildBusRows(buses: Bus[]): BusRow[] {
  return buses.map((b) => ({ busId: b._id, label: `${b.name}_${b.variantNo}` }));
}

/** variant.ecuConnectorsから「ecuId:connectorId」チェック済み集合を取得する */
export function ecuConnKey(ecuId: string, connectorId: string): string {
  return `${ecuId}:${connectorId}`;
}

export function getCheckedEcuConnectors(variant: Variant): Set<string> {
  const set = new Set<string>();
  for (const ec of variant.ecuConnectors) {
    for (const c of ec.connectors) {
      set.add(ecuConnKey(ec.ecuId, c.connectorId));
    }
  }
  return set;
}

export function getCheckedBuses(variant: Variant): Set<string> {
  return new Set(variant.busVariantIds);
}

/**
 * チェック状態からVariant.ecuConnectors/busVariantIdsを再構築する。
 * 1コネクターが複数バスに接続可能な場合、そのサブセットで選択済みのバスバリを優先して解決する。
 */
export function buildVariantAssignment(
  ecuConnRows: EcuConnectorRow[],
  checkedEcuConn: Set<string>,
  checkedBuses: Set<string>,
): { ecuConnectors: VariantEcuConnector[]; busVariantIds: string[] } {
  const byEcu = new Map<string, { connectorId: string; busId: string }[]>();

  for (const row of ecuConnRows) {
    const key = ecuConnKey(row.ecuId, row.connectorId);
    if (!checkedEcuConn.has(key)) continue;

    const candidatesInSubset = row.candidateBusIds.filter((busId) => checkedBuses.has(busId));
    const busId = candidatesInSubset[0] ?? row.candidateBusIds[0];
    if (!busId) continue;

    const list = byEcu.get(row.ecuId) ?? [];
    list.push({ connectorId: row.connectorId, busId });
    byEcu.set(row.ecuId, list);
  }

  const ecuConnectors: VariantEcuConnector[] = [...byEcu.entries()].map(([ecuId, connectors]) => ({
    ecuId,
    connectors,
  }));

  return { ecuConnectors, busVariantIds: [...checkedBuses] };
}

export async function createSubset(
  projectId: string,
  generation: string,
  powerTrain: string,
  actorId: string,
): Promise<Variant> {
  const now = nowIso();
  const variant: Variant = {
    _id: newId('variants'),
    projectId,
    generation,
    powerTrain,
    name: `${generation}_${powerTrain}`,
    ecuConnectors: [],
    busVariantIds: [],
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  };
  await variantRepo.create(variant);
  await subsetHistoryRepo.create({
    _id: newId('subsetHistories'),
    projectId,
    variantId: variant._id,
    changedAt: now,
    changedBy: actorId,
    before: {},
    after: variant as unknown as Record<string, unknown>,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  });
  return variant;
}

export async function saveSubsetAssignment(
  variant: Variant,
  ecuConnectors: VariantEcuConnector[],
  busVariantIds: string[],
  actorId: string,
): Promise<void> {
  const before = { ecuConnectors: variant.ecuConnectors, busVariantIds: variant.busVariantIds };
  const after = { ecuConnectors, busVariantIds };
  await variantRepo.update(variant._id, { ecuConnectors, busVariantIds }, actorId);
  const now = nowIso();
  await subsetHistoryRepo.create({
    _id: newId('subsetHistories'),
    projectId: variant.projectId,
    variantId: variant._id,
    changedAt: now,
    changedBy: actorId,
    before,
    after,
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  });
}

/** サブセット削除時の参照件数（現在の割り当て件数を警告として表示する） */
export function getSubsetAssignmentSummary(variant: Variant): string[] {
  const refs: string[] = [];
  const connectorCount = variant.ecuConnectors.reduce((sum, ec) => sum + ec.connectors.length, 0);
  if (connectorCount > 0) {
    refs.push(`ECU/コネクター割り当て ${connectorCount}件`);
  }
  if (variant.busVariantIds.length > 0) {
    refs.push(`バスバリ割り当て ${variant.busVariantIds.length}件`);
  }
  return refs;
}

export async function deleteSubset(variant: Variant, actorId: string): Promise<void> {
  const now = nowIso();
  await variantRepo.softDelete(variant._id, actorId);
  await subsetHistoryRepo.create({
    _id: newId('subsetHistories'),
    projectId: variant.projectId,
    variantId: variant._id,
    changedAt: now,
    changedBy: actorId,
    before: variant as unknown as Record<string, unknown>,
    after: { deleted: true },
    createdAt: now,
    createdBy: actorId,
    updatedAt: now,
    updatedBy: actorId,
    deleted: false,
  });
}
