import { VariantRepository } from '../../repositories/VariantRepository';
import { EcuRepository } from '../../repositories/EcuRepository';
import { BusRepository } from '../../repositories/BusRepository';
import { FrameRepository } from '../../repositories/FrameRepository';
import { SignalRepository } from '../../repositories/SignalRepository';
import { GwRouteRepository } from '../../repositories/GwRouteRepository';
import { buildResult, type CheckIssue, type CheckResult } from '../../types/check';
import { E2E_RESERVED_BITS, SECOC_RESERVED_BITS, getSecocStartBit } from '../../utils/bitLayout';
import type { Ecu, Frame, Variant } from '../../types/schema';

const variantRepo = new VariantRepository();
const ecuRepo = new EcuRepository();
const busRepo = new BusRepository();
const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();
const gwRouteRepo = new GwRouteRepository();

interface FrameTxRxInfo {
  txBuses: Set<string>;
  rxBuses: Set<string>;
}

function collectActiveIds(variant: Variant, ecus: Ecu[]) {
  const activeEcuIds = new Set(variant.ecuConnectors.map((ec) => ec.ecuId));
  const activeBusIds = new Set(variant.busVariantIds);

  const frameIds = new Set<string>();
  const signalIds = new Set<string>();
  const frameTxRx = new Map<string, FrameTxRxInfo>();

  for (const ecu of ecus) {
    if (!activeEcuIds.has(ecu._id)) continue;
    for (const connector of ecu.connectors) {
      // コネクターが複数バス候補を持つ場合は先頭を採用する簡易解決（SubsetService/GwRouteServiceと同様）
      const busId = connector.busConnections[0]?.busId;
      for (const fp of connector.framePorts) {
        frameIds.add(fp.frameId);
        const info = frameTxRx.get(fp.frameId) ?? { txBuses: new Set(), rxBuses: new Set() };
        if (busId) {
          (fp.direction === 'P-Port' ? info.txBuses : info.rxBuses).add(busId);
        }
        frameTxRx.set(fp.frameId, info);
      }
      for (const sp of connector.signalPorts) {
        signalIds.add(sp.signalId);
      }
    }
  }

  return { activeEcuIds, activeBusIds, frameIds, signalIds, frameTxRx };
}

