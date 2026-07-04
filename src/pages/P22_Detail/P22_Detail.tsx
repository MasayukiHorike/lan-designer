import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useRole } from '../../contexts/RoleContext';
import { ApplicationRepository } from '../../repositories/ApplicationRepository';
import { ApprovalRepository } from '../../repositories/ApprovalRepository';
import { EcuRepository } from '../../repositories/EcuRepository';
import { FrameRepository } from '../../repositories/FrameRepository';
import {
  advanceToNextApprover,
  buildCommunicationDataCheckContext,
  decideCurrentApproval,
  flattenFirstStage,
  flattenSecondStage,
  getCurrentApprovalSlot,
  isCurrentSlotDecided,
  withdrawApplication,
} from '../../services/ApplicationService';
import { parseCommunicationDataWorkbook } from '../../services/excel/CommunicationDataImportService';
import {
  editFrameProperties,
  editSignalProperties,
  reimportCommunicationDataFile,
  reimportGwExceptionFile,
  removeFramePort,
  removeSignalPort,
  upsertFramePort,
  upsertSignalPort,
  refreshLevel2,
  type FrameEditableFields,
  type SignalEditableFields,
} from '../../services/ReviewEditService';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorList } from '../../components/ErrorList/ErrorList';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Level2Results } from '../../components/Level2Results';
import { FrameDetailView } from '../../components/FrameDetailView';
import { SignalDetailView } from '../../components/SignalDetailView';
import { formatDateTime } from '../../utils/dateUtils';
import type { Application, Approval, Frame } from '../../types/schema';
import type { ElementCommand, ParsedFrameGroup } from '../../types/excel';

const applicationRepo = new ApplicationRepository();
const approvalRepo = new ApprovalRepository();
const ecuRepo = new EcuRepository();
const frameRepo = new FrameRepository();

