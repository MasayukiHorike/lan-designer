import { BaseRepository } from './base/BaseRepository';
import type { Signal } from '../types/schema';

export class SignalRepository extends BaseRepository<Signal> {
  constructor() {
    super('signals');
  }

  async findByProjectId(projectId: string): Promise<Signal[]> {
    return this.findAll(projectId);
  }

  /** publishedステータスのSignalのみ取得する */
  async findPublished(projectId: string): Promise<Signal[]> {
    const all = await this.findAll(projectId);
    return all.filter((s) => s.status === 'published');
  }

  async findByFrameId(frameId: string): Promise<Signal[]> {
    const all = await this.findByIndex('frameId', frameId);
    return all.filter((s) => !s.deleted);
  }

  async findByFrameIdIncludingDeleted(frameId: string): Promise<Signal[]> {
    return this.findByIndex('frameId', frameId);
  }

  async findByApplicationId(applicationId: string): Promise<Signal[]> {
    return this.findByIndex('applicationId', applicationId);
  }
}
