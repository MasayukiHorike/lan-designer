import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { buildFrameSignalTree, type TreeEcuNode } from '../../services/FrameSignalTreeService';
import { FrameDetailView } from '../../components/FrameDetailView';
import { SignalDetailView } from '../../components/SignalDetailView';
import { FrameSignalTree, type SelectedNode } from './FrameSignalTree';

function openStandalone(path: string) {
  window.open(`${window.location.pathname}#${path}`, '_blank', 'noopener');
}

export function P30_FrameSignal() {
  const { project } = useProject();
  const [tree, setTree] = useState<TreeEcuNode[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedNode>(null);

  useEffect(() => {
    if (!project) return;
    buildFrameSignalTree(project._id, showDeleted).then(setTree);
  }, [project, showDeleted]);

  return (
    <div className="flex h-full gap-0 -m-6">
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
  );
}
