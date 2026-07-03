import { BaseRepository } from './base/BaseRepository';
import type { SubsetHistory } from '../types/schema';

// subsetHistories はサブセット（variants）の変更履歴（ステータス管理対象外）
export class SubsetHistoryRepository extends BaseRepository<SubsetHistory> {
  constructor() {
    super('subsetHistories');
  }

  async findByProjectId(projectId: string): Promise<SubsetHistory[]> {
    return this.findAll(projectId);
  }

  async findByVariantId(variantId: string): Promise<SubsetHistory[]> {
    const all = await this.findByIndex('variantId', variantId);
    return all.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  }
}
