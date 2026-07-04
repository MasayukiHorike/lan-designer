export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <p>{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-red-400 hover:text-red-600">
          ✕
        </button>
      )}
    </div>
  );
}
