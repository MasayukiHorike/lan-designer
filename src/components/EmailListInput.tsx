import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  emails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
}

export function EmailListInput({ emails, onChange, disabled }: Props) {
  const [input, setInput] = useState('');

  const addEmail = () => {
    const trimmed = input.trim();
    if (trimmed && !emails.includes(trimmed)) {
      onChange([...emails, trimmed]);
    }
    setInput('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {emails.map((email) => (
          <span
            key={email}
            className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
          >
            {email}
            {!disabled && (
              <button type="button" onClick={() => onChange(emails.filter((e) => e !== email))}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input
            type="email"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addEmail();
              }
            }}
            placeholder="メールアドレスを入力"
            className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={addEmail}
            className="rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300"
          >
            追加
          </button>
        </div>
      )}
    </div>
  );
}
