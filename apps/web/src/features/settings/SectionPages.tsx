import { useMutation, useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useBootstrap } from '@/api/queries';
import { markSignedOut } from '@/features/auth/flag';
import { haptics, useHapticsEnabled } from '@/lib/haptics';
import { isNative } from '@/lib/native';
import { outbox } from '@/api/outbox';
import { Button } from '@/ui/primitives';
import { PushedBar, Row, useSheet, useToast } from '@/ui';
import { ChangePasswordPanel, DeleteStepOne, useExport } from './account';
import { signOutLede, unsentWords } from './accountModel';
import { popFav } from '@/features/journal/feel';
import { Download, House, KeyRound, Mail, Upload, Vibrate, type LucideIcon } from 'lucide-react';
import { healthDeviceId } from './healthDevice';
import { EXPORT_SUB, IMPORT_MAX_BYTES, IMPORT_NOT_OURS, IMPORT_SUB, IMPORT_TOO_BIG, importDone, importError, importKind } from './dataModel';
import { GoRow, SGroup, Switch, Tile } from './parts';

// ---------- install (the web app only) ----------
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferredInstall: BIP | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as BIP;
  });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
/** Safari on an iPhone or iPad: the one browser where Add to Home Screen is a manual step worth explaining. */
const isIosSafari = () => /iP(hone|ad|od)/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

/**
 * The Haptics switch (the Settings root's App group and the App page). Turning it on answers with the feel it turns on, as
 * `toggle` on the apex of the `complete` curve (`hapticAtPeak`, contracts §D.3: never fired straight from the tap; review
 * code F13); turning it off is silent.
 */
export const HapticsRow = ({ icon }: { icon?: LucideIcon } = {}): React.JSX.Element => {
  const [hapticsOn, setHapticsOn] = useHapticsEnabled();
  return (
    <Row
      className={icon ? 'has-tile' : ''}
      left={icon ? <Tile icon={icon} /> : undefined}
      title="Haptics"
      // one line (layout standard 2.9); the web line says where it works, since iPhone browsers have none
      sub={isNative ? 'A light tap you can feel' : 'Not in iPhone browsers'}
      right={
        <Switch
          on={hapticsOn}
          label="Haptics"
          onChange={(on) => {
            setHapticsOn(on);
            if (on) popFav();
          }}
        />
      }
    />
  );
};

/** /settings/app: haptics, and on the web, installing to the home screen. */
export const AppPage = (): React.JSX.Element => {
  const [canInstall, setCanInstall] = useState(!!deferredInstall);
  useEffect(() => {
    const fn = (e: Event) => {
      e.preventDefault();
      deferredInstall = e as BIP;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', fn);
    return () => window.removeEventListener('beforeinstallprompt', fn);
  }, []);
  const install = async () => {
    if (!deferredInstall) return;
    await deferredInstall.prompt();
    const r = await deferredInstall.userChoice;
    if (r.outcome === 'accepted') setCanInstall(false);
    deferredInstall = null;
  };
  return (
    <div className="page s-set s-sub">
      <PushedBar title="App" />
      <SGroup title="Feel">
        <HapticsRow icon={Vibrate} />
      </SGroup>
      {!isNative ? (
        <SGroup title="Home screen">
          {isStandalone() ? (
            <Row className="s-wrap has-tile" left={<Tile icon={House} />} title="Installed" sub="You’re running Orby from the home screen." />
          ) : canInstall ? (
            <GoRow icon={House} title="Install Orby" sub="Full screen, and it opens offline." onPress={() => void install()} />
          ) : isIosSafari() ? (
            <Row className="s-wrap has-tile" left={<Tile icon={House} />} title="Add to Home Screen" sub="In Safari: Share, then Add to Home Screen." />
          ) : (
            <Row className="s-wrap has-tile" left={<Tile icon={House} />} title="Add to Home Screen" sub="From your browser’s menu, for full screen and offline." />
          )}
        </SGroup>
      ) : null}
    </div>
  );
};

/** /settings/data: Import and Export. Each row answers in its own second line, a failure included. */
export const DataPage = (): React.JSX.Element => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ text: string; bad: boolean } | null>(null);
  const importBundle = useMutation({
    mutationFn: async (file: File) => {
      // a file the server would refuse is refused here, before the whole of it is sent
      if (file.size > IMPORT_MAX_BYTES) throw new ApiError(IMPORT_TOO_BIG, 413);
      let json: unknown;
      try {
        json = JSON.parse(await file.text());
      } catch {
        throw new ApiError(IMPORT_NOT_OURS, 422);
      }
      // "Nothing new" is said only of a file that is a Logbook export; an empty object or another app's JSON is refused
      if (!importKind(json)) throw new ApiError(IMPORT_NOT_OURS, 422);
      return api<{ ok?: boolean; imported?: Record<string, number> }>('/import', { method: 'POST', json });
    },
    onSuccess: (r) => {
      setImportResult({ text: importDone(r.imported), bad: false });
      void qc.invalidateQueries();
    },
    onError: (e) => {
      haptics.error();
      setImportResult({ text: importError(e instanceof ApiError ? e.status : null), bad: true });
    },
    onSettled: () => {
      // the same file can be picked again after a fix
      if (fileRef.current) fileRef.current.value = '';
    },
  });
  const exp = useExport();
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Data" />
      <SGroup title="Your log">
        <Row
          className="s-wrap s-import-row has-tile"
          left={<Tile icon={Upload} />}
          title="Import"
          sub={importBundle.isPending ? 'Reading the file…' : importResult ? <span className={importResult.bad ? 's-bad' : ''}>{importResult.text}</span> : IMPORT_SUB}
          onClick={() => !importBundle.isPending && fileRef.current?.click()}
          label="Import a file"
        />
        <Row
          className="s-wrap s-export-row has-tile"
          left={<Tile icon={Download} />}
          title="Export"
          sub={exp.busy ?? (exp.result ? <span className={exp.result.bad ? 's-bad' : ''}>{exp.result.text}</span> : EXPORT_SUB)}
          onClick={() => void exp.run()}
          label="Export my data"
          aria-live="polite"
        />
      </SGroup>
      <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && importBundle.mutate(e.target.files[0])} />
    </div>
  );
};

