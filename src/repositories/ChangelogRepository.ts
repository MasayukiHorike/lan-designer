import { BaseRepository } from './base/BaseRepository';
import type { Changelog } from '../types/schema';

// changelogs は断面確定時に自動生成される履歴（ステータス管理対象外）
export class ChangelogRepository extends BaseRepository<Changelog> {
  constructor() {
    super('changelogs');
  }

  async findByProjectId(projectId: string): Promise<Changelog[]> {
    return this.findAll(projectId);
  }

  async findBySnapshotId(projectId: string, snapshotId: string): Promise<Changelog | undefined> {
    const all = await this.findAll(projectId);
    return all.find((c) => c.snapshotId === snapshotId);
  }
}
