// サイドメニュー構成
// 参照: docs/design/system-design-v0.6-part4-screen-design.md §サイドメニュー構成
export interface MenuItem {
  screenId: string;
  label: string;
  path: string;
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: 'ダッシュボード',
    items: [{ screenId: 'P01', label: 'ホーム', path: '/' }],
  },
  {
    title: 'マスタ管理',
    items: [
      { screenId: 'P10', label: 'LAN構成管理', path: '/lan-config' },
      { screenId: 'P11', label: 'サブセット管理', path: '/subsets' },
    ],
  },
  {
    title: '申請・承認',
    items: [{ screenId: 'P20', label: '申請書管理', path: '/applications' }],
  },
  {
    title: 'データ参照',
    items: [
      { screenId: 'P30', label: 'Frame・Signal参照', path: '/frame-signal' },
      { screenId: 'P31', label: 'サブセット別参照', path: '/frame-signal/subset' },
      { screenId: 'P40', label: 'ECU Port参照', path: '/ecu-port' },
    ],
  },
  {
    title: '断面管理',
    items: [
      { screenId: 'P50', label: '公開バージョン一覧', path: '/snapshots' },
      { screenId: 'P51', label: '変更履歴', path: '/changelogs' },
    ],
  },
  {
    title: '出力',
    items: [{ screenId: 'P60', label: '出力', path: '/export' }],
  },
  {
    title: 'システム管理',
    items: [{ screenId: 'P70', label: 'アクセス権管理', path: '/access-control' }],
  },
];
