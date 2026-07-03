import { NavLink } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import type { MenuItem } from '../../constants/menu';

export function SidebarMenuItem({ item }: { item: MenuItem }) {
  const permission = usePermission(item.screenId);

  if (permission === 'none') {
    return (
      <span className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-slate-500 cursor-not-allowed">
        {item.label}
      </span>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors ${
          isActive
            ? 'bg-slate-700 text-white font-medium'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      {item.label}
      {permission === 'readonly' && (
        <span className="ml-auto text-xs text-slate-500">参照のみ</span>
      )}
    </NavLink>
  );
}
