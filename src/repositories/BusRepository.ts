import { BaseRepository } from './base/BaseRepository';
import type { Bus } from '../types/schema';

export class BusRepository extends BaseRepository<Bus> {
  constructor() {
    super('buses');
  }

  async findByProjectId(projectId: string): Promise<Bus[]> {
    return this.findAll(projectId);
  }

  /** publishedステータスのバスのみ取得する */
  async findPublished(projectId: string): Promise<Bus[]> {
    const all = await this.findAll(projectId);
    return all.filter((b) => b.status === 'published');
  }
}