async function checkSubset(projectId: string, variant: Variant, ecus: Ecu[]): Promise<CheckResult> {
  const { activeEcuIds, activeBusIds, frameIds, signalIds, frameTxRx } = collectActiveIds(variant, ecus);

  const [allFrames, allSignals, allGwRoutes, allBuses] = await Promise.all([
    frameRepo.findByProjectId(projectId),
    signalRepo.findByProjectId(projectId),
    gwRouteRepo.findByProjectId(projectId),
    busRepo.findByProjectId(projectId),
  ]);

  const frames = allFrames.filter((f) => frameIds.has(f._id));
  const signals = allSignals.filter((s) => signalIds.has(s._id));
  const gwRoutes = allGwRoutes.filter((r) => activeBusIds.has(r.sourceBusId) && activeBusIds.has(r.targetBusId));

  const errors: CheckIssue[] = [];
  const warnings: CheckIssue[] = [];

  // ① CAN ID重複
  const canIdGroups = new Map<string, Frame[]>();
  for (const f of frames) {
    const list = canIdGroups.get(f.canId) ?? [];
    list.push(f);
    canIdGroups.set(f.canId, list);
  }
  for (const [canId, list] of canIdGroups) {
    if (list.length > 1) {
      errors.push({
        code: 'L2_CANID_DUPLICATE',
        field: 'canId',
        message: `CAN IDが重複しています: ${canId}（${list.map((f) => f.name).join(', ')}）`,
      });
    }
  }

  for (const frame of frames) {
    const frameSignals = signals.filter((s) => s.frameId === frame._id);

    // ② ビット位置重複
    for (let i = 0; i < frameSignals.length; i++) {
      for (let j = i + 1; j < frameSignals.length; j++) {
        const a = frameSignals[i];
        const b = frameSignals[j];
        if (a.bitPosition < b.bitPosition + b.bitLength && b.bitPosition < a.bitPosition + a.bitLength) {
          errors.push({
            code: 'L2_BIT_OVERLAP',
            field: 'bitPosition',
            message: `ビット位置が重複しています: ${frame.name} の ${a.name} と ${b.name}`,
          });
        }
      }
    }

    // ⑥⑦ E2E/SecOC予約領域とSignalのビット重複
    if (frame.e2e.enabled) {
      for (const s of frameSignals) {
        if (s.bitPosition < E2E_RESERVED_BITS) {
          errors.push({
            code: 'L2_E2E_SIGNAL_OVERLAP',
            field: 'e2e',
            message: `E2E予約領域とSignalのビットが重複しています: ${frame.name} / ${s.name}`,
          });
        }
      }
    }
    if (frame.secoc.enabled) {
      const secocStart = getSecocStartBit(frame.dlc, frame.secoc.fvMethod);
      for (const s of frameSignals) {
        if (s.bitPosition + s.bitLength > secocStart) {
          errors.push({
            code: 'L2_SECOC_SIGNAL_OVERLAP',
            field: 'secoc',
            message: `SecOC予約領域とSignalのビットが重複しています: ${frame.name} / ${s.name}`,
          });
        }
      }
      // ⑧ E2EとSecOC予約領域同士の重複
      if (frame.e2e.enabled && E2E_RESERVED_BITS > secocStart) {
        errors.push({ code: 'L2_E2E_SECOC_OVERLAP', field: 'secoc', message: `E2EとSecOC予約領域が重複しています: ${frame.name}` });
      }
    }

    // ⑨ DLC内にE2E＋SecOC＋全Signalが収まるか
    const reservedBits =
      (frame.e2e.enabled ? E2E_RESERVED_BITS : 0) + (frame.secoc.enabled ? SECOC_RESERVED_BITS[frame.secoc.fvMethod] : 0);
    const signalBitsMax = frameSignals.reduce((max, s) => Math.max(max, s.bitPosition + s.bitLength), 0);
    if (reservedBits > frame.dlc * 8 || signalBitsMax > frame.dlc * 8) {
      errors.push({
        code: 'L2_DLC_CAPACITY_EXCEEDED',
        field: 'dlc',
        message: `DLC内にE2E＋SecOC＋全Signalが収まりません: ${frame.name}（DLC=${frame.dlc}）`,
      });
    }

    // ③ 孤立Tx/Rx
    const txrx = frameTxRx.get(frame._id);
    const hasTx = !!txrx && txrx.txBuses.size > 0;
    const hasRx = !!txrx && txrx.rxBuses.size > 0;
    if (hasRx && !hasTx) {
      errors.push({ code: 'L2_ORPHAN_RX', field: 'trPorts', message: `送信元が存在しない孤立Rxです: ${frame.name}` });
    }
    if (hasTx && !hasRx) {
      warnings.push({ code: 'L2_ORPHAN_TX', field: 'trPorts', message: `受信先が存在しない孤立Txです（送信のみで受信ECUがありません）: ${frame.name}` });
    }

    // ④ 物理構成との不整合（このサブセットの有効ECU/バスバリと整合するか）
    const activeEcuVariantNos = ecus.filter((e) => activeEcuIds.has(e._id)).map((e) => e.variantNo);
    const activeBusVariantNos = allBuses.filter((b) => activeBusIds.has(b._id)).map((b) => b.variantNo);
    if (!activeEcuVariantNos.includes(frame.variantNo) && !activeBusVariantNos.includes(frame.variantNo)) {
      errors.push({
        code: 'L2_PHYSICAL_MISMATCH',
        field: 'variantNo',
        message: `フレームバリ番号がこのサブセットの物理構成（有効ECU/バスバリ）と整合していません: ${frame.name}`,
      });
    }

    // ⑤ GW経路妥当性（Tx側バスとRx側バスが異なる場合、経路が存在するか）
    if (txrx) {
      for (const sourceBusId of txrx.txBuses) {
        for (const targetBusId of txrx.rxBuses) {
          if (sourceBusId === targetBusId) continue;
          const hasRoute = gwRoutes.some(
            (r) => r.frameId === frame._id && r.sourceBusId === sourceBusId && r.targetBusId === targetBusId,
          );
          if (!hasRoute) {
            errors.push({
              code: 'L2_GW_ROUTE_MISSING',
              field: 'trPorts',
              message: `GW経路が存在しません: ${frame.name}（送信元バス→受信先バス間）`,
            });
          }
        }
      }
    }
  }

  return buildResult(errors, warnings);
}

/**
 * サブセット（世代×パワトレ）単位のLevel2チェックを全サブセットについて実行する。
 * 実行条件（Part3 §7 Step3）：物理構成取込済・サブセット定義登録済。
 * サブセットが1件も無い場合は空を返す（実行条件を満たしていないため）。
 */
export async function runLevel2Checks(projectId: string): Promise<Record<string, CheckResult>> {
  const variants = await variantRepo.findByProjectId(projectId);
  if (variants.length === 0) return {};

  const ecus = await ecuRepo.findByProjectId(projectId);
  const results: Record<string, CheckResult> = {};
  for (const variant of variants) {
    results[variant.name] = await checkSubset(projectId, variant, ecus);
  }
  return results;
}
