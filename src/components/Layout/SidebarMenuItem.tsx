import { NavLink } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import type { MenuItem } from '../../constants/menu';

export function SidebarMenuItem({ item, collapsed }: { item: MenuItem; collapsed?: boolean }) {
  const permission = usePermission(item.screenId);
  const Icon = item.icon;

  if (permission === 'none') {
    return (
      <span
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm text-white/40 cursor-not-allowed ${
          collapsed ? 'justify-center px-0' : ''
        }`}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && item.label}
      </span>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors ${collapsed ? 'justify-center px-0' : ''} ${
          isActive ? 'bg-white/20 text-white font-medium' : 'text-white/80 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && (
        <>
          {item.label}
          {permission === 'readonly' && <span className="ml-auto text-xs text-white/50">参照のみ</span>}
        </>
      )}
    </NavLink>
  );
}
