import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import { DEFAULT_PROJECT_THEME_COLOR } from '../constants/projectTheme';
import type { Project } from '../types/schema';

const SYSTEM_USER = 'system';
const STORAGE_KEY = 'lan-designer:selectedProjectId';

interface ProjectContextValue {
  project: Project | null;
  projects: Project[];
  loading: boolean;
  /** 選択中プロジェクトを切り替える（localStorageに永続化・全ロール操作可） */
  switchProject: (projectId: string) => void;
  /**
   * P02でのプロジェクト作成・削除・リセット後に一覧・選択状態を再取得する。
   * selectProjectIdを渡すと、再取得直後にそのプロジェクトを選択状態にする
   * （作成直後に新規プロジェクトへ切り替える場合、state更新の非同期性により
   * refreshProjects→switchProjectを別呼び出しにすると古いprojects一覧を
   * 参照してしまう競合が起きるため、1回の呼び出しで完結させる）。
   */
  refreshProjects: (selectProjectId?: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const projectRepo = new ProjectRepository();

// React.StrictMode（開発時）はエフェクトを二重実行するため、初回マウント時に
// ensureAtLeastOneProjectが並行して2回呼ばれ得る。findAllProjects()がどちらも
// 空を返してから作成すると、デフォルトプロジェクトが重複生成されてしまう
// （TOCTOU競合）。そのため「作成中」のPromiseをモジュール単位で共有し、
// 二重生成を防ぐ（getDb()のdbPromiseと同じシングルトン方式）。
let creatingDefaultProjectPromise: Promise<Project> | null = null;

async function createDefaultProject(): Promise<Project> {
  const now = nowIso();
  const project: Project = {
    _id: newId('projects'),
    name: 'LAN Designer Project',
    description: '',
    status: 'active',
    themeColor: DEFAULT_PROJECT_THEME_COLOR,
    createdAt: now,
    createdBy: SYSTEM_USER,
    updatedAt: now,
    updatedBy: SYSTEM_USER,
    deleted: false,
  };
  return projectRepo.create(project);
}

/** プロジェクトが1件も無ければデフォルトプロジェクトを自動生成する */
async function ensureAtLeastOneProject(): Promise<Project[]> {
  const existing = await projectRepo.findAllProjects();
  if (existing.length > 0) {
    return existing;
  }
  if (!creatingDefaultProjectPromise) {
    creatingDefaultProjectPromise = createDefaultProject();
  }
  const created = await creatingDefaultProjectPromise;
  return [created];
}

/** 保存済み選択IDが一覧に存在すればそれを、無ければ先頭（＝他の既存プロジェクトか、
 *  空だった場合に自動生成された新規デフォルトプロジェクト）を選択する */
function resolveSelected(list: Project[], preferredId: string | null): Project {
  const found = preferredId ? list.find((p) => p._id === preferredId) : undefined;
  return found ?? list[0];
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (preferredId?: string) => {
    const list = await ensureAtLeastOneProject();
    setProjects(list);
    const storedId = preferredId ?? localStorage.getItem(STORAGE_KEY);
    const selected = resolveSelected(list, storedId);
    setProject(selected);
    localStorage.setItem(STORAGE_KEY, selected._id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchProject = (projectId: string) => {
    const found = projects.find((p) => p._id === projectId);
    if (!found) return;
    setProject(found);
    localStorage.setItem(STORAGE_KEY, projectId);
  };

  const refreshProjects = async (selectProjectId?: string) => {
    await load(selectProjectId);
  };

  return (
    <ProjectContext.Provider value={{ project, projects, loading, switchProject, refreshProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return ctx;
}
