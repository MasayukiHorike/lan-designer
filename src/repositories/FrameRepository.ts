import { BaseRepository } from './base/BaseRepository';
import type { Frame } from '../types/schema';

export class FrameRepository extends BaseRepository<Frame> {
  constructor() {
    super('frames');
  }

  async findByProjectId(projectId: string): Promise<Frame[]> {
    return this.findAll(projectId);
  }

  /** publishedステータスのFrameのみ取得する（150%データセットの正式公開領域） */
  async findPublished(projectId: string): Promise<Frame[]> {
    const all = await this.findAll(projectId);
    return all.filter((f) => f.status === 'published');
  }

  async findByApplicationId(applicationId: string): Promise<Frame[]> {
    return this.findByIndex('applicationId', applicationId);
  }
}
