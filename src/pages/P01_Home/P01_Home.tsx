import { useRole } from '../../contexts/RoleContext';
import { useProject } from '../../contexts/ProjectContext';

export function P01_Home() {
  const { role } = useRole();
  const { project } = useProject();

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
          <p className="mt-2 text-xs text-slate-400">Phase1-9で実装予定</p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">承認待ち件数</h2>
          <p className="mt-2 text-xs text-slate-400">Phase1-9で実装予定</p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">直近断面情報</h2>
          <p className="mt-2 text-xs text-slate-400">Phase1-9で実装予定</p>
        </section>
      </div>
    </div>
  );
}
