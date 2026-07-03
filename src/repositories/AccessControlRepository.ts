import { BaseRepository } from './base/BaseRepository';
import type { AccessControl, Permission, Role } from '../types/schema';
import { DEFAULT_PERMISSIONS, SCREEN_NAMES } from '../constants/accessControl';

// accessControls はP70で変更可能な画面別権限設定（変更履歴は保持しない）
export class AccessControlRepository extends BaseRepository<AccessControl> {
  constructor() {
    super('accessControls');
  }

  async findByProjectId(projectId: string): Promise<AccessControl[]> {
    return this.findAll(projectId);
  }

  async findByScreenId(projectId: string, screenId: string): Promise<AccessControl | undefined> {
    const all = await this.findAll(projectId);
    return all.find((a) => a.screenId === screenId);
  }

  /** 設定が未登録の画面はシステムデフォルト値を返す */
  async getPermission(projectId: string, screenId: string, role: Role): Promise<Permission> {
    const entry = await this.findByScreenId(projectId, screenId);
    if (entry) {
      return entry.permissions[role];
    }
    return DEFAULT_PERMISSIONS[screenId]?.[role] ?? 'full';
  }

  /** 全画面のデフォルト権限で初期化する（プロジェクト作成時に使用） */
  buildDefaults(): { screenId: string; screenName: string; permissions: Record<Role, Permission> }[] {
    return Object.entries(DEFAULT_PERMISSIONS).map(([screenId, permissions]) => ({
      screenId,
      screenName: SCREEN_NAMES[screenId] ?? screenId,
      permissions,
    }));
  }
}
