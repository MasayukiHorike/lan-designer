import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { newId } from '../utils/uuid';
import { nowIso } from '../utils/dateUtils';
import type { Project } from '../types/schema';

const SYSTEM_USER = 'system';

interface ProjectContextValue {
  project: Project | null;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const projectRepo = new ProjectRepository();

/** 現フェーズは単一プロジェクト運用。未作成時はデフォルトプロジェクトを自動生成する */
async function ensureDefaultProject(): Promise<Project> {
  const existing = await projectRepo.findAllProjects();
  if (existing.length > 0) {
    return existing[0];
  }
  const now = nowIso();
  const project: Project = {
    _id: newId('projects'),
    name: 'LAN Designer Project',
    description: '',
    status: 'active',
    createdAt: now,
    createdBy: SYSTEM_USER,
    updatedAt: now,
    updatedBy: SYSTEM_USER,
    deleted: false,
  };
  return projectRepo.create(project);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    ensureDefaultProject().then((p) => {
      if (!cancelled) {
        setProject(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ProjectContext.Provider value={{ project, loading }}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return ctx;
}
