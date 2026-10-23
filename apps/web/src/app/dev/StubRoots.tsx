import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStravaChecking } from '@/api/queries';
import { useQueryClient } from '@tanstack/react-query';
import { stravaSyncNow } from '@/api/queries';
import { PushedBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import type { TabId } from '@/ui/nav';
import { useHomeControl, useNav, useRootRequest, useRouteParams, useTab } from '../NavController';

/**
 * Test-only stub tab roots and a stub pushed page (built only with VITE_FAKE_CLOCK, loaded only with `?stubs=1`): they let
 * the WP1 acceptance scripts drive jumps, root requests, tab scopes, sheets, menus, toasts and the router bridge without
 * depending on the pages other packages are rebuilding.
 */
type Win = Window & { __rootRequests?: unknown[]; __navOf?: Partial<Record<TabId, ReturnType<typeof useNav>>> };
const w = window as Win;
w.__rootRequests ??= [];
w.__navOf ??= {};

const Probe = () => {
  // the sheet body: its tab, its nav and its toast must all work (contracts §C.1)
  const tab = useTab();
  const nav = useNav();
  const toast = useToast();
  return (
    <div className="stub-probe" data-tab={tab} data-active={nav.getState().active}>
      <span className="stub-probe-tab">{tab}</span>
      <button type="button" className="stub-toast" onClick={() => toast(`toast from ${tab}`)}>
        Toast
      </button>
      <button type="button" className="stub-go-plan" onClick={() => nav.go('/plan/week/2026-10-26')}>
        Open in Plan
      </button>
    </div>
  );
};
const ProbeAction = ({ className = 'stub-action' }: { className?: string }) => {
  const tab = useTab();
  useToast();
  useNav().getState();
  return <span className={className} data-tab={tab} />;
};

const Filler = ({ n = 40 }: { n?: number }) => (
  <div className="stub-filler">
    {Array.from({ length: n }, (_, i) => (
      <p key={i} style={{ height: 44, margin: 0, borderTop: '1px solid var(--line)', padding: '10px 16px' }}>
        Row {i + 1}
      </p>
    ))}
  </div>
);

export const StubRoot = ({ tab }: { tab: TabId }) => {
  const nav = useNav();
  w.__navOf![tab] = nav;
  const first = useRouteParams();
  const [params, setParams] = useState<Readonly<Record<string, string>>>(first);
  useRootRequest((p, how) => {
    w.__rootRequests!.push({ tab, params: p, cut: how.cut, at: performance.now() });
    setParams(p);
  });
  useHomeControl({ atHome: !Object.keys(params).length, goHome: () => setParams({}) });
  const sheet = useSheet();
  const toast = useToast();
  const navigate = useNavigate();
  const checking = useStravaChecking();
  const qc = useQueryClient();
  return (
    <div className="page stub-root" data-stub={tab} data-params={JSON.stringify(params)}>
      <h1 className="stub-title" style={{ margin: '8px 16px', font: '600 28px/34px var(--sans)' }}>
        {tab} {params.date ?? params.mon ?? params.month ?? ''}
      </h1>
      <div className="stub-probe-sync" data-syncing={checking ? 'true' : 'false'} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px' }}>
        <button type="button" className="stub-push-settings" style={{ minHeight: 44 }} onClick={() => nav.push('/settings')}>
          Push Settings
        </button>
        <button type="button" className="stub-push-shared" style={{ minHeight: 44 }} onClick={() => nav.push('/dev/ui', { shared: 'stub-line' })}>
          Push shared
        </button>
        <button type="button" className="stub-open-sheet" style={{ minHeight: 44 }} onClick={() => sheet.open({ title: `Sheet on ${tab}`, body: <Probe />, action: <ProbeAction />, header: <ProbeAction className="stub-header" /> })}>
          Open sheet
        </button>
        <button type="button" className="stub-rr-settings" style={{ minHeight: 44 }} onClick={() => navigate('/settings')}>
          rr settings
        </button>
        <button type="button" className="stub-rr-reads" style={{ minHeight: 44 }} onClick={() => navigate('/journal/reads')}>
          rr reads
        </button>
        <button type="button" className="stub-rr-replace" style={{ minHeight: 44 }} onClick={() => navigate('/today/2026-10-24', { replace: true })}>
          rr replace
        </button>
        <button type="button" className="stub-sync-quiet" style={{ minHeight: 44 }} onClick={() => void stravaSyncNow(qc, { force: true, quiet: true })}>
          quiet sync
        </button>
        <input className="stub-input" placeholder="Type here" style={{ minHeight: 44, width: '100%' }} />
      </div>
      <div data-shared="stub-line" className="stub-line" style={{ margin: '12px 16px', height: 44, background: 'var(--accent)', borderRadius: 12, width: 200 }} />
      <Pressable
        as="div"
        className="stub-row"
        style={{ minHeight: 60, margin: '8px 16px', background: 'var(--surface)', borderRadius: 12, display: 'grid', placeItems: 'center' }}
        onPress={() => toast('row tapped')}
        holdMenu={[
          { label: 'Toast', onSelect: () => toast(`menu toast from ${tab}`) },
          { label: 'Sheet', onSelect: () => sheet.open({ title: 'From the menu', body: <Probe /> }) },
        ]}
      >
        Hold me
      </Pressable>
      <Filler />
    </div>
  );
};

/** A stub pushed page (the flyer's destination). */
export const StubPushed = () => (
  <div className="page" style={{ background: 'rgb(20, 40, 60)', minHeight: '100%' }}>
    <PushedBar title="Stub" />
    <div data-shared="stub-line" className="stub-line" style={{ margin: '40px 16px', height: 88, background: 'var(--accent)', borderRadius: 12, width: 300 }} />
    <Filler n={10} />
  </div>
);
