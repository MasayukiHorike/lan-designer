import type { Status } from '../types/schema';

const STATUS_LABELS: Record<Status, string> = {
  draft: '作成中',
  in_review_1st: '回覧中（一次）',
  in_review_2nd: '回覧中（二次）',
  approved: '承認済',
  published: '公開済',
  rejected: '却下',
  withdrawn: '引き戻し済',
};

const STATUS_COLORS: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-600',
  in_review_1st: 'bg-amber-100 text-amber-700',
  in_review_2nd: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  published: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-slate-100 text-slate-500',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export { STATUS_LABELS };
