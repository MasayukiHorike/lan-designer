import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useRole } from '../../contexts/RoleContext';
import { SnapshotRepository } from '../../repositories/SnapshotRepository';
import { ChangelogRepository } from '../../repositories/ChangelogRepository';
import { confirmSnapshot, hasApprovedData } from '../../services/SnapshotService';
import { PromptDialog } from '../../components/PromptDialog';
import { formatDateTime } from '../../utils/dateUtils';
import type { Snapshot } from '../../types/schema';

const snapshotRepo = new SnapshotRepository();
const changelogRepo = new ChangelogRepository();

function openStandalone(path: string) {
  window.open(`${window.location.pathname}#${path}`, '_blank', 'noopener');
}

interface Row {
  snapshot: Snapshot;
  added: number;
  modified: number;
  deleted: number;
}

export function P50_Snapshots() {
  const { project } = useProject();
  const { role } = useRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [canConfirm, setCanConfirm] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const reload = async () => {
    if (!project) return;
    const snapshots = await snapshotRepo.findByProjectId(project._id);
    const withCounts = await Promise.all(
      snapshots.map(async (snapshot) => {
        const changelog = await changelogRepo.findBySnapshotId(project._id, snapshot._id);
        const changes = changelog?.changes ?? [];
        return {
          snapshot,
          added: changes.filter((c) => c.type === 'added').length,
          modified: changes.filter((c) => c.type === 'modified').length,
          deleted: changes.filter((c) => c.type === 'deleted').length,
        };
      }),
    );
    setRows(withCounts);
    setCanConfirm(await hasApprovedData(project._id));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const handleConfirm = async (values: Record<string, string>) => {
    if (!project || !role) return;
    setConfirming(true);
    try {
      await confirmSnapshot(project._id, values.snapshotName, role);
      setShowDialog(false);
      await reload();
    } finally {
      setConfirming(false);
    }
  };

  const isLanDesigner = role === 'LAN設計者';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">公開バージョン一覧</h1>
        <p className="text-sm text-slate-500">断面確定によりapproved状態のデータをpublishedとして公開します。</p>
      </div>

      {isLanDesigner && (
        <div>
          <button
            type="button"
            disabled={!canConfirm || confirming}
            onClick={() => setShowDialog(true)}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
          >
            断面確定
          </button>
          {!canConfirm && <p className="mt-1 text-xs text-slate-400">承認済み（approved）のデータが無いため活性化されません。</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="px-4 py-2">No</th>
              <th className="px-4 py-2">断面名</th>
              <th className="px-4 py-2">確定日時</th>
              <th className="px-4 py-2">確定者</th>
              <th className="px-4 py-2">変更件数</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ snapshot, added, modified, deleted }) => (
              <tr key={snapshot._id} className="border-b border-slate-100 hover:bg-slate-50">
                <td
                  onClick={() => openStandalone(`/frame-signal?snapshot=${snapshot._id.split('/')[1]}`)}
                  className="cursor-pointer px-4 py-2"
                >
                  {snapshot.sequenceNo}
                </td>
                <td
                  onClick={() => openStandalone(`/frame-signal?snapshot=${snapshot._id.split('/')[1]}`)}
                  className="cursor-pointer px-4 py-2 font-medium"
                >
                  {snapshot.snapshotName}
                </td>
                <td className="px-4 py-2">{formatDateTime(snapshot.confirmedAt)}</td>
                <td className="px-4 py-2">{snapshot.confirmedBy}</td>
                <td className="px-4 py-2">
                  追{added} 変{modified} 削{deleted}
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => navigate('/changelogs')}
                    className="text-blue-600 hover:underline"
                  >
                    変更履歴
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  断面はまだ確定されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showDialog && (
        <PromptDialog
          title="断面確定"
          fields={[{ key: 'snapshotName', label: '断面名（例：v1.5）' }]}
          onSubmit={handleConfirm}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
