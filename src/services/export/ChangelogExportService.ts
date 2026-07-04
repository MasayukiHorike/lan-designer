import * as XLSX from 'xlsx';
import { SnapshotRepository } from '../../repositories/SnapshotRepository';
import { computeSnapshotDiff, type DiffViewEntry } from '../SnapshotService';
import { sanitizeSheetName } from './excelExportUtils';

const snapshotRepo = new SnapshotRepository();

const TYPE_LABELS: Record<DiffViewEntry['type'], string> = { added: '追加', modified: '変更', deleted: '削除' };

/** 変更履歴Excelを出力する（Part3 §13 出力④）。ECU単位でシートを生成する。 */
export async function exportChangelog(
  fromSnapshotId: string | null,
  toSnapshotId: string,
  ecuNames?: string[],
): Promise<void> {
  const toSnapshot = await snapshotRepo.findById(toSnapshotId);
  if (!toSnapshot) throw new Error('比較先断面が見つかりません');
  const fromSnapshot = fromSnapshotId ? (await snapshotRepo.findById(fromSnapshotId)) ?? null : null;

  let entries = await computeSnapshotDiff(fromSnapshot, toSnapshot);
  if (ecuNames && ecuNames.length > 0) {
    entries = entries.filter((e) => ecuNames.includes(e.ecuName));
  }

  const grouped = new Map<string, DiffViewEntry[]>();
  for (const e of entries) {
    const key = e.ecuName || '(不明)';
    const list = grouped.get(key) ?? [];
    list.push(e);
    grouped.set(key, list);
  }

  const wb = XLSX.utils.book_new();
  if (grouped.size === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['変更はありません']]), 'Sheet1');
  }
  for (const [ecuName, list] of grouped) {
    const rows: (string | number)[][] = [['種別', '対象', '名前', '旧バージョン', '新バージョン']];
    for (const e of list) {
      rows.push([TYPE_LABELS[e.type], e.targetType === 'frame' ? 'Frame' : 'Signal', e.name, e.beforeVersion ?? '', e.afterVersion ?? '']);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sanitizeSheetName(ecuName));
  }

  const fromLabel = fromSnapshot?.snapshotName ?? '初回';
  XLSX.writeFile(wb, `変更履歴_${fromLabel}-${toSnapshot.snapshotName}.xlsx`);
}
