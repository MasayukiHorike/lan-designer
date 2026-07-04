import { useEffect, useMemo, useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { SnapshotRepository } from '../../repositories/SnapshotRepository';
import { computeSnapshotDiff, type DiffViewEntry } from '../../services/SnapshotService';
import type { Snapshot } from '../../types/schema';

const snapshotRepo = new SnapshotRepository();

function openStandalone(path: string) {
  window.open(`${window.location.pathname}#${path}`, '_blank', 'noopener');
}

const TYPE_LABELS: Record<DiffViewEntry['type'], string> = { added: '追加', modified: '変更', deleted: '削除' };
const TYPE_COLORS: Record<DiffViewEntry['type'], string> = {
  added: 'text-emerald-600',
  modified: 'text-blue-600',
  deleted: 'text-red-600',
};

export function P51_Changelogs() {
  const { project } = useProject();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [entries, setEntries] = useState<DiffViewEntry[]>([]);
  const [ecuFilter, setEcuFilter] = useState('全て');
  const [typeFilter, setTypeFilter] = useState<'全て' | DiffViewEntry['type']>('全て');

  useEffect(() => {
    if (!project) return;
    snapshotRepo.findByProjectId(project._id).then((list) => {
      setSnapshots(list);
      if (list.length > 0) {
        setToId(list[0]._id);
      }
    });
  }, [project]);

  useEffect(() => {
    if (!toId) return;
    const to = snapshots.find((s) => s._id === toId);
    if (!to) return;
    // デフォルト：直前断面（toの1つ前のsequenceNo）
    const defaultFrom = snapshots.find((s) => s.sequenceNo === to.sequenceNo - 1);
    setFromId((current) => current || defaultFrom?._id || '');
  }, [toId, snapshots]);

  useEffect(() => {
    if (!toId) {
      setEntries([]);
      return;
    }
    const to = snapshots.find((s) => s._id === toId);
    const from = snapshots.find((s) => s._id === fromId) ?? null;
    if (!to) return;
    computeSnapshotDiff(from, to).then(setEntries);
  }, [fromId, toId, snapshots]);

  const ecuNames = useMemo(() => ['全て', ...new Set(entries.map((e) => e.ecuName).filter(Boolean))], [entries]);

  const filtered = entries
    .filter((e) => ecuFilter === '全て' || e.ecuName === ecuFilter)
    .filter((e) => typeFilter === '全て' || e.type === typeFilter);

  const grouped = useMemo(() => {
    const map = new Map<string, DiffViewEntry[]>();
    for (const e of filtered) {
      const key = e.ecuName || '（不明）';
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const summary = {
    added: filtered.filter((e) => e.type === 'added').length,
    modified: filtered.filter((e) => e.type === 'modified').length,
    deleted: filtered.filter((e) => e.type === 'deleted').length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">変更履歴</h1>
        <p className="text-sm text-slate-500">2つの断面間のFrame/Signalの追加・変更・削除を確認します。</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          比較元断面：
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            <option value="">（なし・初回として比較）</option>
            {snapshots.map((s) => (
              <option key={s._id} value={s._id}>
                {s.snapshotName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          比較先断面：
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            {snapshots.map((s) => (
              <option key={s._id} value={s._id}>
                {s.snapshotName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          ECU絞り込み：
          <select value={ecuFilter} onChange={(e) => setEcuFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            {ecuNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex overflow-hidden rounded border border-slate-300">
          {(['全て', 'added', 'modified', 'deleted'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-1 ${typeFilter === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
            >
              {t === '全て' ? '全て' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-600">
        変更サマリー：追加{summary.added} 変更{summary.modified} 削除{summary.deleted}
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        {grouped.length === 0 && <p className="text-slate-400">変更はありません</p>}
        {grouped.map(([ecuName, list]) => (
          <div key={ecuName} className="mb-3">
            <p className="mb-1 font-medium text-slate-700">{ecuName}</p>
            {list.map((entry) => (
              <div
                key={`${entry.targetType}-${entry.targetId}`}
                onClick={() =>
                  openStandalone(
                    entry.targetType === 'frame'
                      ? `/frames/${entry.targetId.split('/')[1]}`
                      : `/signals/${entry.targetId.split('/')[1]}`,
                  )
                }
                className="ml-2 flex cursor-pointer items-center gap-2 py-0.5 hover:bg-slate-50"
              >
                <span className={`font-medium ${TYPE_COLORS[entry.type]}`}>[{TYPE_LABELS[entry.type]}]</span>
                <span>{entry.name}</span>
                <span className="text-slate-500">
                  {entry.type === 'added' && entry.afterVersion}
                  {entry.type === 'deleted' && entry.beforeVersion}
                  {entry.type === 'modified' && `${entry.beforeVersion}→${entry.afterVersion}`}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
