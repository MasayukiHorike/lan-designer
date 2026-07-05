import { useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useRole } from '../../contexts/RoleContext';
import { usePermission } from '../../hooks/usePermission';
import { createProject, deleteProject, resetProject } from '../../services/ProjectManagementService';
import { seedSampleData } from '../../services/SampleDataService';
import { PROJECT_THEME_COLORS, DEFAULT_PROJECT_THEME_COLOR } from '../../constants/projectTheme';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { Project } from '../../types/schema';

function ProjectDot({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function NameConfirmDialog({
  title,
  promptLabel,
  actionLabel,
  targetName,
  onConfirm,
  onCancel,
}: {
  title: string;
  promptLabel: string;
  actionLabel: string;
  targetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const matches = value === targetName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {promptLabel}「{targetName}」を入力してください。
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={!matches}
            onClick={onConfirm}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-40"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProjectForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (project: Project, seed: boolean) => void }) {
  const { role } = useRole();
  const [name, setName] = useState('');
  const [themeColor, setThemeColor] = useState(DEFAULT_PROJECT_THEME_COLOR);
  const [withSample, setWithSample] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!role || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject(name.trim(), themeColor, role);
      onCreated(project, withSample);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'プロジェクトの作成に失敗しました');
      setCreating(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">新規プロジェクト作成</h2>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <label className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
        プロジェクト名
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="mt-3">
        <p className="mb-1 text-xs text-slate-600">テーマカラー</p>
        <div className="flex flex-wrap gap-2">
          {PROJECT_THEME_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              title={c.label}
              onClick={() => setThemeColor(c.hex)}
              className={`h-7 w-7 rounded-full border-2 ${themeColor === c.hex ? 'border-slate-800' : 'border-transparent'}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={withSample} onChange={(e) => setWithSample(e.target.checked)} />
        サンプルデータで開始（物理構成・通信データ・GW例外指定を投入し、断面確定まで自動実行します）
      </label>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!name.trim() || creating}
          onClick={handleCreate}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
        >
          {creating ? '作成中...' : '作成'}
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

export function P02_Projects() {
  const { project, projects, switchProject, refreshProjects } = useProject();
  const { role } = useRole();
  const permission = usePermission('P02');
  const canEdit = permission === 'full';

  const [showNewForm, setShowNewForm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'reset' | 'delete'; project: Project } | null>(null);

  const handleCreated = async (created: Project, seed: boolean) => {
    setShowNewForm(false);
    await refreshProjects(created._id);
    if (seed && role) {
      setSeeding(true);
      setError(null);
      try {
        await seedSampleData(created._id, role);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'サンプルデータの投入に失敗しました');
      } finally {
        setSeeding(false);
      }
    }
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setError(null);
    try {
      if (confirmTarget.type === 'reset') {
        await resetProject(confirmTarget.project._id);
      } else {
        await deleteProject(confirmTarget.project._id);
      }
      setConfirmTarget(null);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作に失敗しました');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">プロジェクト管理</h1>
        <p className="text-sm text-slate-500">
          プロジェクトの切替は全ロール可能です。作成・リセット・削除・テーマカラー設定はLAN設計者のみ操作できます。
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {seeding && <p className="text-sm text-slate-500">サンプルデータを投入しています...（申請〜承認〜断面確定まで自動実行中）</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="px-4 py-2"></th>
              <th className="px-4 py-2">プロジェクト名</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p._id} className="border-b border-slate-100">
                <td className="px-4 py-2">
                  <ProjectDot color={p.themeColor} />
                </td>
                <td className="px-4 py-2 font-medium">
                  {p.name}
                  {project?._id === p._id && <span className="ml-2 text-xs text-emerald-600">（選択中）</span>}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={project?._id === p._id}
                      onClick={() => switchProject(p._id)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      切替
                    </button>
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ type: 'reset', project: p })}
                          className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                        >
                          リセット
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ type: 'delete', project: p })}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && !showNewForm && (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="w-fit rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
        >
          新規プロジェクト作成
        </button>
      )}

      {canEdit && showNewForm && (
        <NewProjectForm onCancel={() => setShowNewForm(false)} onCreated={handleCreated} />
      )}

      {confirmTarget && (
        <NameConfirmDialog
          title={confirmTarget.type === 'reset' ? 'プロジェクトのリセット確認' : 'プロジェクトの削除確認'}
          promptLabel={confirmTarget.type === 'reset' ? 'リセットするプロジェクト名' : '削除するプロジェクト名'}
          actionLabel={confirmTarget.type === 'reset' ? 'リセット実行' : '削除実行'}
          targetName={confirmTarget.project.name}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}
