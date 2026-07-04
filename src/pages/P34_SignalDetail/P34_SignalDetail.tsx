import { useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { SignalDetailView } from '../../components/SignalDetailView';

export function P34_SignalDetail() {
  const { signalId } = useParams<{ signalId: string }>();

  if (!signalId) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">
        <SignalDetailView
          signalId={`signals/${signalId}`}
          headerExtra={
            <button
              type="button"
              onClick={() => window.close()}
              className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              <X size={13} />
              閉じる
            </button>
          }
        />
      </div>
    </div>
  );
}
