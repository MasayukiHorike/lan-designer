import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useProject } from '../../contexts/ProjectContext';
import { DEFAULT_PROJECT_THEME_COLOR } from '../../constants/projectTheme';

export function Layout() {
  const { project } = useProject();

  return (
    <div
      className="flex h-screen flex-col"
      style={{ '--project-accent': project?.themeColor ?? DEFAULT_PROJECT_THEME_COLOR } as React.CSSProperties}
    >
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
