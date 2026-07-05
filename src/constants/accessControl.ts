// ロール別メニュー活性・非活性の初期値（システムデフォルト）
// 参照: docs/design/system-design-v0.6-part4-screen-design.md §ロール別メニュー活性・非活性
import type { Permission, Role } from '../types/schema';

export const SCREEN_NAMES: Record<string, string> = {
  P01: 'ホーム',
  P02: 'プロジェクト管理',
  P10: 'LAN構成管理',
  P11: 'サブセット管理',
  P20: '申請書管理',
  P30: 'Frame・Signal参照',
  P31: 'サブセット別参照',
  P40: 'ECU Port参照',
  P50: '公開バージョン一覧',
  P51: '変更履歴',
  P60: '出力',
  P70: 'アクセス権管理',
};

export const DEFAULT_PERMISSIONS: Record<string, Record<Role, Permission>> = {
  P01: { ECU設計者: 'full', ECU承認者: 'full', LAN設計者: 'full', LAN承認者: 'full' },
  P02: { ECU設計者: 'readonly', ECU承認者: 'readonly', LAN設計者: 'full', LAN承認者: 'readonly' },
  P10: { ECU設計者: 'readonly', ECU承認者: 'readonly', LAN設計者: 'full', LAN承認者: 'readonly' },
  P11: { ECU設計者: 'readonly', ECU承認者: 'readonly', LAN設計者: 'full', LAN承認者: 'readonly' },
  P20: { ECU設計者: 'full', ECU承認者: 'full', LAN設計者: 'full', LAN承認者: 'full' },
  P30: { ECU設計者: 'full', ECU承認者: 'full', LAN設計者: 'full', LAN承認者: 'full' },
  P31: { ECU設計者: 'full', ECU承認者: 'full', LAN設計者: 'full', LAN承認者: 'full' },
  P40: { ECU設計者: 'full', ECU承認者: 'readonly', LAN設計者: 'full', LAN承認者: 'readonly' },
  P50: { ECU設計者: 'readonly', ECU承認者: 'readonly', LAN設計者: 'full', LAN承認者: 'readonly' },
  P51: { ECU設計者: 'full', ECU承認者: 'full', LAN設計者: 'full', LAN承認者: 'full' },
  P60: { ECU設計者: 'full', ECU承認者: 'full', LAN設計者: 'full', LAN承認者: 'full' },
  P70: { ECU設計者: 'none', ECU承認者: 'none', LAN設計者: 'full', LAN承認者: 'none' },
};
