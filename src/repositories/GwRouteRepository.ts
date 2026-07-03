import { BaseRepository } from './base/BaseRepository';
import type { GwRoute } from '../types/schema';

export class GwRouteRepository extends BaseRepository<GwRoute> {
  constructor() {
    super('gwRoutes');
  }

  async findByProjectId(projectId: string): Promise<GwRoute[]> {
    return this.findAll(projectId);
  }

  async findPublished(projectId: string): Promise<GwRoute[]> {
    const all = await this.findAll(projectId);
    return all.filter((r) => r.status === 'published');
  }

  async findByFrameId(frameId: string): Promise<GwRoute[]> {
    const all = await this.findByIndex('frameId', frameId);
    return all.filter((r) => !r.deleted);
  }
}
