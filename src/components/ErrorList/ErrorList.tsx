import { AlertTriangle, XCircle } from 'lucide-react';
import type { CheckResult } from '../../types/check';

export function ErrorList({ result }: { result: CheckResult | null }) {
  if (!result || (result.errors.length === 0 && result.warnings.length === 0)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-3">
      {result.errors.map((issue, i) => (
        <div key={`err-${i}`} className="flex items-start gap-2 text-sm text-red-700">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <span>{issue.message}</span>
        </div>
      ))}
      {result.warnings.map((issue, i) => (
        <div key={`warn-${i}`} className="flex items-start gap-2 text-sm text-amber-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}
