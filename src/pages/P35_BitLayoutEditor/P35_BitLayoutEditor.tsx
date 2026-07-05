import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { useRole } from '../../contexts/RoleContext';
import { FrameRepository } from '../../repositories/FrameRepository';
import { SignalRepository } from '../../repositories/SignalRepository';
import { ApplicationRepository } from '../../repositories/ApplicationRepository';
import { canLanApproverEdit, editSignalProperties } from '../../services/ReviewEditService';
import { isBitPlacementValid } from '../../utils/bitLayout';
import { BitMatrix } from '../../components/BitMatrix';
import { Level2Results } from '../../components/Level2Results';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { Application, Frame, Signal } from '../../types/schema';

const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();
const applicationRepo = new ApplicationRepository();

export function P35_BitLayoutEditor() {
  const { frameId } = useParams<{ frameId: string }>();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('applicationId');
  const { role } = useRole();

  const [frame, setFrame] = useState<Frame | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [application, setApplication] = useState<Application | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, number>>({});
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    if (!frameId || !applicationId) return;
    const f = await frameRepo.findById(`frames/${frameId}`);
    if (!f) return;
    const [sigs, app] = await Promise.all([
      signalRepo.findByFrameId(f._id),
      applicationRepo.findById(applicationId),
    ]);
    setFrame(f);
    setSignals(sigs);
    setApplication(app ?? null);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId, applicationId]);

  if (!frameId || !applicationId) {
    return <p className="p-6 text-slate-400">frameId・applicationIdが指定されていません。</p>;
  }
  if (!frame || !application) {
    return <p className="p-6 text-slate-400">読み込み中...</p>;
  }

  const canEdit = canLanApproverEdit(application, role);
  const draggableSignalIds = canEdit
    ? new Set(signals.filter((s) => s.applicationId === applicationId).map((s) => s._id))
    : undefined;

  const effectiveSignals = signals.map((s) =>
    pendingChanges[s._id] !== undefined ? { ...s, bitPosition: pendingChanges[s._id] } : s,
  );
  const bitMatrixSignals = effectiveSignals.map((s) => ({
    id: s._id,
    name: s.name,
    bitPosition: s.bitPosition,
    bitLength: s.bitLength,
  }));

  const handleSignalMoved = (signalId: string, newBitPosition: number) => {
    const original = signals.find((s) => s._id === signalId);
    if (!original) return;
    setSaved(false);
    setPendingChanges((prev) => {
      const next = { ...prev };
      if (newBitPosition === original.bitPosition) {
        delete next[signalId];
      } else {
        next[signalId] = newBitPosition;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!role) return;
    setSaving(true);
    setError(null);
    try {
      let app = application;
      for (const [signalId, bitPosition] of Object.entries(pendingChanges)) {
        app = await editSignalProperties(app, signalId, { bitPosition }, role, role);
      }
      setApplication(app);
      setPendingChanges({});
      await load();
      setSaved(true);
      if (window.opener) {
        (window.opener as Window).location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ビット配置の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingChanges({});
    setSaved(false);
  };

  const handleClose = () => {
    window.close();
  };

  const pendingList = Object.entries(pendingChanges).map(([signalId, bitPosition]) => {
    const signal = signals.find((s) => s._id === signalId);
    return { signalId, name: signal?.name ?? signalId, before: signal?.bitPosition ?? 0, after: bitPosition };
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              ビット配置グラフィック編集：{frame.name}（{frame.versionNo}）
            </h1>
            <p className="text-xs text-slate-500">DLC={frame.dlc}byte</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <X size={13} />
            閉じる
          </button>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {!canEdit && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            この画面は参照専用です。ビット配置のドラッグ編集は、この申請書の二次審査
            （in_review_2nd）中、現在の対応順のLAN承認者のみ操作できます。
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4">
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
            onSelectSignal={setSelectedSignalId}
            draggableSignalIds={draggableSignalIds}
            isPlacementValid={(bitPosition, bitLength) => isBitPlacementValid(frame, bitPosition, bitLength)}
            onSignalMoved={handleSignalMoved}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">変更差分</h2>
          {pendingList.length === 0 && <p className="text-slate-400">変更はありません</p>}
          <ul className="flex flex-col gap-1">
            {pendingList.map((c) => (
              <li key={c.signalId}>
                {c.name}：{c.before} → <span className="font-semibold text-blue-600">{c.after}</span>
              </li>
            ))}
          </ul>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pendingList.length === 0 || saving}
              onClick={handleSave}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              disabled={pendingList.length === 0 || saving}
              onClick={handleCancel}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              キャンセル
            </button>
          </div>
        )}

        {saved && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <p className="mb-2 text-emerald-600">保存しました。</p>
            <Level2Results level2={application.checkResults.level2} />
            {!window.opener && (
              <p className="mt-2 text-xs text-slate-500">
                申請書詳細画面に戻り再読込してください。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
