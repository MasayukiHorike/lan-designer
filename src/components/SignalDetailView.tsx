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
import {
  getEditableSignalPorts,
  listConnectorOptions,
  type ConnectorOption,
  type EditableSignalPort,
  type SignalEditableFields,
} from '../services/ReviewEditService';
import type { Direction, Signal } from '../types/schema';

const signalRepo = new SignalRepository();

interface SignalPortMutationInput {
  signalPortId?: string;
  ecuId: string;
  connectorId: string;
  direction: Direction;
  e2eEnabled: boolean;
  secocEnabled: boolean;
}

function SignalPortTable({
  signalId,
  projectId,
  onUpsertPort,
  onRemovePort,
}: {
  signalId: string;
  projectId: string;
  onUpsertPort: (port: SignalPortMutationInput) => Promise<void>;
  onRemovePort: (signalPortId: string, ecuId: string, connectorId: string) => Promise<void>;
}) {
  const [ports, setPorts] = useState<EditableSignalPort[]>([]);
  const [connectorOptions, setConnectorOptions] = useState<ConnectorOption[]>([]);
  const [newPort, setNewPort] = useState<{ connectorKey: string; direction: Direction }>({
    connectorKey: '',
    direction: 'P-Port',
  });

  const reload = async () => {
    const [p, options] = await Promise.all([
      getEditableSignalPorts(projectId, signalId),
      listConnectorOptions(projectId),
    ]);
    setPorts(p);
    setConnectorOptions(options);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalId, projectId]);

  const handleFieldChange = async (port: EditableSignalPort, patch: Partial<SignalPortMutationInput>) => {
    await onUpsertPort({
      signalPortId: port.signalPortId,
      ecuId: port.ecuId,
      connectorId: port.connectorId,
      direction: port.direction,
      e2eEnabled: port.e2eEnabled,
      secocEnabled: port.secocEnabled,
      ...patch,
    });
    await reload();
  };

  const handleRemove = async (port: EditableSignalPort) => {
    await onRemovePort(port.signalPortId, port.ecuId, port.connectorId);
    await reload();
  };

  const handleAdd = async () => {
    const option = connectorOptions.find((o) => `${o.ecuId}/${o.connectorId}` === newPort.connectorKey);
    if (!option) return;
    await onUpsertPort({
      ecuId: option.ecuId,
      connectorId: option.connectorId,
      direction: newPort.direction,
      e2eEnabled: false,
      secocEnabled: false,
    });
    setNewPort({ connectorKey: '', direction: 'P-Port' });
    await reload();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Port一覧（編集）</h3>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="py-1 pr-2">ECU/コネクター</th>
            <th className="py-1 pr-2">方向</th>
            <th className="py-1 pr-2">E2E</th>
            <th className="py-1 pr-2">SecOC</th>
            <th className="py-1 pr-2"></th>
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => (
            <tr key={p.signalPortId} className="border-t border-slate-100">
              <td className="py-1 pr-2">
                {p.ecuName}_{p.ecuVariantNo}/{p.connectorName}
              </td>
              <td className="py-1 pr-2">
                <select
                  value={p.direction}
                  onChange={(e) => handleFieldChange(p, { direction: e.target.value as Direction })}
                  className="rounded border border-slate-300 px-1 py-0.5"
                >
                  <option value="P-Port">P-Port(T)</option>
                  <option value="R-Port">R-Port(R)</option>
                </select>
              </td>
              <td className="py-1 pr-2">
                <input
                  type="checkbox"
                  checked={p.e2eEnabled}
                  onChange={(e) => handleFieldChange(p, { e2eEnabled: e.target.checked })}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  type="checkbox"
                  checked={p.secocEnabled}
                  onChange={(e) => handleFieldChange(p, { secocEnabled: e.target.checked })}
                />
              </td>
              <td className="py-1 pr-2">
                <button type="button" onClick={() => handleRemove(p)} className="text-red-600 hover:underline">
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={newPort.connectorKey}
          onChange={(e) => setNewPort({ ...newPort, connectorKey: e.target.value })}
          className="rounded border border-slate-300 px-1 py-0.5 text-xs"
        >
          <option value="">ECU/コネクターを選択 ▼</option>
          {connectorOptions.map((o) => (
            <option key={`${o.ecuId}/${o.connectorId}`} value={`${o.ecuId}/${o.connectorId}`}>
              {o.ecuName}_{o.ecuVariantNo}/{o.connectorName}
            </option>
          ))}
        </select>
        <select
          value={newPort.direction}
          onChange={(e) => setNewPort({ ...newPort, direction: e.target.value as Direction })}
          className="rounded border border-slate-300 px-1 py-0.5 text-xs"
        >
          <option value="P-Port">P-Port(T)</option>
          <option value="R-Port">R-Port(R)</option>
        </select>
        <button
          type="button"
          disabled={!newPort.connectorKey}
          onClick={handleAdd}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-900 disabled:opacity-40"
        >
          追加
        </button>
      </div>
    </div>
  );
}

