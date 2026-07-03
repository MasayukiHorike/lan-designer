import { BaseRepository } from './base/BaseRepository';
import type { Ecu } from '../types/schema';

export class EcuRepository extends BaseRepository<Ecu> {
  constructor() {
    super('ecus');
  }

  async findByProjectId(projectId: string): Promise<Ecu[]> {
    return this.findAll(projectId);
  }

  /** publishedステータスのECUのみ取得する（150%データセットの正式公開領域） */
  async findPublished(projectId: string): Promise<Ecu[]> {
    const all = await this.findAll(projectId);
    return all.filter((e) => e.status === 'published');
  }
}
