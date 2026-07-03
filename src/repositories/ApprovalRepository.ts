import { getDb } from '../db/database';
import type { Approval } from '../types/schema';
import { nowIso } from '../utils/dateUtils';

// approvals は承認アクションの履歴（applicationId配下・projectId軸を持たない）
export class ApprovalRepository {
  private readonly storeName = 'approvals' as const;

  async findById(id: string): Promise<Approval | undefined> {
    const db = await getDb();
    return db.get(this.storeName, id);
  }

  async findByApplicationId(applicationId: string): Promise<Approval[]> {
    const db = await getDb();
    return db.getAllFromIndex(this.storeName, 'applicationId', applicationId);
  }

  async create(doc: Approval): Promise<Approval> {
    const db = await getDb();
    await db.put(this.storeName, doc);
    return doc;
  }

  async update(id: string, patch: Partial<Approval>, updatedBy: string): Promise<Approval> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`approvals: document not found (${id})`);
    }
    const updated: Approval = { ...existing, ...patch, updatedAt: nowIso(), updatedBy };
    const db = await getDb();
    await db.put(this.storeName, updated);
    return updated;
  }
}
