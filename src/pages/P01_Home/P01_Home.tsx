import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../../contexts/RoleContext';
import { useProject } from '../../contexts/ProjectContext';
import { ApplicationRepository } from '../../repositories/ApplicationRepository';
import { SnapshotRepository } from '../../repositories/SnapshotRepository';
import { getCurrentApprovalSlot } from '../../services/ApplicationService';
import { STATUS_LABELS } from '../../components/StatusBadge';
import { formatDateTime } from '../../utils/dateUtils';
import type { Application, Snapshot, Status } from '../../types/schema';

const applicationRepo = new ApplicationRepository();
const snapshotRepo = new SnapshotRepository();

const SUMMARY_STATUSES: Status[] = ['draft', 'in_review_1st', 'in_review_2nd', 'approved', 'published', 'rejected', 'withdrawn'];

export function P01_Home() {
  const { role } = useRole();
  const { project } = useProject();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!project) return;
    applicationRepo.findByProjectId(project._id).then(setApplications);
    snapshotRepo.findLatest(project._id).then((s) => setLatestSnapshot(s ?? null));
  }, [project]);

  const statusCounts = SUMMARY_STATUSES.map((status) => ({
    status,
    count: applications.filter((a) => a.status === status).length,
  }));

  const requiredRoleForApp = (app: Application): 'ECU承認者' | 'LAN承認者' | null => {
    const slot = getCurrentApprovalSlot(app);
    if (!slot) return null;
    return slot.stage === '1st' ? 'ECU承認者' : 'LAN承認者';
  };

  const pendingForRole = applications.filter((a) => role && requiredRoleForApp(a) === role);

  const notices: string[] = [];
  if (pendingForRole.length > 0) {
    notices.push(`あなた（${role}）が対応可能な申請書が ${pendingForRole.length} 件あります。`);
  }
  const errorDrafts = applications.filter((a) => a.status === 'draft' && a.checkResults.level1.status === 'error');
  if (errorDrafts.length > 0) {
    notices.push(`Level1チェックでエラーが未解消の作成中申請書が ${errorDrafts.length} 件あります。`);
  }
  if (latestSnapshot) {
    notices.push(`最新の公開断面は「${latestSnapshot.snapshotName}」です（${formatDateTime(latestSnapshot.confirmedAt)}）。`);
  }
  if (notices.length === 0) {
    notices.push('現在、特に対応が必要な項目はありません。');
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ホーム</h1>
        <p className="text-sm text-slate-500">
          {project?.name} / ログイン中ロール：{role}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">申請書サマリー</h2>
          <button
            type="button"
            onClick={() => navigate('/applications')}
            className="mt-2 flex w-full flex-col gap-1 text-left text-xs text-slate-600"
          >
            {statusCounts.map(({ status, count }) => (
              <span key={status} className="flex justify-between">
                <span>{STATUS_LABELS[status]}</span>
                <span className="font-semibold text-slate-800">{count}</span>
              </span>
            ))}
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">承認待ち件数</h2>
          {role === 'ECU承認者' || role === 'LAN承認者' ? (
            <button
              type="button"
              onClick={() => navigate('/applications')}
              className="mt-2 text-left"
            >
              <p className="text-3xl font-bold text-slate-800">{pendingForRole.length}</p>
              <p className="text-xs text-slate-400">あなた（{role}）が対応可能な申請書</p>
            </button>
          ) : (
            <p className="mt-2 text-xs text-slate-400">承認者ロールでログインすると表示されます</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">直近断面情報</h2>
          {latestSnapshot ? (
            <button
              type="button"
              onClick={() => navigate('/snapshots')}
              className="mt-2 text-left"
            >
              <p className="font-medium text-slate-800">{latestSnapshot.snapshotName}</p>
              <p className="text-xs text-slate-400">確定日時：{formatDateTime(latestSnapshot.confirmedAt)}</p>
            </button>
          ) : (
            <p className="mt-2 text-xs text-slate-400">まだ断面が確定されていません</p>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">お知らせ</h2>
        <ul className="flex flex-col gap-1 text-sm text-slate-600">
          {notices.map((n, i) => (
            <li key={i}>・{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
