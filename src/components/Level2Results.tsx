import type { CheckResult } from '../types/check';
import { ErrorList } from './ErrorList/ErrorList';

export function Level2Results({ level2 }: { level2: Record<string, CheckResult> }) {
  const subsetNames = Object.keys(level2);

  if (subsetNames.length === 0) {
    return <p className="text-sm text-slate-400">Level2：サブセットが未登録のため未実行です</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {subsetNames.map((name) => {
        const result = level2[name];
        return (
          <div key={name}>
            <p className="text-sm">
              Level2（{name}）：
              {result.status === 'ok' ? '○ エラーなし' : result.status === 'warning' ? '△ 警告あり' : '✗ エラーあり'}
            </p>
            <ErrorList result={result} />
          </div>
        );
      })}
    </div>
  );
}