function SignalPropertyEditForm({
  signal,
  onSave,
  onCancel,
}: {
  signal: Signal;
  onSave: (patch: Partial<SignalEditableFields>) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<SignalEditableFields>({
    description: signal.description,
    bitPosition: signal.bitPosition,
    bitLength: signal.bitLength,
    endian: signal.endian,
    eventCondition: signal.eventCondition,
    unit: signal.unit,
    resolution: signal.resolution,
    initialValue: signal.initialValue,
    failValue: signal.failValue,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">プロパティ編集</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          説明
          <input
            type="text"
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          ビット位置
          <input
            type="number"
            value={values.bitPosition}
            onChange={(e) => setValues({ ...values, bitPosition: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          ビット長
          <input
            type="number"
            value={values.bitLength}
            onChange={(e) => setValues({ ...values, bitLength: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          エンディアン
          <select
            value={values.endian}
            onChange={(e) => setValues({ ...values, endian: e.target.value as SignalEditableFields['endian'] })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="Motorola">Motorola</option>
            <option value="Intel">Intel</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          イベント条件
          <input
            type="text"
            value={values.eventCondition}
            onChange={(e) => setValues({ ...values, eventCondition: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          単位
          <input
            type="text"
            value={values.unit}
            onChange={(e) => setValues({ ...values, unit: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          分解能
          <input
            type="number"
            value={values.resolution}
            onChange={(e) => setValues({ ...values, resolution: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          初期値
          <input
            type="number"
            value={values.initialValue}
            onChange={(e) => setValues({ ...values, initialValue: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          フェール値
          <input
            type="number"
            value={values.failValue}
            onChange={(e) => setValues({ ...values, failValue: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

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
  editable?: boolean;
  onSaveProperties?: (patch: Partial<SignalEditableFields>) => Promise<void>;
  onUpsertPort?: (port: SignalPortMutationInput) => Promise<void>;
  onRemovePort?: (signalPortId: string, ecuId: string, connectorId: string) => Promise<void>;
}

export function SignalDetailView({
  signalId,
  headerExtra,
  editable,
  onSaveProperties,
  onUpsertPort,
  onRemovePort,
}: Props) {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [previous, setPrevious] = useState<Signal | null>(null);
  const [ports, setPorts] = useState<{ label: string; direction: 'T' | 'R' }[]>([]);
  const [issues, setIssues] = useState<ElementIssues>({ errors: [], warnings: [] });
  const [diffMode, setDiffMode] = useState(false);
  const [editingProperties, setEditingProperties] = useState(false);

  const load = async () => {
    const s = await signalRepo.findById(signalId);
    if (!s) return;
    const [prev, p, iss] = await Promise.all([
      getPreviousSignalVersion(s),
      getSignalPorts(s.projectId, s._id),
      getElementIssues(s.name, s.applicationId),
    ]);
    setSignal(s);
    setPrevious(prev);
    setPorts(p);
    setIssues(iss);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalId]);

  if (!signal) {
    return <p className="text-slate-400">読み込み中...</p>;
  }

  // 呼び出し元(P22)がエラー表示を担当するため、失敗時はここでは何もしない（フォームは開いたまま維持）
  const handleSaveProperties = async (patch: Partial<SignalEditableFields>) => {
    if (!onSaveProperties) return;
    try {
      await onSaveProperties(patch);
    } catch {
      return;
    }
    setEditingProperties(false);
    await load();
  };

  const handleUpsertPort = async (port: SignalPortMutationInput) => {
    if (!onUpsertPort) return;
    try {
      await onUpsertPort(port);
    } catch {
      return;
    }
    await load();
  };

  const handleRemovePort = async (signalPortId: string, ecuId: string, connectorId: string) => {
    if (!onRemovePort) return;
    try {
      await onRemovePort(signalPortId, ecuId, connectorId);
    } catch {
      return;
    }
    await load();
  };

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
          {editable && onSaveProperties && !editingProperties && (
            <button
              type="button"
              onClick={() => setEditingProperties(true)}
              className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
            >
              編集
            </button>
          )}
          {headerExtra}
        </div>
      </div>

      {!previous && (
        <p className="text-xs text-slate-400">初版のため比較対象となる直前バージョンがありません（変化点表示は無効）。</p>
      )}

      {editingProperties && onSaveProperties ? (
        <SignalPropertyEditForm signal={signal} onSave={handleSaveProperties} onCancel={() => setEditingProperties(false)} />
      ) : (
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
      )}

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

      {editable && onUpsertPort && onRemovePort && (
        <SignalPortTable
          signalId={signal._id}
          projectId={signal.projectId}
          onUpsertPort={handleUpsertPort}
          onRemovePort={handleRemovePort}
        />
      )}

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