const EDIT_METHOD_LABELS: Record<'excel' | 'manual', string> = {
  excel: 'Excel再インポート',
  manual: '画面直接編集',
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const COMMAND_COLORS: Record<ElementCommand, string> = {
  追加: 'text-emerald-600',
  '変更(verup)': 'text-blue-600',
  削除: 'text-red-600',
  '': 'text-slate-400',
};

export function P22_Detail() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();
  const { role } = useRole();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<Approval[]>([]);
  const [frameGroupsByEcu, setFrameGroupsByEcu] = useState<Record<string, ParsedFrameGroup[]>>({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ownFrames, setOwnFrames] = useState<Frame[]>([]);
  const [expandedFrameId, setExpandedFrameId] = useState<string | null>(null);
  const [viewSignalId, setViewSignalId] = useState<string | null>(null);

  const reload = async () => {
    if (!id) return;
    const app = await applicationRepo.findById(`applications/${id}`);
    setApplication(app ?? null);
    if (app) {
      const history = await approvalRepo.findByApplicationId(app._id);
      setApprovalHistory(history);
      const frames = await frameRepo.findByApplicationId(app._id);
      setOwnFrames(frames.filter((f) => !f.deleted));
    }
    if (app && project) {
      const publishedEcus = await ecuRepo.findPublished(project._id);
      const entries: Record<string, ParsedFrameGroup[]> = {};
      for (const f of app.importFiles) {
        if (!f.communicationDataFileBlob) continue;
        const parsed = await parseCommunicationDataWorkbook(f.communicationDataFileBlob, publishedEcus);
        entries[f.ecuName] = parsed.frameGroups;
      }
      setFrameGroupsByEcu(entries);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, project]);

  if (!application) {
    return <p className="text-slate-400">読み込み中...</p>;
  }

  const canEdit = role === application.applicantId && application.status === 'draft';
  const canWithdraw =
    role === application.applicantId &&
    (application.status === 'in_review_1st' || application.status === 'in_review_2nd');

  const slot = getCurrentApprovalSlot(application);
  const decided = isCurrentSlotDecided(application);
  const requiredRole = slot?.stage === '1st' ? 'ECU承認者' : 'LAN承認者';
  const canActOnSlot = !!slot && role === requiredRole;
  const canReviewEdit = canActOnSlot && slot?.stage === '2nd';

  const nextLabel = (() => {
    if (application.status === 'in_review_1st') {
      const total = flattenFirstStage(application).length;
      return application.firstStageTurn + 1 >= total ? '二次承認へ回覧' : '次の承認者へ回覧';
    }
    if (application.status === 'in_review_2nd') {
      const total = flattenSecondStage(application).length;
      return application.secondStageTurn + 1 >= total ? '承認完了へ回覧' : '次の承認者へ回覧';
    }
    return '回覧';
  })();

  const findLatestApproval = (stage: '1st' | '2nd', ecuName: string, email: string) =>
    approvalHistory
      .filter((a) => a.stage === stage && a.ecuName === ecuName && a.approverId === email)
      .sort((a, b) => b.actionAt.localeCompare(a.actionAt))[0];

  const handleWithdraw = async () => {
    if (!role) return;
    setError(null);
    try {
      await withdrawApplication(application, role);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '引き戻しに失敗しました');
    }
  };

  const handleDecide = async (decision: 'approved' | 'rejected') => {
    if (!role) return;
    setError(null);
    try {
      await decideCurrentApproval(application, decision, comment, role);
      setComment('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '承認操作に失敗しました');
    }
  };

  const handleAdvance = async () => {
    if (!role) return;
    setError(null);
    try {
      await advanceToNextApprover(application, role);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '回覧に失敗しました');
    }
  };

  const handleSaveFrameProperties = async (frameId: string, patch: Partial<FrameEditableFields>) => {
    if (!role) return;
    setError(null);
    try {
      const updated = await editFrameProperties(application, frameId, patch, role, role);
      setApplication(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Frameプロパティの編集に失敗しました');
      throw e;
    }
  };

  const handleSaveSignalProperties = async (signalId: string, patch: Partial<SignalEditableFields>) => {
    if (!role) return;
    setError(null);
    try {
      const updated = await editSignalProperties(application, signalId, patch, role, role);
      setApplication(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signalプロパティの編集に失敗しました');
      throw e;
    }
  };

  const handleUpsertFramePort = async (
    frameId: string,
    port: {
      framePortId?: string;
      ecuId: string;
      connectorId: string;
      direction: 'P-Port' | 'R-Port';
      e2eEnabled: boolean;
      secocEnabled: boolean;
      timeoutMs: number | null;
    },
  ) => {
    if (!role) return;
    setError(null);
    try {
      await upsertFramePort(
        port.ecuId,
        port.connectorId,
        { framePortId: port.framePortId, frameId, direction: port.direction, e2eEnabled: port.e2eEnabled, secocEnabled: port.secocEnabled, timeoutMs: port.timeoutMs },
        { projectId: application.projectId, applicationId: application._id, status: application.status, actorId: role },
      );
      const updated = await refreshLevel2(application, role);
      setApplication(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'FramePortの編集に失敗しました');
      throw e;
    }
  };

  const handleRemoveFramePort = async (framePortId: string, ecuId: string, connectorId: string, frameId: string) => {
    if (!role) return;
    setError(null);
    try {
      await removeFramePort(ecuId, connectorId, framePortId, frameId, {
        projectId: application.projectId,
        applicationId: application._id,
        status: application.status,
        actorId: role,
      });
      const updated = await refreshLevel2(application, role);
      setApplication(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'FramePortの削除に失敗しました');
      throw e;
    }
  };

  const handleUpsertSignalPort = async (
    signalId: string,
    port: {
      signalPortId?: string;
      ecuId: string;
      connectorId: string;
      direction: 'P-Port' | 'R-Port';
      e2eEnabled: boolean;
      secocEnabled: boolean;
    },
  ) => {
    if (!role) return;
    setError(null);
    try {
      await upsertSignalPort(
        port.ecuId,
        port.connectorId,
        { signalPortId: port.signalPortId, signalId, direction: port.direction, e2eEnabled: port.e2eEnabled, secocEnabled: port.secocEnabled },
        role,
      );
      const updated = await refreshLevel2(application, role);
      setApplication(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SignalPortの編集に失敗しました');
      throw e;
    }
  };

  const handleRemoveSignalPort = async (signalPortId: string, ecuId: string, connectorId: string) => {
    if (!role) return;
    setError(null);
    try {
      await removeSignalPort(ecuId, connectorId, signalPortId, role);
      const updated = await refreshLevel2(application, role);
      setApplication(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SignalPortの削除に失敗しました');
      throw e;
    }
  };

  const handleReimportCommunicationData = async (ecuName: string, file: File) => {
    if (!role) return;
    setError(null);
    try {
      const context = await buildCommunicationDataCheckContext(application.projectId);
      await reimportCommunicationDataFile(application, ecuName, file, context, role, role);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信データExcelの再インポートに失敗しました');
    }
  };

  const handleReimportGwException = async (ecuName: string, file: File) => {
    if (!role) return;
    setError(null);
    try {
      const context = await buildCommunicationDataCheckContext(application.projectId);
      await reimportGwExceptionFile(application, ecuName, file, context, role, role);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GW例外指定Excelの再インポートに失敗しました');
    }
  };

  const firstStageSlots = flattenFirstStage(application);
  const secondStageSlots = flattenSecondStage(application);

  const slotStatusLabel = (index: number, turn: number, approvedNow: boolean) => {
    if (index < turn || (index === turn && approvedNow)) return '承認済';
    if (index === turn) return '対応中（承認待ち）';
    return '順番待ち';
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">{application.applicationNo}</h1>
          <StatusBadge status={application.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">{application.title || '(件名未設定)'}</p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">申請基本情報</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-y-1">
          <dt className="text-slate-500">申請ECU</dt>
          <dd>{application.applicantEcuName}</dd>
          <dt className="text-slate-500">申請者</dt>
          <dd>{application.applicantId}</dd>
          <dt className="text-slate-500">変更概要</dt>
          <dd>{application.description || '-'}</dd>
          <dt className="text-slate-500">コメント</dt>
          <dd>{application.comment || '-'}</dd>
          <dt className="text-slate-500">更新日時</dt>
          <dd>{formatDateTime(application.updatedAt)}</dd>
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">登録ファイル一覧</h2>
        {application.importFiles.length === 0 && <p className="text-slate-400">登録ファイルはありません</p>}
        {application.importFiles.map((f) => (
          <div key={f.ecuName} className="mb-2">
            <p className="font-medium">{f.ecuName}</p>
            {f.communicationDataFileBlob && (
              <button
                type="button"
                onClick={() => downloadBlob(f.communicationDataFileBlob!, `${f.ecuName}_通信データ.xlsx`)}
                className="mr-3 text-blue-600 hover:underline"
              >
                通信データExcel [DL]
              </button>
            )}
            {f.gwExceptionFileBlob && (
              <button
                type="button"
                onClick={() => downloadBlob(f.gwExceptionFileBlob!, `${f.ecuName}_GW例外指定.xlsx`)}
                className="text-blue-600 hover:underline"
              >
                GW例外指定Excel [DL]
              </button>
            )}
          </div>
        ))}
      </div>

      {canReviewEdit && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Excel再インポート（LAN承認者・二次審査中のみ）</h2>
          <p className="mb-2 text-xs text-slate-500">
            修正版のExcelを選択すると、既存の登録ファイルを差し替えてLevel1/Level2チェックを再実行します。
          </p>
          {application.importFiles.map((f) => (
            <div key={f.ecuName} className="mb-2 flex flex-wrap items-center gap-3">
              <span className="w-32 font-medium">{f.ecuName}</span>
              {f.communicationDataFileBlob !== undefined && (
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  通信データ再取込：
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handleReimportCommunicationData(f.ecuName, file);
                    }}
                  />
                </label>
              )}
              {f.gwExceptionFileBlob !== undefined && (
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  GW例外指定再取込：
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handleReimportGwException(f.ecuName, file);
                    }}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {canReviewEdit && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">登録要素の編集（LAN承認者・二次審査中のみ）</h2>
          <p className="mb-2 text-xs text-slate-500">
            この申請書が持ち込んだFrame/Signalのみ編集できます。Frame名をクリックすると詳細・編集フォームを展開します。
          </p>
          {ownFrames.length === 0 && <p className="text-slate-400">対象のFrameはありません</p>}
          <ul className="flex flex-col gap-1">
            {ownFrames.map((f) => (
              <li key={f._id}>
                <button
                  type="button"
                  onClick={() => {
                    setViewSignalId(null);
                    setExpandedFrameId(expandedFrameId === f._id ? null : f._id);
                  }}
                  className="text-blue-600 hover:underline"
                >
                  {f.name}（{f.variantNo}）
                </button>
              </li>
            ))}
          </ul>
          {expandedFrameId && (
            <div className="mt-3 rounded border border-slate-200 bg-white p-3">
              {viewSignalId ? (
                <>
                  <button
                    type="button"
                    onClick={() => setViewSignalId(null)}
                    className="mb-2 text-xs text-blue-600 hover:underline"
                  >
                    ◀ Frameに戻る
                  </button>
                  <SignalDetailView
                    signalId={viewSignalId}
                    editable
                    onSaveProperties={(patch) => handleSaveSignalProperties(viewSignalId, patch)}
                    onUpsertPort={(port) => handleUpsertSignalPort(viewSignalId, port)}
                    onRemovePort={(signalPortId, ecuId, connectorId) =>
                      handleRemoveSignalPort(signalPortId, ecuId, connectorId)
                    }
                  />
                </>
              ) : (
                <FrameDetailView
                  frameId={expandedFrameId}
                  editable
                  onSaveProperties={(patch) => handleSaveFrameProperties(expandedFrameId, patch)}
                  onUpsertPort={(port) => handleUpsertFramePort(expandedFrameId, port)}
                  onRemovePort={(framePortId, ecuId, connectorId) =>
                    handleRemoveFramePort(framePortId, ecuId, connectorId, expandedFrameId)
                  }
                  onSelectSignal={(signalId) => setViewSignalId(signalId)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {Object.keys(frameGroupsByEcu).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">インポート内容確認（簡易変化点）</h2>
          <p className="mb-2 text-xs text-slate-400">
            コマンド種別で色分け表示（緑：追加 / 青：変更 / 赤：削除）。断面差分との比較はPhase1-4以降で対応予定です。
          </p>
          {Object.entries(frameGroupsByEcu).map(([ecuName, groups]) => (
            <div key={ecuName} className="mb-3">
              <p className="font-medium">{ecuName}</p>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="py-1 pr-2">種別</th>
                    <th className="py-1 pr-2">コマンド</th>
                    <th className="py-1 pr-2">名前</th>
                    <th className="py-1 pr-2">バリ</th>
                    <th className="py-1 pr-2">バージョン</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={`${g.frame.name}-${g.frame.variantNo}`}>
                      <tr className="border-t border-slate-100">
                        <td className="py-1 pr-2">F</td>
                        <td className={`py-1 pr-2 font-medium ${COMMAND_COLORS[g.frame.elementCommand]}`}>
                          {g.frame.elementCommand}
                        </td>
                        <td className="py-1 pr-2">{g.frame.name}</td>
                        <td className="py-1 pr-2">{g.frame.variantNo}</td>
                        <td className="py-1 pr-2">{g.frame.versionNo}</td>
                      </tr>
                      {g.signals.map((s) => (
                        <tr key={`${s.name}-${s.variantNo}`} className="border-t border-slate-50 text-slate-600">
                          <td className="py-1 pr-2 pl-3">S</td>
                          <td className={`py-1 pr-2 font-medium ${COMMAND_COLORS[s.elementCommand]}`}>
                            {s.elementCommand}
                          </td>
                          <td className="py-1 pr-2">{s.name}</td>
                          <td className="py-1 pr-2">{s.variantNo}</td>
                          <td className="py-1 pr-2">{s.versionNo}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">チェック結果</h2>
        <p>Level1：{application.checkResults.level1.status === 'ok' ? '○ エラーなし' : '✗ エラーあり'}</p>
        <ErrorList result={application.checkResults.level1} />
        <div className="mt-2">
          <Level2Results level2={application.checkResults.level2} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">ステータス・承認状況（順番制）</h2>
        <p className="mb-2">
          現在：<StatusBadge status={application.status} />
        </p>
        <p className="font-medium">一次承認</p>
        {application.approvers.firstStage.map((s) => (
          <div key={s.ecuName} className="ml-2 mb-1">
            <p className="text-slate-600">{s.ecuName}</p>
            {s.approvers.map((a) => {
              const index = firstStageSlots.findIndex((sl) => sl.ecuName === s.ecuName && sl.email === a.email);
              const label =
                application.status === 'in_review_1st'
                  ? slotStatusLabel(index, application.firstStageTurn, a.status === 'approved')
                  : a.status === 'approved'
                    ? '承認済'
                    : a.status === 'rejected'
                      ? '差し戻し済'
                      : '対応前';
              const record = findLatestApproval('1st', s.ecuName, a.email);
              return (
                <div key={a.email} className="ml-2 text-slate-500">
                  <p>
                    {a.email}：{label}
                    {a.actionAt ? `（${formatDateTime(a.actionAt)}）` : ''}
                  </p>
                  {record?.comment && <p className="ml-2 text-xs text-slate-400">コメント：{record.comment}</p>}
                </div>
              );
            })}
          </div>
        ))}
        <p className="mt-2 font-medium">二次承認</p>
        {application.approvers.secondStage.map((a) => {
          const index = secondStageSlots.findIndex((sl) => sl.email === a.email);
          const label =
            application.status === 'in_review_2nd'
              ? slotStatusLabel(index, application.secondStageTurn, a.status === 'approved')
              : a.status === 'approved'
                ? '承認済'
                : a.status === 'rejected'
                  ? '却下済'
                  : '対応前';
          const record = findLatestApproval('2nd', application.applicantEcuName, a.email);
          return (
            <div key={a.email} className="ml-2 text-slate-500">
              <p>
                {a.email}：{label}
                {a.actionAt ? `（${formatDateTime(a.actionAt)}）` : ''}
              </p>
              {record?.comment && <p className="ml-2 text-xs text-slate-400">コメント：{record.comment}</p>}
            </div>
          );
        })}
      </div>

      {canActOnSlot && !decided && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            承認操作（{slot?.stage === '1st' ? 'ECU承認者・一次' : 'LAN承認者・二次'}：{slot?.email}）
          </h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="コメント（差し戻し・却下時は必須）"
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleDecide('approved')}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
            >
              承認
            </button>
            <button
              type="button"
              onClick={() => handleDecide('rejected')}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            >
              {slot?.stage === '1st' ? '差し戻し' : '却下'}
            </button>
          </div>
        </div>
      )}

      {canActOnSlot && decided && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="mb-2">承認済みです。回覧すると次の承認者（または次のステージ）に進みます。</p>
          <button
            type="button"
            onClick={handleAdvance}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
          >
            {nextLabel}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">編集履歴</h2>
        {application.editHistories.length === 0 && (
          <p className="text-slate-400">Excel再インポート・画面直接編集の履歴はありません</p>
        )}
        <ul className="flex flex-col gap-2">
          {[...application.editHistories]
            .sort((a, b) => b.editedAt.localeCompare(a.editedAt))
            .map((entry, i) => (
              <li key={i} className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                <p className="text-slate-600">
                  {formatDateTime(entry.editedAt)}｜{entry.editedBy}｜
                  <span
                    className={
                      entry.method === 'excel'
                        ? 'text-blue-600 font-medium'
                        : 'text-emerald-600 font-medium'
                    }
                  >
                    {EDIT_METHOD_LABELS[entry.method]}
                  </span>
                </p>
                <ul className="ml-3 text-xs text-slate-500">
                  {(entry.changes as { field: string; before: unknown; after: unknown }[]).map((c, j) => (
                    <li key={j}>
                      {c.field}：{JSON.stringify(c.before)} → {JSON.stringify(c.after)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
      </div>

      <div className="flex gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={() => navigate(`/applications/${id}/edit`)}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
          >
            編集を続ける
          </button>
        )}
        {canWithdraw && (
          <button
            type="button"
            onClick={handleWithdraw}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            引き戻し
          </button>
        )}
      </div>
    </div>
  );
}
