import { useNavigate } from 'react-router-dom';
import { UserCircle } from 'lucide-react';
import { useRole } from '../../contexts/RoleContext';
import { useProject } from '../../contexts/ProjectContext';

export function Header() {
  const { role } = useRole();
  const { project } = useProject();
  const navigate = useNavigate();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 text-white">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">LAN Designer</span>
        {project && <span className="text-sm text-slate-400">{project.name}</span>}
      </div>
      <button
        type="button"
        onClick={() => navigate('/role')}
        className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
      >
        <UserCircle size={18} />
        {role ?? '未選択'}
      </button>
    </header>
  );
}
