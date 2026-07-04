import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FrameRepository } from '../repositories/FrameRepository';
import { SignalRepository } from '../repositories/SignalRepository';
import { getFrameTxRxEcus } from '../services/FrameSignalTreeService';
import { getPreviousFrameVersion } from '../services/VersionCompareService';
import {
  getElementIssues,
  fieldStatus,
  otherIssues,
  type ElementIssues,
} from '../services/check/ElementCheckStatusService';
import { BitMatrix } from './BitMatrix';
import { formatDateTime } from '../utils/dateUtils';
import type { Frame, Signal } from '../types/schema';

const frameRepo = new FrameRepository();
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
  frameId: string;
  onSelectSignal?: (signalId: string) => void;
  headerExtra?: ReactNode;
}

export function FrameDetailView({ frameId, onSelectSignal, headerExtra }: Props) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [previousFrame, setPreviousFrame] = useState<Frame | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [txRx, setTxRx] = useState<{ label: string; direction: 'T' | 'R' }[]>([]);
  const [issues, setIssues] = useState<ElementIssues>({ errors: [], warnings: [] });
  const [diffMode, setDiffMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const f = await frameRepo.findById(frameId);
      if (!f || cancelled) return;
      const [sigs, tr, prev, iss] = await Promise.all([
        signalRepo.findByFrameId(f._id),
        getFrameTxRxEcus(f.projectId, f._id),
        getPreviousFrameVersion(f),
        getElementIssues(f.name, f.applicationId),
      ]);
      if (cancelled) return;
      setFrame(f);
      setSignals(sigs);
      setTxRx(tr);
      setPreviousFrame(prev);
      setIssues(iss);
    })();
    return () => {
      cancelled = true;
    };
  }, [frameId]);

  if (!frame) {
    return <p className="text-slate-400">読み込み中...</p>;
  }

  const bitMatrixSignals = signals.map((s) => ({ id: s._id, name: s.name, bitPosition: s.bitPosition, bitLength: s.bitLength }));

  const rows: { label: string; field: string; oldValue: string; newValue: string }[] = [
    { label: 'CAN-ID', field: 'canId', oldValue: previousFrame?.canId ?? '', newValue: frame.canId },
    { label: 'DLC', field: 'dlc', oldValue: previousFrame ? String(previousFrame.dlc) : '', newValue: String(frame.dlc) },
    {
      label: 'プロトコル',
      field: 'protocol',
      oldValue: previousFrame?.protocol ?? '',
      newValue: frame.protocol,
    },
    {
      label: '周期',
      field: 'cycleTime',
      oldValue: previousFrame ? `${previousFrame.cycleTime}ms` : '',
      newValue: `${frame.cycleTime}ms`,
    },
    {
      label: '送信電源',
      field: 'powerSource',
      oldValue: previousFrame?.powerSource.join(',') ?? '',
      newValue: frame.powerSource.join(','),
    },
    {
      label: 'イベントフラグ',
      field: 'eventFlag',
      oldValue: previousFrame ? (previousFrame.eventFlag ? 'ON' : 'OFF') : '',
      newValue: frame.eventFlag ? 'ON' : 'OFF',
    },
    {
      label: 'バージョンNo',
      field: 'versionNo',
      oldValue: previousFrame?.versionNo ?? '',
      newValue: frame.versionNo,
    },
    {
      label: 'E2E',
      field: 'e2e',
      oldValue: previousFrame ? (previousFrame.e2e.enabled ? `ON(${previousFrame.e2e.profile})` : 'OFF') : '',
      newValue: frame.e2e.enabled ? `ON(${frame.e2e.profile})` : 'OFF',
    },
    {
      label: 'SecOC',
      field: 'secoc',
      oldValue: previousFrame ? (previousFrame.secoc.enabled ? `ON(${previousFrame.secoc.fvMethod})` : 'OFF') : '',
      newValue: frame.secoc.enabled ? `ON(${frame.secoc.fvMethod})` : 'OFF',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {frame.name} ({frame.versionNo}) {frame.deleted && <span className="text-sm text-red-500">[削除済み]</span>}
          </h2>
          <p className="text-xs text-slate-500">{frame.description}</p>
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
              disabled={!previousFrame}
              className={`px-2 py-1 disabled:opacity-40 ${diffMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
            >
              変化点表示
            </button>
          </div>
          {headerExtra}
        </div>
      </div>

      {!previousFrame && (
        <p className="text-xs text-slate-400">初版のため比較対象となる直前バージョンがありません（変化点表示は無効）。</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">プロパティ</h3>
        <dl className="grid grid-cols-[140px_180px_20px_1fr] items-start gap-y-1.5">
          {rows.map((row) => {
            const rowErrors = issues.errors.filter((i) => i.field === row.field);
            const rowWarnings = issues.warnings.filter((i) => i.field === row.field);
            return (
              <Fragment key={row.field}>
                <dt className="text-slate-500">{row.label}</dt>
                <dd>
                  <DiffValue oldValue={row.oldValue} newValue={row.newValue} diffMode={diffMode} />
                </dd>
                <span>
                  <StatusIcon status={fieldStatus(issues, row.field)} />
                </span>
                <span className="text-xs">
                  {rowErrors.map((issue, i) => (
                    <p key={`e-${i}`} className="text-red-600">
                      {issue.message}
                    </p>
                  ))}
                  {rowWarnings.map((issue, i) => (
                    <p key={`w-${i}`} className="text-amber-600">
                      {issue.message}
                    </p>
                  ))}
                </span>
              </Fragment>
            );
          })}
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">ビット配置マトリクス</h3>
        <BitMatrix
          dlc={frame.dlc}
          e2eEnabled={frame.e2e.enabled}
          e2eReservedBits={frame.e2e.reservedBits}
          e2eReservedStartBit={frame.e2e.reservedStartBit}
          secocEnabled={frame.secoc.enabled}
          secocReservedBits={frame.secoc.reservedBits}
          secocReservedStartBit={frame.secoc.reservedStartBit}
          signals={bitMatrixSignals}
          selectedSignalId={selectedSignalId}
          onSelectSignal={(id) => {
            setSelectedSignalId(id);
            onSelectSignal?.(id);
          }}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">送受信ECU（参考）</h3>
        <p className="text-slate-600">
          {txRx.length === 0 ? '登録なし' : txRx.map((t) => `${t.label}: ${t.direction}`).join(' / ')}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">所属Signal</h3>
        {signals.length === 0 && <p className="text-slate-400">Signalはありません</p>}
        <ul className="flex flex-col gap-1">
          {signals.map((s) => (
            <li key={s._id}>
              <button
                type="button"
                onClick={() => onSelectSignal?.(s._id)}
                className="text-blue-600 hover:underline"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex items-center gap-1 text-sm font-semibold text-slate-700"
        >
          {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          バージョン履歴
        </button>
        {historyOpen && (
          <div className="mt-2 text-xs text-slate-600">
            {previousFrame ? (
              <p>
                直前バージョン：{previousFrame.versionNo}（{formatDateTime(previousFrame.updatedAt)}更新）
              </p>
            ) : (
              <p className="text-slate-400">直前バージョンはありません（初版）</p>
            )}
            <p className="mt-1">現在バージョン：{frame.versionNo}（{formatDateTime(frame.updatedAt)}更新）</p>
          </div>
        )}
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
