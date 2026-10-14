import { addMonths, monthsBetween, today } from '@logbook/shared';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError, NetworkError } from '@/api/client';
import { fetchMonth, useBootstrap, useDeleteAccount } from '@/api/queries';
import type { Bootstrap, MonthBundle } from '@/api/types';
import { forgetProfile } from '@/features/onboarding/model';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

// ---------- export ----------
/**
 * Everything this account has, as one JSON file, gathered from the endpoints the app already reads: the bootstrap, every
 * month from the first thing logged to the end of the plan, to-dos, lifts, the journal and saved links.
 */
export const exportAll = async (onProgress: (done: number, total: number) => void) => {
  const boot = await api<Bootstrap>('/bootstrap');
  const t = today();
  const starts = [...boot.blocks.map((b) => b.start), ...boot.habits.map((h) => h.createdOn)].filter(Boolean).sort();
  const first = starts[0] && starts[0] < addMonths(t, -24) ? starts[0] : addMonths(t, -24);
  const ends = [...boot.blocks.map((b) => b.end), addMonths(t, 1)].sort();
  const months = monthsBetween(first, ends[ends.length - 1]!);
  const bundles: Record<string, MonthBundle> = {};
  let done = 0;
  onProgress(0, months.length);
  const queue = [...months];
  const worker = async () => {
    for (let m = queue.shift(); m; m = queue.shift()) {
      const b = await fetchMonth(m);
      // an empty month is noise in the file
      if (b.sessions.length || b.checks.length || b.lifts.length || b.activities.length || b.journal.length || Object.keys(b.morningDays).length) bundles[m] = b;
      onProgress(++done, months.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const [todos, lifts, journal, reads] = await Promise.all([
    api<unknown[]>('/todos').catch(() => []),
    api<unknown[]>('/lifts').catch(() => []),
    api<{ entries: unknown[] }>('/journal?q=&fav=0&limit=100000')
      .then((r) => r.entries)
      .catch(() => []),
    api<{ links: unknown[] }>('/reads')
      .then((r) => r.links)
      .catch(() => []),
  ]);
  const data = {
    app: 'Logbook',
    exportedAt: new Date().toISOString(),
    account: boot.user,
    habits: boot.habits,
    blocks: boot.blocks,
    morningSettings: boot.morningSettings,
    zones: boot.zones,
    months: Object.fromEntries(Object.entries(bundles).sort(([a], [b]) => (a < b ? -1 : 1))),
    todos,
    lifts,
    journal,
    reads,
  };
  const name = `logbook-${t}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { name, months: Object.keys(bundles).length };
};

// ---------- delete account: a two-step sheet ----------
/** What the account holds, counted from what this device has seen, for the first step's sentence. */
const countsFrom = (qc: QueryClient, boot: Bootstrap | undefined) => {
  let sessions = 0;
  let entries = 0;
  for (const [, b] of qc.getQueriesData<MonthBundle>({ queryKey: ['month'] })) {
    if (!b) continue;
    sessions += b.sessions.length;
    entries += b.journal.length;
  }
  return { sessions, entries, habits: boot?.habits.filter((h) => !h.archivedOn).length ?? 0 };
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Step one: what goes, and a way out (export first). Continue pushes the password step. */
export const DeleteStepOne = ({ onExport }: { onExport: () => void }) => {
  const sheet = useSheet();
  const qc = useQueryClient();
  const boot = useBootstrap();
  const c = countsFrom(qc, boot.data);
  const parts = [c.sessions ? plural(c.sessions, 'session') : null, c.habits ? plural(c.habits, 'habit') : null, c.entries ? plural(c.entries, 'journal entry', 'journal entries') : null].filter(Boolean);
  return (
    <div className="s-del">
      <p className="s-del-lede">
        This removes your account and everything in it{parts.length ? `: ${parts.join(', ')}, every to-do, lift and run` : ''}. It can’t be undone, here or on any other device.
      </p>
      <div className="s-del-actions">
        <Button variant="danger" block className="s-del-continue" onClick={() => sheet.push({ title: 'Your password', eyebrow: 'Delete account', body: <DeleteStepTwo />, sticky: true })}>
          Continue
        </Button>
        <Button variant="quiet" block onClick={onExport}>
          Export my data first
        </Button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Keep my account
        </Button>
      </div>
    </div>
  );
};

/** Step two: the password, then `DELETE /me`, then back to sign in. */
const DeleteStepTwo = () => {
  const sheet = useSheet();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const boot = useBootstrap();
  const del = useDeleteAccount();
  const [pw, setPw] = useState('');
  const [shown, setShown] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) {
      setErr('Enter your password to confirm.');
      ref.current?.focus();
      return;
    }
    setErr(null);
    const uid = boot.data?.user.id;
    del.mutate(pw, {
      onSuccess: () => {
        haptics.delete();
        sheet.close();
        forgetProfile(uid);
        try {
          for (const k of Object.keys(sessionStorage)) if (k.startsWith('logbook.onboarding')) sessionStorage.removeItem(k);
        } catch {
          /* nothing kept */
        }
        qc.clear();
        nav('/login', { replace: true });
        toast('Account deleted.');
      },
      onError: (e2) => {
        haptics.error();
        setErr(
          e2 instanceof ApiError && e2.status === 403
            ? 'That password doesn’t match. Try again.'
            : e2 instanceof ApiError && e2.status === 429
              ? 'Too many tries. Wait a minute, then try again.'
              : e2 instanceof NetworkError
                ? 'Couldn’t reach Logbook. Check your connection.'
                : 'Couldn’t delete the account. Try again.',
        );
        ref.current?.select();
      },
    });
  };
  return (
    <form className="s-del" onSubmit={submit} noValidate>
      <p className="s-del-lede">Type your password to delete {boot.data?.user.email ?? 'this account'} for good.</p>
      {/* the account name, for password managers */}
      <input type="email" name="email" autoComplete="username" value={boot.data?.user.email ?? ''} readOnly hidden />
      <div className={`s-pw ${err ? 'bad' : ''}`}>
        <input
          ref={ref}
          className="in s-pw-in"
          type={shown ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          enterKeyHint="done"
          aria-label="Password"
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? 's-pw-err' : undefined}
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button type="button" className="s-pw-eye" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
          {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      {err ? (
        <p id="s-pw-err" className="s-pw-err" role="alert">
          {err}
        </p>
      ) : null}
      <div className="s-del-actions">
        <button type="submit" className="btn block s-del-final" disabled={del.isPending}>
          {del.isPending ? 'Deleting…' : 'Delete my account'}
        </button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Keep my account
        </Button>
      </div>
    </form>
  );
};

