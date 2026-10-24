import { addMonths, monthsBetween, today } from '@logbook/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, NetworkError } from '@/api/client';
import { fetchExport, fetchMonth, useBootstrap, useDeleteAccount } from '@/api/queries';
import type { Bootstrap, ExportBundle, MonthBundle } from '@/api/types';
import { markSignedOut } from '@/features/auth/flag';
import { takeLegacyProfile } from '@/features/onboarding/model';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';

// ---------- export ----------
const save = (data: unknown, name: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/**
 * Before `GET /export` exists on a server (contract 3 is newer than some deployments): the same data gathered from the
 * endpoints the app already reads. The journal is read at the server's page limit (500), never past it (QA D-S3).
 */
const gatherLegacy = async (onProgress: (done: number, total: number) => void) => {
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
      if (b.sessions.length || b.checks.length || b.lifts.length || b.activities.length || b.journal.length || Object.keys(b.morningDays).length) bundles[m] = b;
      onProgress(++done, months.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const [todos, lifts, journal, reads] = await Promise.all([
    api<unknown[]>('/todos'),
    api<unknown[]>('/lifts'),
    api<{ entries: unknown[] }>('/journal?q=&fav=0&limit=500').then((r) => r.entries),
    api<{ links: unknown[] }>('/reads').then((r) => r.links),
  ]);
  return {
    app: 'Logbook',
    exportedAt: new Date().toISOString(),
    account: boot.user,
    habits: boot.habits,
    blocks: boot.blocks,
    morningSettings: boot.morningSettings,
    zones: boot.zones,
    months: Object.fromEntries(Object.entries(bundles).sort(([x], [y]) => (x < y ? -1 : 1))),
    todos,
    lifts,
    journal,
    reads,
  };
};
type Legacy = Awaited<ReturnType<typeof gatherLegacy>>;
const isMissing = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405);

/** The account's data: `GET /export` (contract 3), or the legacy gather on a server without it. */
export const readAll = async (onProgress: (done: number, total: number) => void = () => undefined): Promise<{ kind: 'v2'; data: ExportBundle } | { kind: 'legacy'; data: Legacy }> => {
  try {
    onProgress(0, 1);
    const data = await fetchExport();
    onProgress(1, 1);
    return { kind: 'v2', data };
  } catch (e) {
    if (!isMissing(e)) throw e;
    return { kind: 'legacy', data: await gatherLegacy(onProgress) };
  }
};

/** Export: `GET /export`, saved as `logbook-YYYY-MM-DD.json`, the file Import reads back. */
export const exportAll = async (onProgress: (done: number, total: number) => void) => {
  const r = await readAll(onProgress);
  const name = `logbook-${today()}.json`;
  save(r.data, name);
  return { name, kind: r.kind };
};

// ---------- delete account: a two-step sheet ----------
export interface AccountCounts {
  sessions: number;
  habits: number;
  entries: number;
  todos: number;
  links: number;
}
const len = (x: unknown) => (Array.isArray(x) ? x.length : 0);
/** What the account holds, counted exactly from the export (QA D-S4), not from what this device happens to have cached. */
export const countAll = (r: Awaited<ReturnType<typeof readAll>>): AccountCounts => {
  if (r.kind === 'v2') {
    const d = r.data;
    return {
      sessions: (d.sessions ?? []).filter((x) => !x.deletedAt).length,
      habits: (d.habits ?? []).filter((h) => !(h as { archivedOn?: string | null }).archivedOn).length,
      entries: len(d.journal),
      todos: len(d.todos),
      links: len(d.links),
    };
  }
  const d = r.data;
  const months = Object.values(d.months);
  return {
    sessions: months.reduce((n, m) => n + m.sessions.length, 0),
    habits: d.habits.filter((h) => !h.archivedOn).length,
    entries: d.journal.length,
    todos: d.todos.length,
    links: d.reads.length,
  };
};
const useAccountCounts = () => useQuery({ queryKey: ['account-counts'], queryFn: async () => countAll(await readAll()), staleTime: 0, gcTime: 0, retry: false });
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** Step one: what goes, counted exactly, and a way out (export first). Continue pushes the password step. */
export const DeleteStepOne = ({ onExport }: { onExport: () => void }) => {
  const sheet = useSheet();
  const counts = useAccountCounts();
  const c = counts.data;
  const parts = c ? [c.sessions ? plural(c.sessions, 'session') : null, c.habits ? plural(c.habits, 'habit') : null, c.entries ? plural(c.entries, 'journal entry', 'journal entries') : null, c.todos ? plural(c.todos, 'to-do') : null, c.links ? plural(c.links, 'saved link') : null].filter(Boolean) : [];
  return (
    <div className="s-del">
      {counts.isPending ? (
        <SkeletonGroup label="Counting what your account holds" className="s-del-skel">
          <Skeleton h={18} w="92%" r="line" />
          <Skeleton h={18} w="70%" r="line" />
          <Skeleton h={18} w="48%" r="line" />
        </SkeletonGroup>
      ) : (
        <p className="s-del-lede">
          This removes your account and everything in it{parts.length ? `: ${parts.join(', ')}, and every lift and run` : ''}. It can’t be undone, here or on any other device.
        </p>
      )}
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
        sheet.close();
        // an old device copy of the training answers goes too (the account's copy went with the account)
        takeLegacyProfile(uid);
        try {
          for (const k of Object.keys(sessionStorage)) if (k.startsWith('logbook.onboarding')) sessionStorage.removeItem(k);
        } catch {
          /* nothing kept */
        }
        // Authed drops the cache and shows sign in: that screen is the answer (no toast)
        markSignedOut(qc);
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

