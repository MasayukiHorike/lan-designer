import { EcuRepository } from '../repositories/EcuRepository';
import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import type { TrValue } from '../types/excel';
import type { Variant } from '../types/schema';

const ecuRepo = new EcuRepository();
const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();

export interface MatrixColumn {
  key: string;
  ecuId: string;
  ecuLabel: string;
  connectorId: string;
}

export interface MatrixRow {
  id: string;
  name: string;
  deleted: boolean;
  cells: Record<string, TrValue>;
}

export interface FrameMatrixGroup {
  frame: MatrixRow;
  signals: MatrixRow[];
}

export interface SubsetMatrix {
  columns: MatrixColumn[];
  groups: FrameMatrixGroup[];
}

/**
 * サブセット（世代×パワトレ）で有効化されたECU/コネクターを列、Frame/Signalを行とした
 * T/Rマトリクスを構築する（P31 サブセット別参照画面用）。
 * フィルタリングロジックはPart3 §6「サブセットフィルタリング解決ロジック」に準拠：
 * variants.ecuConnectorsから有効ECU・有効コネクターを取得し、その配下のframePorts/signalPortsのみ抽出する。
 */
export async function buildSubsetMatrix(projectId: string, variant: Variant): Promise<SubsetMatrix> {
  const ecus = await ecuRepo.findByProjectId(projectId);
  const ecuById = new Map(ecus.map((e) => [e._id, e]));

  const columns: MatrixColumn[] = [];
  for (const ec of variant.ecuConnectors) {
    const ecu = ecuById.get(ec.ecuId);
    if (!ecu) continue;
    for (const c of ec.connectors) {
      columns.push({
        key: `${ec.ecuId}:${c.connectorId}`,
        ecuId: ec.ecuId,
        ecuLabel: `${ecu.name}_${ecu.variantNo}`,
        connectorId: c.connectorId,
      });
    }
  }

  const frameCells = new Map<string, Record<string, TrValue>>();
  const signalCells = new Map<string, Record<string, TrValue>>();

  for (const column of columns) {
    const ecu = ecuById.get(column.ecuId);
    const connector = ecu?.connectors.find((c) => c.connectorId === column.connectorId);
    if (!connector) continue;

    for (const fp of connector.framePorts) {
      const cells = frameCells.get(fp.frameId) ?? {};
      cells[column.key] = fp.direction === 'P-Port' ? 'T' : 'R';
      frameCells.set(fp.frameId, cells);
    }
    for (const sp of connector.signalPorts) {
      const cells = signalCells.get(sp.signalId) ?? {};
      cells[column.key] = sp.direction === 'P-Port' ? 'T' : 'R';
      signalCells.set(sp.signalId, cells);
    }
  }

  const groups: FrameMatrixGroup[] = [];
  for (const frameId of frameCells.keys()) {
    const frame = await frameRepo.findById(frameId);
    if (!frame || frame.deleted) continue;

    const signals = await signalRepo.findByFrameId(frame._id);
    const signalRows: MatrixRow[] = signals.map((s) => ({
      id: s._id,
      name: s.name,
      deleted: s.deleted,
      cells: signalCells.get(s._id) ?? {},
    }));
    signalRows.sort((a, b) => a.name.localeCompare(b.name));

    groups.push({
      frame: { id: frame._id, name: frame.name, deleted: frame.deleted, cells: frameCells.get(frameId) ?? {} },
      signals: signalRows,
    });
  }
  groups.sort((a, b) => a.frame.name.localeCompare(b.frame.name));

  return { columns, groups };
}
