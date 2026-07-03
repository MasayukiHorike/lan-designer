import { BaseRepository } from './base/BaseRepository';
import type { VersionHistory } from '../types/schema';

// versionHistories はFrame/Signalのバージョン変更履歴（ステータス管理対象外）
export class VersionHistoryRepository extends BaseRepository<VersionHistory> {
  constructor() {
    super('versionHistories');
  }

  async findByProjectId(projectId: string): Promise<VersionHistory[]> {
    return this.findAll(projectId);
  }

  async findByTargetId(targetId: string): Promise<VersionHistory[]> {
    const all = await this.findByIndex('targetId', targetId);
    return all.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  }
}
