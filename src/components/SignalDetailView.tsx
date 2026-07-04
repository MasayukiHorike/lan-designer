import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { SignalRepository } from '../repositories/SignalRepository';
import { getSignalPorts } from '../services/FrameSignalTreeService';
import { getPreviousSignalVersion } from '../services/VersionCompareService';
import {
  getElementIssues,
  fieldStatus,
  otherIssues,
  type ElementIssues,
} from '../services/check/ElementCheckStatusService';
import type { Signal } from '../types/schema';

const signalRepo = new SignalRepository();

function StatusIcon({ status }: { status: 'ok' | 'warning' | 'error' }) {
  if (status === 'error') return <span className="text-red-600">✗</span>;
  if (status === 'warning') return <span className="text-amber-600">⚠</span>;
  return <span className="text-emerald-600">✓</span>;
}

function DiffValue({ oldValue, newValue, diffMode }: { oldValue: string; newValue: string; diffMode: boolean }) {
  if (!diffMode || oldValue === newValue) return <>{newValue}</>;
  return (
    <>
      {oldValue}→<span className="font-semibold text-blue-600">★{newValue}</span>
    </>
  );
}

interface Props {
  signalId: string;
  headerExtra?: ReactNode;
}

export function SignalDetailView({ signalId, headerExtra }: Props) {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [previous, setPrevious] = useState<Signal | null>(null);
  const [ports, setPorts] = useState<{ label: string; direction: 'T' | 'R' }[]>([]);
  const [issues, setIssues] = useState<ElementIssues>({ errors: [], warnings: [] });
  const [diffMode, setDiffMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await signalRepo.findById(signalId);
      if (!s || cancelled) return;
      const [prev, p, iss] = await Promise.all([
        getPreviousSignalVersion(s),
        getSignalPorts(s.projectId, s._id),
        getElementIssues(s.name, s.applicationId),
      ]);
      if (cancelled) return;
      setSignal(s);
      setPrevious(prev);
      setPorts(p);
      setIssues(iss);
    })();
    return () => {
      cancelled = true;
    };
  }, [signalId]);

  if (!signal) {
    return <p className="text-slate-400">読み込み中...</p>;
  }

  const rows: { label: string; field: string; oldValue: string; newValue: string }[] = [
    {
      label: 'ビット位置',
      field: 'bitPosition',
      oldValue: previous ? String(previous.bitPosition) : '',
      newValue: String(signal.bitPosition),
    },
    {
      label: 'ビット長',
      field: 'bitPosition',
      oldValue: previous ? String(previous.bitLength) : '',
      newValue: String(signal.bitLength),
    },
    { label: 'エンディアン', field: 'endian', oldValue: previous?.endian ?? '', newValue: signal.endian },
    {
      label: 'イベント条件',
      field: 'eventCondition',
      oldValue: previous?.eventCondition ?? '',
      newValue: signal.eventCondition,
    },
    { label: '単位', field: 'unit', oldValue: previous?.unit ?? '', newValue: signal.unit },
    {
      label: '分解能',
      field: 'resolution',
      oldValue: previous ? String(previous.resolution) : '',
      newValue: String(signal.resolution),
    },
    {
      label: '初期値',
      field: 'initialValue',
      oldValue: previous ? String(previous.initialValue) : '',
      newValue: String(signal.initialValue),
    },
    {
      label: 'フェール値',
      field: 'failValue',
      oldValue: previous ? String(previous.failValue) : '',
      newValue: String(signal.failValue),
    },
    { label: 'バージョンNo', field: 'versionNo', oldValue: previous?.versionNo ?? '', newValue: signal.versionNo },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {signal.name} ({signal.versionNo}){' '}
            {signal.deleted && <span className="text-sm text-red-500">[削除済み]</span>}
          </h2>
          <p className="text-xs text-slate-500">{signal.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-slate-300 text-xs">
            <button
              type="button"
              onClick={() => setDiffMode(false)}
              className={`px-2 py-1 ${!diffMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
            >
              通常表示
            </button>
            <button
              type="button"
              onClick={() => setDiffMode(true)}
              disabled={!previous}
              className={`px-2 py-1 disabled:opacity-40 ${diffMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
            >
              変化点表示
            </button>
          </div>
          {headerExtra}
        </div>
      </div>

      {!previous && (
        <p className="text-xs text-slate-400">初版のため比較対象となる直前バージョンがありません（変化点表示は無効）。</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">プロパティ</h3>
        <dl className="grid grid-cols-[140px_180px_20px_1fr] items-start gap-y-1.5">
          {rows.map((row, i) => {
            const rowErrors = issues.errors.filter((e) => e.field === row.field);
            const rowWarnings = issues.warnings.filter((w) => w.field === row.field);
            return (
              <Fragment key={`${row.field}-${i}`}>
                <dt className="text-slate-500">{row.label}</dt>
                <dd>
                  <DiffValue oldValue={row.oldValue} newValue={row.newValue} diffMode={diffMode} />
                </dd>
                <span>
                  <StatusIcon status={fieldStatus(issues, row.field)} />
                </span>
                <span className="text-xs">
                  {rowErrors.map((issue, j) => (
                    <p key={`e-${j}`} className="text-red-600">
                      {issue.message}
                    </p>
                  ))}
                  {rowWarnings.map((issue, j) => (
                    <p key={`w-${j}`} className="text-amber-600">
                      {issue.message}
                    </p>
                  ))}
                </span>
              </Fragment>
            );
          })}
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">T/Rポート</h3>
        {ports.length === 0 && <p className="text-slate-400">登録なし</p>}
        <ul className="flex flex-col gap-1">
          {ports.map((p, i) => (
            <li key={i}>
              {p.label}: {p.direction === 'T' ? 'P-Port' : 'R-Port'}
            </li>
          ))}
        </ul>
      </div>

      {(() => {
        const other = otherIssues(
          issues,
          rows.map((r) => r.field),
        );
        if (other.errors.length === 0 && other.warnings.length === 0) return null;
        return (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
            <h3 className="mb-2 text-sm font-semibold text-red-700">エラー表示領域</h3>
            <p className="mb-2 text-xs text-slate-500">項目ごとに表示しづらいエラー・警告</p>
            {other.errors.map((e, i) => (
              <p key={`e-${i}`} className="text-red-700">
                ✗ {e.message}
              </p>
            ))}
            {other.warnings.map((w, i) => (
              <p key={`w-${i}`} className="text-amber-700">
                ⚠ {w.message}
              </p>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
