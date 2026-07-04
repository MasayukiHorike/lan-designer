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
import {
  getEditableFramePorts,
  listConnectorOptions,
  type ConnectorOption,
  type EditableFramePort,
  type FrameEditableFields,
} from '../services/ReviewEditService';
import { BitMatrix } from './BitMatrix';
import { formatDateTime } from '../utils/dateUtils';
import type { Direction, Frame, Signal } from '../types/schema';

const frameRepo = new FrameRepository();
const signalRepo = new SignalRepository();

interface PortMutationInput {
  framePortId?: string;
  ecuId: string;
  connectorId: string;
  direction: Direction;
  e2eEnabled: boolean;
  secocEnabled: boolean;
  timeoutMs: number | null;
}

function FramePortTable({
  frameId,
  projectId,
  onUpsertPort,
  onRemovePort,
}: {
  frameId: string;
  projectId: string;
  onUpsertPort: (port: PortMutationInput) => Promise<void>;
  onRemovePort: (framePortId: string, ecuId: string, connectorId: string) => Promise<void>;
}) {
  const [ports, setPorts] = useState<EditableFramePort[]>([]);
  const [connectorOptions, setConnectorOptions] = useState<ConnectorOption[]>([]);
  const [newPort, setNewPort] = useState<{ connectorKey: string; direction: Direction }>({
    connectorKey: '',
    direction: 'P-Port',
  });

  const reload = async () => {
    const [p, options] = await Promise.all([
      getEditableFramePorts(projectId, frameId),
      listConnectorOptions(projectId),
    ]);
    setPorts(p);
    setConnectorOptions(options);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId, projectId]);

  const handleFieldChange = async (port: EditableFramePort, patch: Partial<PortMutationInput>) => {
    await onUpsertPort({
      framePortId: port.framePortId,
      ecuId: port.ecuId,
      connectorId: port.connectorId,
      direction: port.direction,
      e2eEnabled: port.e2eEnabled,
      secocEnabled: port.secocEnabled,
      timeoutMs: port.timeoutMs,
      ...patch,
    });
    await reload();
  };

  const handleRemove = async (port: EditableFramePort) => {
    await onRemovePort(port.framePortId, port.ecuId, port.connectorId);
    await reload();
  };

  const handleAdd = async () => {
    const option = connectorOptions.find(
      (o) => `${o.ecuId}/${o.connectorId}` === newPort.connectorKey,
    );
    if (!option) return;
    await onUpsertPort({
      ecuId: option.ecuId,
      connectorId: option.connectorId,
      direction: newPort.direction,
      e2eEnabled: false,
      secocEnabled: false,
      timeoutMs: null,
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
            <th className="py-1 pr-2">タイムアウト(ms)</th>
            <th className="py-1 pr-2"></th>
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => (
            <tr key={p.framePortId} className="border-t border-slate-100">
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
                <input
                  type="number"
                  value={p.timeoutMs ?? ''}
                  onChange={(e) =>
                    handleFieldChange(p, { timeoutMs: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  className="w-20 rounded border border-slate-300 px-1 py-0.5"
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

function FramePropertyEditForm({
  frame,
  onSave,
  onCancel,
}: {
  frame: Frame;
  onSave: (patch: Partial<FrameEditableFields>) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FrameEditableFields>({
    description: frame.description,
    protocol: frame.protocol,
    canId: frame.canId,
    dlc: frame.dlc,
    cycleTime: frame.cycleTime,
    powerSource: frame.powerSource,
    eventFlag: frame.eventFlag,
    e2e: frame.e2e,
    secoc: frame.secoc,
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
          CAN-ID
          <input
            type="text"
            value={values.canId}
            onChange={(e) => setValues({ ...values, canId: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          DLC
          <input
            type="number"
            value={values.dlc}
            onChange={(e) => setValues({ ...values, dlc: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          プロトコル
          <select
            value={values.protocol}
            onChange={(e) => setValues({ ...values, protocol: e.target.value as FrameEditableFields['protocol'] })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="CAN">CAN</option>
            <option value="CAN-FD">CAN-FD</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          周期(ms)
          <input
            type="number"
            value={values.cycleTime}
            onChange={(e) => setValues({ ...values, cycleTime: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          送信電源（カンマ区切り）
          <input
            type="text"
            value={values.powerSource.join(',')}
            onChange={(e) =>
              setValues({ ...values, powerSource: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
            }
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={values.eventFlag}
            onChange={(e) => setValues({ ...values, eventFlag: e.target.checked })}
          />
          イベントフラグ
        </label>
        <div />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={values.e2e.enabled}
            onChange={(e) => setValues({ ...values, e2e: { ...values.e2e, enabled: e.target.checked } })}
          />
          E2E有効
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          E2Eプロファイル
          <input
            type="text"
            value={values.e2e.profile}
            onChange={(e) => setValues({ ...values, e2e: { ...values.e2e, profile: e.target.value } })}
            className="rounded border border-slate-300 px-2 py-1"
            disabled={!values.e2e.enabled}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={values.secoc.enabled}
            onChange={(e) => setValues({ ...values, secoc: { ...values.secoc, enabled: e.target.checked } })}
          />
          SecOC有効
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          SecOC FV方式
          <select
            value={values.secoc.fvMethod}
            onChange={(e) =>
              setValues({
                ...values,
                secoc: { ...values.secoc, fvMethod: e.target.value as FrameEditableFields['secoc']['fvMethod'] },
              })
            }
            className="rounded border border-slate-300 px-2 py-1"
            disabled={!values.secoc.enabled}
          >
            <option value="truncatedFV">truncatedFV</option>
            <option value="fullFV">fullFV</option>
          </select>
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
  frameId: string;
  onSelectSignal?: (signalId: string) => void;
  headerExtra?: ReactNode;
  editable?: boolean;
  onSaveProperties?: (patch: Partial<FrameEditableFields>) => Promise<void>;
  onUpsertPort?: (port: PortMutationInput) => Promise<void>;
  onRemovePort?: (framePortId: string, ecuId: string, connectorId: string) => Promise<void>;
}

export function FrameDetailView({
  frameId,
  onSelectSignal,
  headerExtra,
  editable,
  onSaveProperties,
  onUpsertPort,
  onRemovePort,
}: Props) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [previousFrame, setPreviousFrame] = useState<Frame | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [txRx, setTxRx] = useState<{ label: string; direction: 'T' | 'R' }[]>([]);
  const [issues, setIssues] = useState<ElementIssues>({ errors: [], warnings: [] });
  const [diffMode, setDiffMode] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [editingProperties, setEditingProperties] = useState(false);

  const load = async () => {
    const f = await frameRepo.findById(frameId);
    if (!f) return;
    const [sigs, tr, prev, iss] = await Promise.all([
      signalRepo.findByFrameId(f._id),
      getFrameTxRxEcus(f.projectId, f._id),
      getPreviousFrameVersion(f),
      getElementIssues(f.name, f.applicationId),
    ]);
    setFrame(f);
    setSignals(sigs);
    setTxRx(tr);
    setPreviousFrame(prev);
    setIssues(iss);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId]);

  if (!frame) {
    return <p className="text-slate-400">読み込み中...</p>;
  }

  // 呼び出し元(P22)がエラー表示を担当するため、失敗時はここでは何もしない（フォームは開いたまま維持）
  const handleSaveProperties = async (patch: Partial<FrameEditableFields>) => {
    if (!onSaveProperties) return;
    try {
      await onSaveProperties(patch);
    } catch {
      return;
    }
    setEditingProperties(false);
    await load();
  };

  const handleUpsertPort = async (port: PortMutationInput) => {
    if (!onUpsertPort) return;
    try {
      await onUpsertPort(port);
    } catch {
      return;
    }
    await load();
  };

  const handleRemovePort = async (framePortId: string, ecuId: string, connectorId: string) => {
    if (!onRemovePort) return;
    try {
      await onRemovePort(framePortId, ecuId, connectorId);
    } catch {
      return;
    }
    await load();
  };

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

      {!previousFrame && (
        <p className="text-xs text-slate-400">初版のため比較対象となる直前バージョンがありません（変化点表示は無効）。</p>
      )}

      {editingProperties && onSaveProperties ? (
        <FramePropertyEditForm frame={frame} onSave={handleSaveProperties} onCancel={() => setEditingProperties(false)} />
      ) : (
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
      )}

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

      {editable && onUpsertPort && onRemovePort && (
        <FramePortTable
          frameId={frame._id}
          projectId={frame.projectId}
          onUpsertPort={handleUpsertPort}
          onRemovePort={handleRemovePort}
        />
      )}

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