/**
 * Sign out: the Settings root's action pill and the Account page's. The call names this phone's Apple Health connection
 * (Contract 3), so the server revokes its upload token with the session. The shell then wipes what the account kept on
 * the device. A failure says so in a toast.
 */
export const useSignOut = () => {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => {
      const healthTokenId = healthDeviceId();
      return api('/auth/logout', healthTokenId ? { method: 'POST', json: { healthTokenId } } : { method: 'POST' });
    },
    onSuccess: () => markSignedOut(qc),
    onError: () => {
      haptics.error();
      toast('Couldn’t sign out. Check your connection.');
    },
  });
};

/**
 * Sign out asks first (both pills, the root's and the Account page's): the sheet names the account and, when this phone
 * still holds changes the server has not had, says they would be lost.
 */
const SignOutSheet = (): React.JSX.Element => {
  const boot = useBootstrap();
  const sheet = useSheet();
  const signOut = useSignOut();
  const [unsent, setUnsent] = useState(() => outbox.size());
  useEffect(() => {
    const off = outbox.subscribe(setUnsent);
    return () => void off();
  }, []);
  const warn = unsentWords(unsent);
  return (
    <div className="s-del">
      <div className="s-del-lede s-signout-lede">
        <p>{signOutLede(boot.data?.user.email)}</p>
        {warn ? (
          <p className="s-signout-warn" role="status">
            {warn}
          </p>
        ) : null}
      </div>
      <div className="s-del-actions">
        <Button variant="primary" block onClick={() => signOut.mutate()} disabled={signOut.isPending}>
          {signOut.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
        <Button variant="quiet" block onClick={() => sheet.close()}>
          Stay signed in
        </Button>
      </div>
    </div>
  );
};
/** Opens the sign-out sheet. */
export const useConfirmSignOut = () => {
  const sheet = useSheet();
  return () => sheet.open({ eyebrow: 'Account', title: 'Sign out?', body: <SignOutSheet /> });
};

/**
 * /settings/account: who is signed in, Change password, then Sign out as the secondary button and, 32 below it and alone at
 * the page's end, Delete account (a two-step sheet) as the destructive one (layout standard 2.9, 6.6). Sign out lives only
 * here: the Settings root's Account row opens this page.
 */
export const AccountPage = (): React.JSX.Element => {
  const boot = useBootstrap();
  const sheet = useSheet();
  const confirmSignOut = useConfirmSignOut();
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Account" />
      {/* who is signed in, then the two ways out: Sign out, and the one that loses everything alone at the end */}
      <SGroup title="Signed in as">
        <Row title={boot.data?.user.email ?? ' '} className="s-email-row s-wrap-title has-tile" left={<Tile icon={Mail} />} />
        <GoRow icon={KeyRound} title="Change password" onPress={() => sheet.open({ eyebrow: 'Account', title: 'Change password', body: <ChangePasswordPanel />, sticky: true })} />
      </SGroup>
      <div className="s-acct-actions">
        <Button variant="soft" block className="s-signout" onClick={confirmSignOut}>
          Sign out
        </Button>
        <Button variant="danger" block className="s-delete" onClick={() => sheet.open({ eyebrow: 'Account', title: 'Delete account', body: <DeleteStepOne /> })}>
          Delete account
        </Button>
      </div>
    </div>
  );
};
