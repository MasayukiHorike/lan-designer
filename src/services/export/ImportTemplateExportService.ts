import * as XLSX from 'xlsx';
import { EcuRepository } from '../../repositories/EcuRepository';
import { FrameRepository } from '../../repositories/FrameRepository';
import { SignalRepository } from '../../repositories/SignalRepository';
import { VariantRepository } from '../../repositories/VariantRepository';
import type { Ecu, Frame, Signal } from '../../types/schema';

const ecuRepo = new EcuRepository();
const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();
const variantRepo = new VariantRepository();

const FIXED_HEADER = [
  '行種別', '要素コマンド', '要素ステータス', 'ポートコマンド', 'ポートステータス',
  'フレーム名', 'フレームバリ番号', 'フレーム説明', 'プロトコル', 'CAN-ID', 'DLC',
  'サイクルタイム', '送信電源', 'イベントフラグ', 'バージョンNo',
  'E2E有効/無効', 'E2Eプロファイル', 'E2E DataId',
  'SecOC有効/無効', 'SecOC FV方式', 'SecOC用ID',
  'シグナル名', 'シグナルバリ番号', 'シグナル説明', 'ビット位置', 'ビット長',
  'エンディアン', 'イベント条件', '単位', '分解能', '初期値', 'フェール値', 'バージョンNo',
];

interface DGroup {
  ecu: Ecu;
  connectorId: string;
}

function buildFrameRow(frame: Frame, dGroups: DGroup[]): (string | number)[] {
  const base: (string | number)[] = [
    'F', '', '', '', '',
    frame.name, frame.variantNo, frame.description, frame.protocol, frame.canId, frame.dlc,
    frame.cycleTime, frame.powerSource.join(','), frame.eventFlag ? 'ON' : 'OFF', frame.versionNo,
    frame.e2e.enabled ? 'ON' : 'OFF', frame.e2e.profile, frame.e2e.dataId,
    frame.secoc.enabled ? 'ON' : 'OFF', frame.secoc.fvMethod === 'fullFV' ? 'フルFV' : 'トランケートFV', frame.secoc.secocId,
    '', '', '', '', '',
    '', '', '', '', '', '', '',
  ];
  const dCells = dGroups.flatMap(({ ecu, connectorId }) => {
    const connector = ecu.connectors.find((c) => c.connectorId === connectorId);
    const fp = connector?.framePorts.find((p) => p.frameId === frame._id);
    if (!fp) return ['', '', '', ''];
    return [fp.direction === 'P-Port' ? 'T' : 'R', fp.e2eEnabled ? 'T' : '', fp.secocEnabled ? 'T' : '', fp.timeoutMs ?? ''];
  });
  return [...base, ...dCells];
}

function buildSignalRow(signal: Signal, dGroups: DGroup[]): (string | number)[] {
  const base: (string | number)[] = [
    'S', '', '', '', '',
    '', '', '', '', '', '',
    '', '', '', '',
    '', '', '',
    '', '', '',
    signal.name, signal.variantNo, signal.description, signal.bitPosition, signal.bitLength,
    signal.endian, signal.eventCondition, signal.unit, signal.resolution, signal.initialValue, signal.failValue, signal.versionNo,
  ];
  const dCells = dGroups.flatMap(({ ecu, connectorId }) => {
    const connector = ecu.connectors.find((c) => c.connectorId === connectorId);
    const sp = connector?.signalPorts.find((p) => p.signalId === signal._id);
    if (!sp) return ['', '', '', ''];
    return [sp.direction === 'P-Port' ? 'T' : 'R', sp.e2eEnabled ? 'T' : '', sp.secocEnabled ? 'T' : '', ''];
  });
  return [...base, ...dCells];
}

/**
 * インポート雛形Excelを出力する（Part3 §13 出力⑤・通信データExcelフォーマット準拠）。
 * ECU選択は必須。フレームを選択した場合はその既存データ（コマンド欄は空欄）をひな型として書き出す。
 * サブセットを選択した場合は、そのサブセットで有効なコネクターのみDエリアに含める。
 */
export async function exportImportTemplate(
  projectId: string,
  ecuIds: string[],
  frameId?: string,
  variantIds?: string[],
): Promise<void> {
  const allEcus = await ecuRepo.findByProjectId(projectId);
  const ecus = ecuIds.map((id) => allEcus.find((e) => e._id === id)).filter((e): e is Ecu => !!e);

  let allowedConnectorKeys: Set<string> | null = null;
  if (variantIds && variantIds.length > 0) {
    const variants = await variantRepo.findByProjectId(projectId);
    allowedConnectorKeys = new Set();
    for (const vId of variantIds) {
      const variant = variants.find((v) => v._id === vId);
      if (!variant) continue;
      for (const ec of variant.ecuConnectors) {
        for (const c of ec.connectors) allowedConnectorKeys.add(`${ec.ecuId}:${c.connectorId}`);
      }
    }
  }

  const dGroups: DGroup[] = [];
  for (const ecu of ecus) {
    for (const connector of ecu.connectors) {
      const key = `${ecu._id}:${connector.connectorId}`;
      if (allowedConnectorKeys && !allowedConnectorKeys.has(key)) continue;
      dGroups.push({ ecu, connectorId: connector.connectorId });
    }
  }

  const headerRow1 = [
    ...Array(FIXED_HEADER.length).fill(''),
    ...dGroups.flatMap(({ ecu, connectorId }) => [`${ecu.name}_${ecu.variantNo}_${connectorId}`, '', '', '']),
  ];
  const headerRow2 = [...FIXED_HEADER, ...dGroups.flatMap(() => ['T/R', 'E2E利用', 'SecOC利用', '途絶時間'])];

  const rows: (string | number)[][] = [headerRow1, headerRow2];

  if (frameId) {
    const frame = await frameRepo.findById(frameId);
    if (frame) {
      rows.push(buildFrameRow(frame, dGroups));
      const signals = await signalRepo.findByFrameId(frame._id);
      for (const s of signals) rows.push(buildSignalRow(s, dGroups));
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '通信データ');
  XLSX.writeFile(wb, `インポート雛形_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
