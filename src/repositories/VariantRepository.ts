import { BaseRepository } from './base/BaseRepository';
import type { Variant } from '../types/schema';

// variants（サブセット定義）は承認フロー不要・登録＝即時published
export class VariantRepository extends BaseRepository<Variant> {
  constructor() {
    super('variants');
  }

  async findByProjectId(projectId: string): Promise<Variant[]> {
    return this.findAll(projectId);
  }
}
