import { BaseRepository } from './base/BaseRepository';
import type { Application, Status } from '../types/schema';

export class ApplicationRepository extends BaseRepository<Application> {
  constructor() {
    super('applications');
  }

  async findByProjectId(projectId: string): Promise<Application[]> {
    return this.findAll(projectId);
  }

  async findByApplicantId(projectId: string, applicantId: string): Promise<Application[]> {
    const all = await this.findAll(projectId);
    return all.filter((a) => a.applicantId === applicantId);
  }

  async findByStatus(projectId: string, status: Status): Promise<Application[]> {
    const all = await this.findAll(projectId);
    return all.filter((a) => a.status === status);
  }

  /** 申請書番号採番用：同一ECU・同一日付の既存申請書数を取得する */
  async countByEcuAndDate(projectId: string, ecuName: string, dateStr: string): Promise<number> {
    const all = await this.findAllIncludingDeleted(projectId);
    return all.filter((a) => a.applicationNo.startsWith(`APP-${ecuName}-${dateStr}-`)).length;
  }
}
