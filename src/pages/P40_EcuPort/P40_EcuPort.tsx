import { Fragment, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { EcuRepository } from '../../repositories/EcuRepository';
import { buildEcuPortMatrix, type EcuPortMatrix, type PortCellDetail } from '../../services/EcuPortMatrixService';
import type { Ecu } from '../../types/schema';

const ecuRepo = new EcuRepository();

function groupColumns(columns: EcuPortMatrix['columns']) {
  const groups: { ecuLabel: string; span: number }[] = [];
  for (const col of columns) {
    const last = groups[groups.length - 1];
    if (last && last.ecuLabel === col.ecuLabel) last.span++;
    else groups.push({ ecuLabel: col.ecuLabel, span: 1 });
  }
  return groups;
}

type SelectedCell = { rowName: string; columnLabel: string; connectorId: string } & PortCellDetail;

export function P40_EcuPort() {
  const { project } = useProject();
  const [ecus, setEcus] = useState<Ecu[]>([]);
  const [selectedEcuIds, setSelectedEcuIds] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<EcuPortMatrix | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  useEffect(() => {
    if (!project) return;
    ecuRepo.findByProjectId(project._id).then((list) => {
      setEcus(list);
      if (list.length > 0) setSelectedEcuIds([list[0]._id]);
    });
  }, [project]);

  useEffect(() => {
    if (!project || selectedEcuIds.length === 0) {
      setMatrix(null);
      return;
    }
    buildEcuPortMatrix(project._id, selectedEcuIds).then(setMatrix);
    setSelectedCell(null);
  }, [project, selectedEcuIds]);

  const columnGroups = matrix ? groupColumns(matrix.columns) : [];
  const availableEcus = ecus.filter((e) => !selectedEcuIds.includes(e._id));

  const addEcu = (ecuId: string) => {
    if (ecuId) setSelectedEcuIds([...selectedEcuIds, ecuId]);
  };
  const removeEcu = (ecuId: string) => {
    setSelectedEcuIds(selectedEcuIds.filter((id) => id !== ecuId));
  };

  const selectCell = (rowName: string, columnLabel: string, connectorId: string, cell?: PortCellDetail) => {
    if (!cell) return;
    setSelectedCell({ rowName, columnLabel, connectorId, ...cell });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ECU Port参照</h1>
        <p className="text-sm text-slate-500">
          選択したECU（バリ単位）のFramePort/SignalPortを、Frame配下にSignalを並べた1つのマトリクスで確認します。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selectedEcuIds.map((id) => {
          const ecu = ecus.find((e) => e._id === id);
          if (!ecu) return null;
          return (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {ecu.name}_{ecu.variantNo}
              <button type="button" onClick={() => removeEcu(id)}>
                <X size={13} />
              </button>
            </span>
          );
        })}
        {availableEcus.length > 0 && (
          <select
            value=""
            onChange={(e) => addEcu(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">ECU追加 ▼</option>
            {availableEcus.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}_{e.variantNo}
              </option>
            ))}
          </select>
        )}
      </div>

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
                  <tr className="border-b border-slate-100 font-medium">
                    <td className="whitespace-nowrap px-3 py-1.5">{group.frame.name}</td>
                    {matrix.columns.map((c) => {
                      const cell = group.frame.cells[c.key];
                      return (
                        <td
                          key={c.key}
                          onClick={() => selectCell(group.frame.name, c.ecuLabel, c.connectorId, cell)}
                          className={`border-l border-slate-50 px-3 py-1.5 text-center ${
                            cell ? 'cursor-pointer hover:bg-slate-50' : ''
                          }`}
                        >
                          {cell?.direction ?? ''}
                        </td>
                      );
                    })}
                  </tr>
                  {group.signals.map((signal) => (
                    <tr key={signal.id} className="border-b border-slate-50 text-slate-600">
                      <td className="whitespace-nowrap py-1.5 pl-6 pr-3">{signal.name}</td>
                      {matrix.columns.map((c) => {
                        const cell = signal.cells[c.key];
                        return (
                          <td
                            key={c.key}
                            onClick={() => selectCell(signal.name, c.ecuLabel, c.connectorId, cell)}
                            className={`border-l border-slate-50 px-3 py-1.5 text-center ${
                              cell ? 'cursor-pointer hover:bg-slate-50' : ''
                            }`}
                          >
                            {cell?.direction ?? ''}
                          </td>
                        );
                      })}
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

      {selectedCell && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Port詳細：{selectedCell.rowName} / {selectedCell.columnLabel}（{selectedCell.connectorId}）
          </h2>
          <dl className="grid grid-cols-[100px_1fr] gap-y-1">
            <dt className="text-slate-500">方向</dt>
            <dd>{selectedCell.direction}</dd>
            <dt className="text-slate-500">E2E</dt>
            <dd>{selectedCell.e2eEnabled ? 'ON' : 'OFF'}</dd>
            <dt className="text-slate-500">SecOC</dt>
            <dd>{selectedCell.secocEnabled ? 'ON' : 'OFF'}</dd>
            <dt className="text-slate-500">途絶時間</dt>
            <dd>{selectedCell.timeoutMs != null ? `${selectedCell.timeoutMs}ms` : '-'}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
