import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, UserCircle } from 'lucide-react';
import { useRole } from '../../contexts/RoleContext';
import { useProject } from '../../contexts/ProjectContext';

function ProjectDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

export function Header() {
  const { role } = useRole();
  const { project, projects, switchProject } = useProject();
  const navigate = useNavigate();
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-[var(--project-accent)] px-4 text-white">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">LAN Designer</span>
        {project && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProjectMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-white/90 hover:bg-white/10"
            >
              {project.name}
              <ChevronDown size={14} />
            </button>
            {showProjectMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
                <div className="absolute left-0 z-50 mt-1 w-56 rounded border border-slate-700 bg-slate-800 py-1 text-sm shadow-lg">
                  {projects.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => {
                        switchProject(p._id);
                        setShowProjectMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-200 hover:bg-slate-700"
                    >
                      <ProjectDot color={p.themeColor} />
                      <span className="flex-1">{p.name}</span>
                      {p._id === project._id && <span className="text-emerald-400">✓</span>}
                    </button>
                  ))}
                  <div className="mt-1 border-t border-slate-700 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProjectMenu(false);
                        navigate('/projects');
                      }}
                      className="w-full px-3 py-1.5 text-left text-blue-400 hover:bg-slate-700"
                    >
                      プロジェクト管理へ →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => navigate('/role')}
        className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
      >
        <UserCircle size={18} />
        {role ?? '未選択'}
      </button>
    </header>
  );
}
