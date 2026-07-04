import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useRole } from '../../contexts/RoleContext';
import { ApplicationRepository } from '../../repositories/ApplicationRepository';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../utils/dateUtils';
import type { Application, Status } from '../../types/schema';

const applicationRepo = new ApplicationRepository();

const STATUS_OPTIONS: { value: Status | 'all'; label: string }[] = [
  { value: 'all', label: '全て' },
  { value: 'draft', label: '作成中' },
  { value: 'in_review_1st', label: '回覧中-一次' },
  { value: 'in_review_2nd', label: '回覧中-二次' },
  { value: 'approved', label: '承認済' },
  { value: 'published', label: '公開済' },
  { value: 'rejected', label: '却下' },
  { value: 'withdrawn', label: '引き戻し済' },
];

export function P20_Applications() {
  const { project } = useProject();
  const { role } = useRole();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [showMine, setShowMine] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');

  useEffect(() => {
    if (!project) return;
    applicationRepo.findByProjectId(project._id).then(setApplications);
  }, [project]);

  const filtered = applications
    .filter((a) => !showMine || a.applicantId === role)
    .filter((a) => statusFilter === 'all' || a.status === statusFilter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">申請書管理</h1>
          <p className="text-sm text-slate-500">通信データ・GW例外指定Excelの申請・承認フローを管理します。</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/applications/new')}
          className="flex items-center gap-2 rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
        >
          <Plus size={16} />
          新規作成
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex overflow-hidden rounded border border-slate-300">
          <button
            type="button"
            onClick={() => setShowMine(true)}
            className={`px-3 py-1.5 text-sm ${showMine ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
          >
            自分の申請書
          </button>
          <button
            type="button"
            onClick={() => setShowMine(false)}
            className={`px-3 py-1.5 text-sm ${!showMine ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
          >
            ALL表示
          </button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="px-4 py-2">申請書番号</th>
              <th className="px-4 py-2">申請ECU名</th>
              <th className="px-4 py-2">件名</th>
              <th className="px-4 py-2">申請者</th>
              <th className="px-4 py-2">ステータス</th>
              <th className="px-4 py-2">更新日時</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr
                key={app._id}
                onClick={() => navigate(`/applications/${app._id.split('/')[1]}`)}
                className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-2 font-medium">{app.applicationNo}</td>
                <td className="px-4 py-2">{app.applicantEcuName}</td>
                <td className="px-4 py-2">{app.title || '(件名未設定)'}</td>
                <td className="px-4 py-2">{app.applicantId}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-4 py-2 text-slate-500">{formatDateTime(app.updatedAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  該当する申請書がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
