import { EcuRepository } from '../repositories/EcuRepository';
import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import type { Ecu, Frame } from '../types/schema';

const ecuRepo = new EcuRepository();
const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();

export interface TreeSignalNode {
  id: string;
  name: string;
  deleted: boolean;
}

export interface TreeFrameNode {
  id: string;
  name: string;
  deleted: boolean;
  signals: TreeSignalNode[];
}

export interface TreeEcuNode {
  ecuId: string;
  label: string;
  frames: TreeFrameNode[];
}

export interface SnapshotFilter {
  frameIds: Set<string>;
  signalIds: Set<string>;
}

/**
 * ECU（バリを束ねた単位）→Frame→Signal のツリー構造を構築する（P30左ペイン用）。
 * ・ECUはバリナンバー単位ではなく名前単位で束ねる（バリ単位の送受信はP40 ECU Port参照で扱う）
 * ・Frameは送信元（P-Port）のECUの配下にのみ表示する。受信のみのECUは配下にFrame/Signalを持たない
 * ・snapshotFilterを渡すと、その断面に含まれるFrame/Signalのみに絞り込む（過去断面表示用）
 */
export async function buildFrameSignalTree(
  projectId: string,
  includeDeleted: boolean,
  snapshotFilter?: SnapshotFilter,
): Promise<TreeEcuNode[]> {
  const ecus = await ecuRepo.findByProjectId(projectId);
  const frameCache = new Map<string, Frame | undefined>();
  const signalCache = new Map<string, TreeSignalNode[]>();

  const ecusByName = new Map<string, Ecu[]>();
  for (const ecu of ecus) {
    const list = ecusByName.get(ecu.name) ?? [];
    list.push(ecu);
    ecusByName.set(ecu.name, list);
  }

  const nodes: TreeEcuNode[] = [];

  for (const [name, variants] of ecusByName) {
    const txFrameIds = new Set<string>();
    for (const ecu of variants) {
      for (const connector of ecu.connectors) {
        for (const fp of connector.framePorts) {
          if (fp.direction === 'P-Port') txFrameIds.add(fp.frameId);
        }
      }
    }
    if (txFrameIds.size === 0) continue; // 受信のみのECUはツリーに含めない

    const frameNodes: TreeFrameNode[] = [];
    for (const frameId of txFrameIds) {
      if (snapshotFilter && !snapshotFilter.frameIds.has(frameId)) continue;
      if (!frameCache.has(frameId)) {
        frameCache.set(frameId, await frameRepo.findById(frameId));
      }
      const frame = frameCache.get(frameId);
      if (!frame) continue;
      // 過去断面表示（snapshotFilter指定時）は当時の状態を見せる必要があるため
      // 現在版フィルタを適用しない（deletedと違いnextVersionIdは事後に非nullへ変わりうる）
      if (!snapshotFilter && frame.nextVersionId !== null) continue;
      if (frame.deleted && !includeDeleted) continue;

      if (!signalCache.has(frameId)) {
        const signals = includeDeleted
          ? await signalRepo.findByFrameIdIncludingDeleted(frameId)
          : await signalRepo.findByFrameId(frameId);
        signalCache.set(
          frameId,
          signals
            .filter((s) => includeDeleted || !s.deleted)
            .filter((s) => !!snapshotFilter || s.nextVersionId === null)
            .filter((s) => !snapshotFilter || snapshotFilter.signalIds.has(s._id))
            .map((s) => ({ id: s._id, name: s.name, deleted: s.deleted })),
        );
      }

      frameNodes.push({
        id: frame._id,
        name: frame.name,
        deleted: frame.deleted,
        signals: signalCache.get(frameId)!,
      });
    }
    frameNodes.sort((a, b) => a.name.localeCompare(b.name));
    if (frameNodes.length === 0) continue;

    nodes.push({ ecuId: name, label: name, frames: frameNodes });
  }

  nodes.sort((a, b) => a.label.localeCompare(b.label));
  return nodes;
}

/** 指定フレームの送受信ECU（参考表示） */
export async function getFrameTxRxEcus(
  projectId: string,
  frameId: string,
): Promise<{ label: string; direction: 'T' | 'R' }[]> {
  const ecus = await ecuRepo.findByProjectId(projectId);
  const result: { label: string; direction: 'T' | 'R' }[] = [];
  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      const fp = connector.framePorts.find((p) => p.frameId === frameId);
      if (fp) result.push({ label: `${ecu.name}_${ecu.variantNo}`, direction: fp.direction === 'P-Port' ? 'T' : 'R' });
    }
  }
  return result;
}

/** 指定シグナルのT/Rポート一覧（ECU/コネクター単位） */
export async function getSignalPorts(
  projectId: string,
  signalId: string,
): Promise<{ label: string; direction: 'T' | 'R' }[]> {
  const ecus = await ecuRepo.findByProjectId(projectId);
  const result: { label: string; direction: 'T' | 'R' }[] = [];
  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      const sp = connector.signalPorts.find((p) => p.signalId === signalId);
      if (sp) {
        result.push({
          label: `${ecu.name}_${ecu.variantNo}/${connector.connectorId}`,
          direction: sp.direction === 'P-Port' ? 'T' : 'R',
        });
      }
    }
  }
  return result;
}
