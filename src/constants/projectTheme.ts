// プロジェクトのテーマカラー固定パレット
export interface ProjectThemeColor {
  key: string;
  label: string;
  hex: string;
}

export const PROJECT_THEME_COLORS: ProjectThemeColor[] = [
  { key: 'blue', label: 'ブルー', hex: '#1e40af' },
  { key: 'green', label: 'グリーン', hex: '#166534' },
  { key: 'yellow', label: 'イエロー', hex: '#854d0e' },
  { key: 'red', label: 'レッド', hex: '#991b1b' },
  { key: 'purple', label: 'パープル', hex: '#6b21a8' },
  { key: 'orange', label: 'オレンジ', hex: '#9a3412' },
  { key: 'teal', label: 'ティール', hex: '#115e59' },
  { key: 'gray', label: 'グレー', hex: '#1e293b' },
];

export const DEFAULT_PROJECT_THEME_COLOR = PROJECT_THEME_COLORS[0].hex;
