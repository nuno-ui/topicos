'use client';

import { cn } from '@/lib/utils';

const ACCOUNT_COLORS = [
  { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
];

function getColorIndex(email: string): number {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % ACCOUNT_COLORS.length;
}

interface AccountBadgeProps {
  email: string;
  size?: 'sm' | 'md';
  showFull?: boolean;
  className?: string;
}

export function AccountBadge({ email, size = 'sm', showFull = false, className }: AccountBadgeProps) {
  const colorIdx = getColorIndex(email);
  const color = ACCOUNT_COLORS[colorIdx];
  const initial = email[0]?.toUpperCase() ?? '?';
  const shortLabel = email.split('@')[0];

  if (showFull) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium',
          size === 'sm' ? 'text-[10px]' : 'text-xs',
          color.bg,
          color.text,
          color.border,
          className
        )}
        title={email}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full font-bold',
            size === 'sm' ? 'h-3.5 w-3.5 text-[8px]' : 'h-4.5 w-4.5 text-[10px]',
            color.bg,
            color.text
          )}
        >
          {initial}
        </span>
        {shortLabel}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-bold',
        size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[11px]',
        color.bg,
        color.text,
        color.border,
        className
      )}
      title={email}
    >
      {initial}
    </span>
  );
}

interface AccountFilterProps {
  accounts: { id: string; email: string }[];
  selectedAccountId: string | null;
  onSelect: (accountId: string | null) => void;
  className?: string;
}

export function AccountFilter({ accounts, selectedAccountId, onSelect, className }: AccountFilterProps) {
  if (accounts.length <= 1) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          selectedAccountId === null
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border bg-card text-muted-foreground hover:text-foreground'
        )}
      >
        All accounts
      </button>
      {accounts.map((acc) => {
        const colorIdx = getColorIndex(acc.email);
        const color = ACCOUNT_COLORS[colorIdx];
        const isActive = selectedAccountId === acc.id;
        return (
          <button
            key={acc.id}
            onClick={() => onSelect(isActive ? null : acc.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              isActive
                ? `${color.border} ${color.bg} ${color.text}`
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            )}
            title={acc.email}
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                color.bg,
                color.text
              )}
            >
              {acc.email[0]?.toUpperCase()}
            </span>
            {acc.email.split('@')[0]}
          </button>
        );
      })}
    </div>
  );
}
