/** Excelシート名の制約（31文字以内・使用不可文字なし）に合わせて名前を整形する */
export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, '_');
  return cleaned.slice(0, 31) || 'Sheet1';
}
