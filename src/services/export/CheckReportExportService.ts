import * as XLSX from 'xlsx';
import { sanitizeSheetName } from './excelExportUtils';
import type { Application } from '../../types/schema';
import type { CheckResult } from '../../types/check';

function checkResultRows(result: CheckResult): (string | number)[][] {
  const rows: (string | number)[][] = [['種別', 'コード', 'メッセージ']];
  for (const e of result.errors) rows.push(['エラー', e.code, e.message]);
  for (const w of result.warnings) rows.push(['警告', w.code, w.message]);
  if (rows.length === 1) rows.push(['-', '-', 'エラー・警告はありません']);
  return rows;
}

/** エラーチェック結果レポートExcelを出力する（Part3 §13 出力③）。Level1・Level2をそれぞれシート化する。 */
export function exportCheckReport(
  application: Application,
  includeLevel1: boolean,
  includeLevel2: boolean,
): void {
  const wb = XLSX.utils.book_new();

  if (includeLevel1) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(checkResultRows(application.checkResults.level1)), 'Level1');
  }

  if (includeLevel2) {
    const entries = Object.entries(application.checkResults.level2);
    if (entries.length === 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([['サブセットが未登録のためLevel2は未実行です']]),
        'Level2',
      );
    }
    for (const [subsetName, result] of entries) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(checkResultRows(result)), sanitizeSheetName(`L2_${subsetName}`));
    }
  }

  XLSX.writeFile(wb, `チェック結果_${application.applicationNo}.xlsx`);
}
