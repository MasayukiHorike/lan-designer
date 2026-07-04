import * as XLSX from 'xlsx';
import { VariantRepository } from '../../repositories/VariantRepository';
import { SnapshotRepository } from '../../repositories/SnapshotRepository';
import { buildSubsetMatrix } from '../SubsetMatrixService';
import { sanitizeSheetName } from './excelExportUtils';

const variantRepo = new VariantRepository();
const snapshotRepo = new SnapshotRepository();

/**
 * 全体通信マトリクスExcelを出力する（Part3 §13 出力①）。
 * 選択した断面（published時点）・サブセットごとに、ECU単位でシートを生成する。
 */
export async function exportCommunicationMatrix(
  projectId: string,
  snapshotId: string,
  variantIds: string[],
): Promise<void> {
  const snapshot = await snapshotRepo.findById(snapshotId);
  if (!snapshot) throw new Error('断面が見つかりません');
  const snapshotFilter = { frameIds: new Set(snapshot.frameIds), signalIds: new Set(snapshot.signalIds) };

  const variants = await variantRepo.findByProjectId(projectId);
  const selectedVariants = variants.filter((v) => variantIds.includes(v._id));

  const wb = XLSX.utils.book_new();
  let sheetCount = 0;

  for (const variant of selectedVariants) {
    const matrix = await buildSubsetMatrix(projectId, variant, snapshotFilter);
    const ecuLabels = [...new Set(matrix.columns.map((c) => c.ecuLabel))];

    for (const ecuLabel of ecuLabels) {
      const ecuColumns = matrix.columns.filter((c) => c.ecuLabel === ecuLabel);
      const relevantGroups = matrix.groups.filter(
        (g) =>
          ecuColumns.some((c) => g.frame.cells[c.key]) ||
          g.signals.some((s) => ecuColumns.some((c) => s.cells[c.key])),
      );
      if (relevantGroups.length === 0) continue;

      const rows: (string | number)[][] = [
        ['', ...ecuColumns.map(() => ecuLabel)],
        ['Frame/Signal', ...ecuColumns.map((c) => c.connectorId)],
      ];
      for (const g of relevantGroups) {
        rows.push([g.frame.name, ...ecuColumns.map((c) => g.frame.cells[c.key] ?? '')]);
        for (const s of g.signals) {
          rows.push([`  ${s.name}`, ...ecuColumns.map((c) => s.cells[c.key] ?? '')]);
        }
      }

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(rows),
        sanitizeSheetName(`${variant.name}_${ecuLabel}`),
      );
      sheetCount++;
    }
  }

  if (sheetCount === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['データがありません']]), 'Sheet1');
  }

  XLSX.writeFile(wb, `通信マトリクス_${snapshot.snapshotName}.xlsx`);
}
