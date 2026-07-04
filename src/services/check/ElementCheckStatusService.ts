import { ApplicationRepository } from '../../repositories/ApplicationRepository';
import type { CheckIssue } from '../../types/check';
import type { Application } from '../../types/schema';

const applicationRepo = new ApplicationRepository();

export type IconStatus = 'ok' | 'warning' | 'error';

export interface ElementIssues {
  errors: CheckIssue[];
  warnings: CheckIssue[];
}

function collectAllIssues(application: Application): ElementIssues {
  const errors = [...application.checkResults.level1.errors];
  const warnings = [...application.checkResults.level1.warnings];
  for (const result of Object.values(application.checkResults.level2)) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  return { errors, warnings };
}

/**
 * 指定した要素名（Frame/Signalのname）に関連するエラー・警告を、その要素を生んだ
 * 申請書のLevel1/Level2チェック結果から抽出する。
 * 簡易実装：チェックのメッセージ文字列に要素名が含まれるかで判定する（部分一致）。
 */
export async function getElementIssues(
  elementName: string,
  applicationId: string | undefined,
): Promise<ElementIssues> {
  if (!applicationId) return { errors: [], warnings: [] };
  const application = await applicationRepo.findById(applicationId);
  if (!application) return { errors: [], warnings: [] };
  const all = collectAllIssues(application);
  return {
    errors: all.errors.filter((i) => i.message.includes(elementName)),
    warnings: all.warnings.filter((i) => i.message.includes(elementName)),
  };
}

export function overallStatus(issues: ElementIssues): IconStatus {
  if (issues.errors.length > 0) return 'error';
  if (issues.warnings.length > 0) return 'warning';
  return 'ok';
}

export function fieldStatus(issues: ElementIssues, field: string): IconStatus {
  if (issues.errors.some((i) => i.field === field)) return 'error';
  if (issues.warnings.some((i) => i.field === field)) return 'warning';
  return 'ok';
}

/** 指定フィールドに紐づくエラー・警告（プロパティ行の横に表示するテキスト用） */
export function fieldIssues(issues: ElementIssues, field: string): CheckIssue[] {
  return [...issues.errors, ...issues.warnings].filter((i) => i.field === field);
}

/**
 * 画面上のどのプロパティ行にも対応しないエラー・警告（fieldタグなし、または
 * 表示中のプロパティ行に無いfieldタグ）。エラー表示領域に表示する。
 * knownFieldsには画面に実際に描画しているプロパティ行のfield一覧を渡す。
 */
export function otherIssues(issues: ElementIssues, knownFields: string[]): ElementIssues {
  const known = new Set(knownFields);
  return {
    errors: issues.errors.filter((i) => !i.field || !known.has(i.field)),
    warnings: issues.warnings.filter((i) => !i.field || !known.has(i.field)),
  };
}
