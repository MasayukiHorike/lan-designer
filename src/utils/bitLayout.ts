// E2E・SecOC ビット配置ルール（CLAUDE.md参照）
export const E2E_RESERVED_BITS = 24;
export const E2E_START_BIT = 0;

export const SECOC_RESERVED_BITS = {
  truncatedFV: 32,
  fullFV: 88,
} as const;

export function getSecocStartBit(dlc: number, fvMethod: 'truncatedFV' | 'fullFV'): number {
  return dlc * 8 - SECOC_RESERVED_BITS[fvMethod];
}

export function getAvailableBits(
  dlc: number,
  e2eEnabled: boolean,
  secocEnabled: boolean,
  fvMethod?: 'truncatedFV' | 'fullFV',
): number {
  let bits = dlc * 8;
  if (e2eEnabled) bits -= E2E_RESERVED_BITS;
  if (secocEnabled && fvMethod) bits -= SECOC_RESERVED_BITS[fvMethod];
  return bits;
}

interface BitPlacementFrame {
  dlc: number;
  e2e: { enabled: boolean; reservedStartBit: number; reservedBits: number };
  secoc: { enabled: boolean; reservedStartBit: number };
}

/**
 * フレーム範囲・E2E/SecOC予約領域との重複判定（例外を投げずbooleanを返す版）。
 * ReviewEditService.validateSignalBitRangeと同じ条件だが、P35のドラッグ中プレビュー用に
 * 判定結果だけを要求される場面向けに用意する（Signal同士の重複はここでは判定しない＝許可）。
 */
export function isBitPlacementValid(frame: BitPlacementFrame, bitPosition: number, bitLength: number): boolean {
  const totalBits = frame.dlc * 8;
  if (bitPosition < 0 || bitLength <= 0 || bitPosition + bitLength > totalBits) return false;
  if (
    frame.e2e.enabled &&
    bitPosition < frame.e2e.reservedStartBit + frame.e2e.reservedBits &&
    bitPosition + bitLength > frame.e2e.reservedStartBit
  ) {
    return false;
  }
  if (frame.secoc.enabled && bitPosition + bitLength > frame.secoc.reservedStartBit) return false;
  return true;
}
