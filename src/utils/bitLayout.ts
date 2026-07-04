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
