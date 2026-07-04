import { EcuRepository } from '../repositories/EcuRepository';
import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import type { Direction } from '../types/schema';

const ecuRepo = new EcuRepository();
const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();

export interface PortColumn {
  key: string;
  ecuId: string;
  ecuLabel: string;
  connectorId: string;
}

export interface PortCellDetail {
  direction: Direction;
  e2eEnabled: boolean;
  secocEnabled: boolean;
  timeoutMs: number | null;
}

export interface PortRow {
  id: string;
  name: string;
  cells: Record<string, PortCellDetail>;
}

export interface FramePortGroup {
  frame: PortRow;
  signals: PortRow[];
}

export interface EcuPortMatrix {
  columns: PortColumn[];
  groups: FramePortGroup[];
}

/**
 * 選択されたECU（バリ単位）のFramePort/SignalPortを、Frame行の配下にSignal行を並べた
 * 1つのマトリクスとして構築する（P40 ECU Port参照画面用）。
 */
export async function buildEcuPortMatrix(projectId: string, ecuIds: string[]): Promise<EcuPortMatrix> {
  const allEcus = await ecuRepo.findByProjectId(projectId);
  const ecus = ecuIds.map((id) => allEcus.find((e) => e._id === id)).filter((e): e is NonNullable<typeof e> => !!e);

  const columns: PortColumn[] = [];
  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      columns.push({
        key: `${ecu._id}:${connector.connectorId}`,
        ecuId: ecu._id,
        ecuLabel: `${ecu.name}_${ecu.variantNo}`,
        connectorId: connector.connectorId,
      });
    }
  }

  const frameCells = new Map<string, Record<string, PortCellDetail>>();
  const signalCells = new Map<string, Record<string, PortCellDetail>>();

  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      const key = `${ecu._id}:${connector.connectorId}`;
      for (const fp of connector.framePorts) {
        const cells = frameCells.get(fp.frameId) ?? {};
        cells[key] = {
          direction: fp.direction,
          e2eEnabled: fp.e2eEnabled,
          secocEnabled: fp.secocEnabled,
          timeoutMs: fp.timeoutMs,
        };
        frameCells.set(fp.frameId, cells);
      }
      for (const sp of connector.signalPorts) {
        const cells = signalCells.get(sp.signalId) ?? {};
        cells[key] = {
          direction: sp.direction,
          e2eEnabled: sp.e2eEnabled,
          secocEnabled: sp.secocEnabled,
          timeoutMs: null,
        };
        signalCells.set(sp.signalId, cells);
      }
    }
  }

  const signals = (
    await Promise.all([...signalCells.keys()].map((id) => signalRepo.findById(id)))
  ).filter((s): s is NonNullable<typeof s> => !!s && !s.deleted);

  const frameIds = new Set(frameCells.keys());
  for (const s of signals) frameIds.add(s.frameId);

  const groups: FramePortGroup[] = [];
  for (const frameId of frameIds) {
    const frame = await frameRepo.findById(frameId);
    if (!frame || frame.deleted) continue;

    const childSignals = signals
      .filter((s) => s.frameId === frameId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ id: s._id, name: s.name, cells: signalCells.get(s._id) ?? {} }));

    groups.push({
      frame: { id: frame._id, name: frame.name, cells: frameCells.get(frameId) ?? {} },
      signals: childSignals,
    });
  }
  groups.sort((a, b) => a.frame.name.localeCompare(b.frame.name));

  return { columns, groups };
}
