import { NavLink } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import type { MenuItem } from '../../constants/menu';

export function SidebarMenuItem({ item }: { item: MenuItem }) {
  const permission = usePermission(item.screenId);

  if (permission === 'none') {
    return (
      <span className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-white/40 cursor-not-allowed">
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
          isActive ? 'bg-white/20 text-white font-medium' : 'text-white/80 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      {item.label}
      {permission === 'readonly' && <span className="ml-auto text-xs text-white/50">参照のみ</span>}
    </NavLink>
  );
}
