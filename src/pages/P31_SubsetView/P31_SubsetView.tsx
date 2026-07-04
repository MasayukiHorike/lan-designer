import { Fragment, useEffect, useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { VariantRepository } from '../../repositories/VariantRepository';
import { buildSubsetMatrix, type SubsetMatrix } from '../../services/SubsetMatrixService';
import type { Variant } from '../../types/schema';

const variantRepo = new VariantRepository();

function openStandalone(path: string) {
  window.open(`${window.location.pathname}#${path}`, '_blank', 'noopener');
}

function groupColumns(columns: SubsetMatrix['columns']) {
  const groups: { ecuLabel: string; span: number }[] = [];
  for (const col of columns) {
    const last = groups[groups.length - 1];
    if (last && last.ecuLabel === col.ecuLabel) last.span++;
    else groups.push({ ecuLabel: col.ecuLabel, span: 1 });
  }
  return groups;
}

export function P31_SubsetView() {
  const { project } = useProject();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [matrix, setMatrix] = useState<SubsetMatrix | null>(null);

  useEffect(() => {
    if (!project) return;
    variantRepo.findByProjectId(project._id).then((list) => {
      setVariants(list);
      if (list.length > 0) setSelectedVariantId(list[0]._id);
    });
  }, [project]);

  useEffect(() => {
    if (!project || !selectedVariantId) {
      setMatrix(null);
      return;
    }
    const variant = variants.find((v) => v._id === selectedVariantId);
    if (!variant) return;
    buildSubsetMatrix(project._id, variant).then(setMatrix);
  }, [project, selectedVariantId, variants]);

  const columnGroups = matrix ? groupColumns(matrix.columns) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">サブセット別参照</h1>
        <p className="text-sm text-slate-500">選択したサブセットで有効なECU・Frame・Signalのみを絞り込んで表示します。</p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        サブセット選択：
        <select
          value={selectedVariantId}
          onChange={(e) => setSelectedVariantId(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1"
        >
          {variants.map((v) => (
            <option key={v._id} value={v._id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      {variants.length === 0 && <p className="text-slate-400">サブセットが登録されていません。</p>}

      {matrix && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="px-3 py-1"></th>
                {columnGroups.map((g, i) => (
                  <th key={i} colSpan={g.span} className="border-l border-slate-100 px-3 py-1 text-center">
                    {g.ecuLabel}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="px-3 py-1"></th>
                {matrix.columns.map((c) => (
                  <th key={c.key} className="border-l border-slate-100 px-3 py-1 text-center">
                    {c.connectorId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.groups.map((group) => (
                <Fragment key={group.frame.id}>
                  <tr
                    onClick={() => openStandalone(`/frames/${group.frame.id.split('/')[1]}`)}
                    className="cursor-pointer border-b border-slate-100 font-medium hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-3 py-1.5">{group.frame.name}</td>
                    {matrix.columns.map((c) => (
                      <td key={c.key} className="border-l border-slate-50 px-3 py-1.5 text-center">
                        {group.frame.cells[c.key] ?? ''}
                      </td>
                    ))}
                  </tr>
                  {group.signals.map((signal) => (
                    <tr
                      key={signal.id}
                      onClick={() => openStandalone(`/signals/${signal.id.split('/')[1]}`)}
                      className="cursor-pointer border-b border-slate-50 text-slate-600 hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap py-1.5 pl-6 pr-3">{signal.name}</td>
                      {matrix.columns.map((c) => (
                        <td key={c.key} className="border-l border-slate-50 px-3 py-1.5 text-center">
                          {signal.cells[c.key] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {matrix.groups.length === 0 && (
                <tr>
                  <td colSpan={matrix.columns.length + 1} className="py-6 text-center text-slate-400">
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
