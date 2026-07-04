import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { TreeEcuNode } from '../../services/FrameSignalTreeService';

export type SelectedNode = { type: 'frame' | 'signal'; id: string } | null;

interface Props {
  tree: TreeEcuNode[];
  showDeleted: boolean;
  onToggleShowDeleted: (value: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selected: SelectedNode;
  onSelect: (node: SelectedNode) => void;
}

function matches(text: string, search: string): boolean {
  return text.toLowerCase().includes(search.toLowerCase());
}

export function FrameSignalTree({
  tree,
  showDeleted,
  onToggleShowDeleted,
  search,
  onSearchChange,
  selected,
  onSelect,
}: Props) {
  const [collapsedEcus, setCollapsedEcus] = useState<Set<string>>(new Set());
  const [collapsedFrames, setCollapsedFrames] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return tree;
    return tree
      .map((ecu) => ({
        ...ecu,
        frames: ecu.frames
          .map((frame) => ({
            ...frame,
            signals: frame.signals.filter((s) => matches(s.name, search)),
          }))
          .filter(
            (frame) => matches(frame.name, search) || frame.signals.length > 0 || matches(ecu.label, search),
          ),
      }))
      .filter((ecu) => matches(ecu.label, search) || ecu.frames.length > 0);
  }, [tree, search]);

  const toggleEcu = (id: string) => {
    setCollapsedEcus((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleFrame = (id: string) => {
    setCollapsedFrames((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full w-72 shrink-0 flex-col gap-2 border-r border-slate-200 bg-white p-3">
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={showDeleted} onChange={(e) => onToggleShowDeleted(e.target.checked)} />
        削除済みを表示
      </label>
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="検索（ECU/Frame/Signal名）"
        className="rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <div className="flex-1 overflow-y-auto">
        {filtered.map((ecu) => (
          <div key={ecu.ecuId} className="mb-1">
            <button
              type="button"
              onClick={() => toggleEcu(ecu.ecuId)}
              className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {collapsedEcus.has(ecu.ecuId) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              {ecu.label}
            </button>
            {!collapsedEcus.has(ecu.ecuId) &&
              ecu.frames.map((frame) => (
                <div key={frame.id} className="ml-4">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleFrame(frame.id)}
                      className="flex items-center gap-1 rounded p-0.5 text-slate-500 hover:bg-slate-50"
                    >
                      {collapsedFrames.has(frame.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect({ type: 'frame', id: frame.id })}
                      className={`flex flex-1 items-center gap-1 truncate rounded px-1 py-1 text-left text-sm ${
                        selected?.type === 'frame' && selected.id === frame.id
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {frame.deleted && <Trash2 size={12} className="shrink-0 text-red-400" />}
                      {frame.name}
                    </button>
                  </div>
                  {!collapsedFrames.has(frame.id) && (
                    <div className="ml-6">
                      {frame.signals.map((signal) => (
                        <button
                          key={signal.id}
                          type="button"
                          onClick={() => onSelect({ type: 'signal', id: signal.id })}
                          className={`flex w-full items-center gap-1 truncate rounded px-1 py-1 text-left text-xs ${
                            selected?.type === 'signal' && selected.id === signal.id
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {signal.deleted && <Trash2 size={11} className="shrink-0 text-red-400" />}
                          {signal.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        ))}
        {filtered.length === 0 && <p className="p-2 text-sm text-slate-400">データがありません</p>}
      </div>
    </div>
  );
}
