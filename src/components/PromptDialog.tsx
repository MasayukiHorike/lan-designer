import { useState } from 'react';

interface Field {
  key: string;
  label: string;
}

interface PromptDialogProps {
  title: string;
  fields: Field[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export function PromptDialog({ title, fields, onSubmit, onCancel }: PromptDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  );

  const canSubmit = fields.every((f) => values[f.key]?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        <div className="mt-3 flex flex-col gap-3">
          {fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm text-slate-600">
              {f.label}
              <input
                type="text"
                value={values[f.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(values)}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-40"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
