import { useNavigate } from 'react-router-dom';
import { useRole } from '../../contexts/RoleContext';
import type { Role } from '../../types/schema';

const ROLES: { role: Role; description: string }[] = [
  { role: 'ECU設計者', description: '申請書作成・Excel登録・引き戻し・自担当ECU Port参照' },
  { role: 'ECU承認者', description: '一次承認・差し戻し・参照全般' },
  { role: 'LAN設計者', description: 'LAN構成管理・サブセット管理・断面確定・全出力・アクセス権管理' },
  { role: 'LAN承認者', description: '二次承認・却下・in_review_2nd時編集・参照全般' },
];

export function P00_RoleSwitch() {
  const { role: currentRole, setRole } = useRole();
  const navigate = useNavigate();

  const handleSelect = (role: Role) => {
    setRole(role);
    navigate('/');
  };

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold text-slate-800">ロール切替</h1>
      <p className="text-sm text-slate-500">
        検証したいロールを選択してください。選択したロールは以降の画面で維持されます。
      </p>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {ROLES.map(({ role, description }) => (
          <button
            key={role}
            type="button"
            onClick={() => handleSelect(role)}
            className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:border-slate-400 hover:bg-slate-50 ${
              currentRole === role ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="text-base font-semibold text-slate-800">{role}</span>
            <span className="text-xs text-slate-500">{description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
