import { useLocation } from 'react-router-dom';

export function NotImplemented() {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
      <p className="text-lg font-medium">この画面は未実装です</p>
      <p className="text-sm">{location.pathname}</p>
    </div>
  );
}
