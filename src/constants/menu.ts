// サイドメニュー構成
// 参照: docs/design/system-design-v0.6-part4-screen-design.md §サイドメニュー構成
import {
  Home,
  FolderKanban,
  Network,
  Layers,
  FileText,
  Waypoints,
  Filter,
  Cpu,
  Rocket,
  History,
  Download,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export interface MenuItem {
  screenId: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: 'ダッシュボード',
    items: [{ screenId: 'P01', label: 'ホーム', path: '/', icon: Home }],
  },
  {
    title: 'マスタ管理',
    items: [
      { screenId: 'P10', label: 'LAN構成管理', path: '/lan-config', icon: Network },
      { screenId: 'P11', label: 'サブセット管理', path: '/subsets', icon: Layers },
    ],
  },
  {
    title: '申請・承認',
    items: [{ screenId: 'P20', label: '申請書管理', path: '/applications', icon: FileText }],
  },
  {
    title: 'データ参照',
    items: [
      { screenId: 'P30', label: 'Frame・Signal参照', path: '/frame-signal', icon: Waypoints },
      { screenId: 'P31', label: 'サブセット別参照', path: '/frame-signal/subset', icon: Filter },
      { screenId: 'P40', label: 'ECU Port参照', path: '/ecu-port', icon: Cpu },
    ],
  },
  {
    title: '断面管理',
    items: [
      { screenId: 'P50', label: '公開バージョン一覧', path: '/snapshots', icon: Rocket },
      { screenId: 'P51', label: '変更履歴', path: '/changelogs', icon: History },
    ],
  },
  {
    title: '出力',
    items: [{ screenId: 'P60', label: '出力', path: '/export', icon: Download }],
  },
  {
    title: 'システム管理',
    items: [
      { screenId: 'P02', label: 'プロジェクト管理', path: '/projects', icon: FolderKanban },
      { screenId: 'P70', label: 'アクセス権管理', path: '/access-control', icon: ShieldCheck },
    ],
  },
];
