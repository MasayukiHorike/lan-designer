import { BaseRepository } from './base/BaseRepository';
import type { Project } from '../types/schema';

export class ProjectRepository extends BaseRepository<Project> {
  constructor() {
    super('projects');
  }

  /** 論理削除済みを除く、全プロジェクトを取得する */
  async findAllProjects(): Promise<Project[]> {
    const all = await this.getAllRaw();
    return all.filter((p) => !p.deleted);
  }
}
