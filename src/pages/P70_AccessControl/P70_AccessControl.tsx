import { useEffect, useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useRole } from '../../contexts/RoleContext';
import { usePermission } from '../../hooks/usePermission';
import { AccessControlRepository } from '../../repositories/AccessControlRepository';
import { DEFAULT_PERMISSIONS, SCREEN_NAMES } from '../../constants/accessControl';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { Permission, Role } from '../../types/schema';

const accessControlRepo = new AccessControlRepository();
const ROLES: Role[] = ['ECU設計者', 'ECU承認者', 'LAN設計者', 'LAN承認者'];
const PERMISSION_LABELS: Record<Permission, string> = { full: '○', readonly: '△', none: '✗' };

type PermissionTable = Record<string, Record<Role, Permission>>;

function cloneDefaults(): PermissionTable {
  const table: PermissionTable = {};
  for (const [screenId, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
    table[screenId] = { ...perms };
  }
  return table;
}

export function P70_AccessControl() {
  const { project } = useProject();
  const { role } = useRole();
  const permission = usePermission('P70');
  const [table, setTable] = useState<PermissionTable>(cloneDefaults());
  const [dirty, setDirty] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!project) return;
    accessControlRepo.findByProjectId(project._id).then((entries) => {
      const next = cloneDefaults();
      for (const entry of entries) {
        next[entry.screenId] = { ...entry.permissions };
      }
      setTable(next);
      setDirty(false);
    });
  }, [project]);

  if (permission !== 'full') {
    return <p className="text-slate-400">この画面へのアクセス権がありません。</p>;
  }

  const handleChange = (screenId: string, r: Role, value: Permission) => {
    setTable((prev) => ({ ...prev, [screenId]: { ...prev[screenId], [r]: value } }));
    setDirty(true);
    setSaved(false);
  };

  const handleReset = () => {
    setTable(cloneDefaults());
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!project || !role) return;
    const entries = Object.entries(table).map(([screenId, permissions]) => ({
      screenId,
      screenName: SCREEN_NAMES[screenId] ?? screenId,
      permissions,
    }));
    await accessControlRepo.saveAll(project._id, entries, role);
    setShowSaveConfirm(false);
    setDirty(false);
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">アクセス権管理</h1>
        <p className="text-sm text-slate-500">画面ごとにロール別のアクセス権（○全機能／△参照のみ／✗アクセス不可）を設定します。</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => setShowSaveConfirm(true)}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
        >
          保存
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          初期値リセット
        </button>
        {saved && <span className="text-sm text-emerald-600">保存しました</span>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="px-4 py-2">画面名</th>
              {ROLES.map((r) => (
                <th key={r} className="px-4 py-2 text-center">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(DEFAULT_PERMISSIONS).map((screenId) => (
              <tr key={screenId} className="border-b border-slate-100">
                <td className="px-4 py-2">
                  {screenId}: {SCREEN_NAMES[screenId]}
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="px-4 py-2 text-center">
                    <select
                      value={table[screenId]?.[r] ?? 'full'}
                      onChange={(e) => handleChange(screenId, r, e.target.value as Permission)}
                      className="rounded border border-slate-300 px-2 py-1"
                    >
                      {(['full', 'readonly', 'none'] as const).map((p) => (
                        <option key={p} value={p}>
                          {PERMISSION_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showSaveConfirm && (
        <ConfirmDialog
          title="保存確認"
          message="アクセス権設定を一括反映します。よろしいですか？"
          confirmLabel="保存"
          onConfirm={handleSave}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}
    </div>
  );
}
