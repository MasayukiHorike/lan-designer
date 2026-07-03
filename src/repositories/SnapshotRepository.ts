import { BaseRepository } from './base/BaseRepository';
import type { Snapshot } from '../types/schema';

// snapshots は断面確定時に永続化される履歴（ステータス管理対象外）
export class SnapshotRepository extends BaseRepository<Snapshot> {
  constructor() {
    super('snapshots');
  }

  /** 新しい順（sequenceNo降順）で取得する */
  async findByProjectId(projectId: string): Promise<Snapshot[]> {
    const all = await this.findAll(projectId);
    return all.sort((a, b) => b.sequenceNo - a.sequenceNo);
  }

  async findLatest(projectId: string): Promise<Snapshot | undefined> {
    const all = await this.findByProjectId(projectId);
    return all[0];
  }
}
