import { getDb, type CollectionName } from '../../db/database';
import type { BaseDocument } from '../../types/schema';
import { nowIso } from '../../utils/dateUtils';
import type { IRepository } from './IRepository';

/**
 * 全Repositoryの基底クラス。
 * IndexedDBへの直接アクセスはこのクラス（およびサブクラス）内に閉じ込める。
 * ストア名は実行時にコレクションごとに変わるため、idbの静的型付けを離れて
 * dbをanyとして扱い、公開APIの戻り値はジェネリクスTで型付けする。
 */
export abstract class BaseRepository<T extends BaseDocument> implements IRepository<T> {
  protected readonly storeName: CollectionName;

  protected constructor(storeName: CollectionName) {
    this.storeName = storeName;
  }

  async findById(id: string): Promise<T | undefined> {
    const db = await getDb();
    return (await (db as any).get(this.storeName, id)) as T | undefined;
  }

  protected async findByIndex(indexName: string, value: string): Promise<T[]> {
    const db = await getDb();
    return (await (db as any).getAllFromIndex(this.storeName, indexName, value)) as T[];
  }

  protected async getAllRaw(): Promise<T[]> {
    const db = await getDb();
    return (await (db as any).getAll(this.storeName)) as T[];
  }

  /** プロジェクト内の全件（論理削除済みを除く） */
  async findAll(projectId: string): Promise<T[]> {
    const all = await this.findByIndex('projectId', projectId);
    return all.filter((doc) => !doc.deleted);
  }

  /** プロジェクト内の全件（論理削除済みを含む） */
  async findAllIncludingDeleted(projectId: string): Promise<T[]> {
    return this.findByIndex('projectId', projectId);
  }

  async create(doc: T): Promise<T> {
    const db = await getDb();
    await (db as any).put(this.storeName, doc);
    return doc;
  }

  async update(id: string, patch: Partial<T>, updatedBy: string): Promise<T> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`${this.storeName}: document not found (${id})`);
    }
    const updated: T = { ...existing, ...patch, updatedAt: nowIso(), updatedBy };
    const db = await getDb();
    await (db as any).put(this.storeName, updated);
    return updated;
  }

  async softDelete(id: string, updatedBy: string): Promise<void> {
    await this.update(id, { deleted: true } as Partial<T>, updatedBy);
  }
}
