import { addMonths, monthsBetween, today } from '@logbook/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, NetworkError } from '@/api/client';
import { fetchExport, fetchMonth, useBootstrap, useDeleteAccount } from '@/api/queries';
import type { Bootstrap, ExportBundle, MonthBundle } from '@/api/types';
import { markSignedOut } from '@/features/auth/flag';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { DELETE_COPIES, deleteLede, EXPORT_FAILED, exportNote, PASSWORD_MAX, passwordProblem, passwordRefusal, type AccountCounts, type PasswordField, type PasswordProblem } from './accountModel';
import { deliverExport } from './exportFile';

// ---------- export ----------

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

/**
 * Export: `GET /export` as `logbook-YYYY-MM-DD.json`, the file Import reads back. A download on the web; in the iPhone
 * app the share sheet (exportFile.ts). `outcome` says which, and whether the share sheet was closed without sharing.
 */
export const exportAll = async (onProgress: (done: number, total: number) => void) => {
  const r = await readAll(onProgress);
  const name = `logbook-${today()}.json`;
  const outcome = await deliverExport(r.data, name);
  return { name, kind: r.kind, outcome };
};

/**
 * One export at a time, with its progress and its result as a line to show where it was started (the Data page's row, the
 * delete sheet). Nothing claims a file exists unless the download started or the share sheet finished.
 */
export const useExport = () => {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; bad: boolean } | null>(null);
  const run = async () => {
    if (busy) return;
    setBusy('Gathering your log…');
    setResult(null);
    try {
      const r = await exportAll((d, t) => setBusy(t > 1 ? `Gathering ${d} of ${t} months…` : 'Gathering your log…'));
      setResult({ text: exportNote(r.outcome, r.name), bad: false });
    } catch {
      haptics.error();
      setResult({ text: EXPORT_FAILED, bad: true });
    } finally {
      setBusy(null);
    }
  };
  return { busy, result, run };
};

// ---------- delete account: a two-step sheet ----------
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

/**
 * Step one: what goes, counted exactly, what happens to the copies, and a way out. "Export my data first" runs here, with
 * its progress and its result on screen, so nobody continues to an irreversible step believing in a file that is not there.
 */
export const DeleteStepOne = () => {
  const sheet = useSheet();
  const counts = useAccountCounts();
  const exp = useExport();
  return (
    <div className="s-del">
      {counts.isPending ? (
        <SkeletonGroup label="Counting what your account holds" className="s-del-skel">
          <Skeleton h={18} w="92%" r="line" />
          <Skeleton h={18} w="70%" r="line" />
          <Skeleton h={18} w="48%" r="line" />
        </SkeletonGroup>
      ) : (
        <p className="s-del-lede">{deleteLede(counts.data)}</p>
      )}
      <p className="s-del-fine">{DELETE_COPIES}</p>
      <div className="s-del-actions">
        <Button variant="danger" block className="s-del-continue" disabled={!!exp.busy} onClick={() => sheet.push({ title: 'Your password', eyebrow: 'Delete account', body: <DeleteStepTwo />, sticky: true })}>
          Continue
        </Button>
        <Button variant="quiet" block disabled={!!exp.busy} onClick={() => void exp.run()}>
          {exp.busy ?? 'Export my data first'}
        </Button>
        {exp.result ? (
          <p className={`s-del-note ${exp.result.bad ? 's-bad' : ''}`} role="status">
            {exp.result.text}
          </p>
        ) : null}
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
    del.mutate(pw, {
      onSuccess: () => {
        sheet.close();
        // the shell wipes what this account kept on the device and shows the welcome page: that screen is the answer
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

// ---------- change password ----------
/** One password field with its show and hide eye. */
const PwField = ({ id, label, value, onChange, autoComplete, bad, describedBy, inputRef, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: 'current-password' | 'new-password'; bad: boolean; describedBy?: string; inputRef?: React.Ref<HTMLInputElement>; hint: 'next' | 'done' }) => {
  const [shown, setShown] = useState(false);
  return (
    <label className="s-pw-field" htmlFor={id}>
      <span className="s-pw-label">{label}</span>
      <span className={`s-pw ${bad ? 'bad' : ''}`}>
        <input ref={inputRef} id={id} className="in s-pw-in" type={shown ? 'text' : 'password'} name={id} autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint={hint} maxLength={PASSWORD_MAX} aria-invalid={bad ? true : undefined} aria-describedby={bad ? describedBy : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="s-pw-eye" aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
          {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
};

/**
 * Change password (Contract 3): the current password, the new one, and the new one again, then `POST /me/password
 * { current, next }`. A wrong current password, a short new one and a mismatch each say so under the fields. On success
 * the sheet closes and a toast confirms; the server signs the other devices out and keeps this one.
 */
export const ChangePasswordPanel = () => {
  const sheet = useSheet();
  const toast = useToast();
  const boot = useBootstrap();
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState<PasswordProblem | null>(null);
  const refs = { current: useRef<HTMLInputElement>(null), next: useRef<HTMLInputElement>(null), confirm: useRef<HTMLInputElement>(null) };
  useEffect(() => {
    const t = setTimeout(() => refs.current.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const change = useMutation({ mutationFn: (b: { current: string; next: string }) => api<{ ok: boolean; signedOut?: number | boolean } | undefined>('/me/password', { method: 'POST', json: b }) });
  const fail = (p: PasswordProblem) => {
    haptics.error();
    setErr(p);
    refs[p.field].current?.focus();
  };
  const set = (k: PasswordField) => (value: string) => {
    setV((cur) => ({ ...cur, [k]: value }));
    if (err) setErr(null);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (change.isPending) return;
    const p = passwordProblem(v);
    if (p) return fail(p);
    setErr(null);
    change.mutate(
      { current: v.current, next: v.next },
      {
        onSuccess: (r) => {
          haptics.success();
          sheet.close();
          toast(r?.signedOut ? 'Password changed. Your other devices are signed out.' : 'Password changed.');
        },
        onError: (e2) => fail(passwordRefusal(e2)),
      },
    );
  };
  return (
    <form className="s-del s-pwform" onSubmit={submit} noValidate>
      {/* the account name, for password managers */}
      <input type="email" name="email" autoComplete="username" value={boot.data?.user.email ?? ''} readOnly hidden />
      <PwField id="pw-current" label="Current password" value={v.current} onChange={set('current')} autoComplete="current-password" bad={err?.field === 'current'} describedBy="s-pwform-err" inputRef={refs.current} hint="next" />
      <PwField id="pw-next" label="New password" value={v.next} onChange={set('next')} autoComplete="new-password" bad={err?.field === 'next'} describedBy="s-pwform-err" inputRef={refs.next} hint="next" />
      <PwField id="pw-confirm" label="New password again" value={v.confirm} onChange={set('confirm')} autoComplete="new-password" bad={err?.field === 'confirm'} describedBy="s-pwform-err" inputRef={refs.confirm} hint="done" />
      {err ? (
        <p id="s-pwform-err" className="s-pw-err" role="alert">
          {err.text}
        </p>
      ) : (
        <p className="s-del-fine">At least 8 characters. Your other devices are signed out when it changes.</p>
      )}
      <div className="s-del-actions">
        <Button variant="primary" block type="submit" disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </Button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
