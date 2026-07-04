export interface CheckIssue {
  code: string;
  message: string;
  targetType?: string;
  targetId?: string;
  /** P30等でプロパティ単位のエラーアイコン表示に使う対象フィールド名（任意） */
  field?: string;
}

export interface CheckResult {
  status: 'ok' | 'error' | 'warning';
  errors: CheckIssue[];
  warnings: CheckIssue[];
}

export function okResult(): CheckResult {
  return { status: 'ok', errors: [], warnings: [] };
}

export function buildResult(errors: CheckIssue[], warnings: CheckIssue[] = []): CheckResult {
  return {
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
    errors,
    warnings,
  };
}
