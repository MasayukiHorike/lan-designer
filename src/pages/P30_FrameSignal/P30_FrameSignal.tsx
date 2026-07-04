import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { buildFrameSignalTree, type SnapshotFilter, type TreeEcuNode } from '../../services/FrameSignalTreeService';
import { SnapshotRepository } from '../../repositories/SnapshotRepository';
import { FrameDetailView } from '../../components/FrameDetailView';
import { SignalDetailView } from '../../components/SignalDetailView';
import type { Snapshot } from '../../types/schema';
import { FrameSignalTree, type SelectedNode } from './FrameSignalTree';

const snapshotRepo = new SnapshotRepository();

function openStandalone(path: string) {
  window.open(`${window.location.pathname}#${path}`, '_blank', 'noopener');
}

export function P30_FrameSignal() {
  const { project } = useProject();
  const [searchParams] = useSearchParams();
  const snapshotId = searchParams.get('snapshot');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [tree, setTree] = useState<TreeEcuNode[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedNode>(null);

  useEffect(() => {
    if (!snapshotId) {
      setSnapshot(null);
      return;
    }
    snapshotRepo.findById(`snapshots/${snapshotId}`).then((s) => setSnapshot(s ?? null));
  }, [snapshotId]);

  useEffect(() => {
    if (!project) return;
    if (snapshotId && !snapshot) return; // 断面指定時はロード完了を待つ
    const filter: SnapshotFilter | undefined = snapshot
      ? { frameIds: new Set(snapshot.frameIds), signalIds: new Set(snapshot.signalIds) }
      : undefined;
    buildFrameSignalTree(project._id, showDeleted, filter).then(setTree);
  }, [project, showDeleted, snapshot, snapshotId]);

  return (
    <div className="flex h-full flex-col -m-6">
      {snapshot && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          過去断面表示中：{snapshot.snapshotName}（確定日時：{snapshot.confirmedAt.slice(0, 10)}）
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <FrameSignalTree
          tree={tree}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          search={search}
          onSearchChange={setSearch}
          selected={selected}
          onSelect={setSelected}
        />
        <div className="flex-1 overflow-y-auto p-6">
          {!selected && <p className="text-slate-400">左のツリーからFrameまたはSignalを選択してください</p>}
          {selected?.type === 'frame' && (
            <FrameDetailView
              frameId={selected.id}
              onSelectSignal={(signalId) => setSelected({ type: 'signal', id: signalId })}
              headerExtra={
                <button
                  type="button"
                  onClick={() => openStandalone(`/frames/${selected.id.split('/')[1]}`)}
                  className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink size={13} />
                  独立画面で開く
                </button>
              }
            />
          )}
          {selected?.type === 'signal' && (
            <SignalDetailView
              signalId={selected.id}
              headerExtra={
                <button
                  type="button"
                  onClick={() => openStandalone(`/signals/${selected.id.split('/')[1]}`)}
                  className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink size={13} />
                  独立画面で開く
                </button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
