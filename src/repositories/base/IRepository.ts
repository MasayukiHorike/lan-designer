import type { BaseDocument } from '../../types/schema';

export interface IRepository<T extends BaseDocument> {
  findById(id: string): Promise<T | undefined>;
  /** 論理削除済みを除く、プロジェクト内の全件を取得する */
  findAll(projectId: string): Promise<T[]>;
  /** 論理削除済みを含む、プロジェクト内の全件を取得する */
  findAllIncludingDeleted(projectId: string): Promise<T[]>;
  create(doc: T): Promise<T>;
  update(id: string, patch: Partial<T>, updatedBy: string): Promise<T>;
  softDelete(id: string, updatedBy: string): Promise<void>;
  /** 物理削除（プロジェクト削除・リセット専用） */
  hardDelete(id: string): Promise<void>;
  /** プロジェクトに紐づく全件を物理削除する（削除済み含む） */
  deleteAllByProjectId(projectId: string): Promise<void>;
}
