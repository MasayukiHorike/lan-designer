import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MENU_GROUPS } from '../../constants/menu';
import { SidebarMenuItem } from './SidebarMenuItem';

export function Sidebar() {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col overflow-y-auto bg-slate-900 py-4">
      {MENU_GROUPS.map((group) => {
        const isCollapsed = collapsedGroups.has(group.title);
        return (
          <div key={group.title} className="mb-1 px-2">
            <button
              type="button"
              onClick={() => toggleGroup(group.title)}
              className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
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
      })}
    </nav>
  );
}
