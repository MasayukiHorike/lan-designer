import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { MENU_GROUPS } from '../../constants/menu';
import { SidebarMenuItem } from './SidebarMenuItem';

const COLLAPSE_STORAGE_KEY = 'lan-designer:sidebarCollapsed';

export function Sidebar() {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true');

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <nav
      className={`flex h-full shrink-0 flex-col overflow-y-auto bg-[var(--project-accent)] py-4 transition-all duration-200 ${
        collapsed ? 'w-12' : 'w-60'
      }`}
    >
      <div className={`mb-2 flex px-2 ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'サイドメニューを展開' : 'サイドメニューを折りたたむ'}
          className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      {collapsed ? (
        <div className="flex flex-col gap-0.5 px-1">
          {MENU_GROUPS.flatMap((group) => group.items).map((item) => (
            <SidebarMenuItem key={item.screenId} item={item} collapsed />
          ))}
        </div>
      ) : (
        MENU_GROUPS.map((group) => {
          const isCollapsed = collapsedGroups.has(group.title);
          return (
            <div key={group.title} className="mb-1 px-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white/60 hover:text-white"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {group.title}
              </button>
              {!isCollapsed && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.screenId} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </nav>
  );
}
