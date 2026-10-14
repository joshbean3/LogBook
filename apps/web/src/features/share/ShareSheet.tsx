import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { dayTypeOf, defaultCaption, DRAW_MS, drawCard, H, loadFonts, renderCard, TEMPLATE_NAME, templatesFor, W, type ShareData, type Template } from './cards';
import { shareImage } from './shareOut';
import './share.css';

/**
 * One template, live. Draws once the fonts are in, still; the first time its card is the one in view, it plays its
 * entrance (the route draws, the numerals tick). After that it stays still, so swiping back and forth never replays it.
 */
const CardCanvas = ({ template, data, caption, active }: { template: Template; data: ShareData; caption: string; active: boolean }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const played = useRef(false);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!ctx) return;
    let alive = true;
    let raf = 0;
    void loadFonts().then(() => {
      if (!alive) return;
      const dur = reduce ? 0 : DRAW_MS[template];
      if (!active || played.current || !dur) {
        drawCard(ctx, template, data, { progress: 1, caption });
        return;
      }
      played.current = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        drawCard(ctx, template, data, { progress: p, caption });
        if (p < 1 && alive) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [template, data, caption, reduce, active]);
  return <canvas ref={ref} width={W} height={H} className="share-canvas" />;
};

/**
 * The share sheet: every template as a live 9:16 card in a carousel you swipe (it snaps card by card), the page dots under
 * it, the caption field when the card takes one, and Share as the one blue verb (Save beside it in ink). Tapping a dot or a
 * card that peeks in brings it to the middle.
 */
export const ShareSheet = ({ data, initial }: { data: ShareData; initial?: Template }) => {
  const toast = useToast();
  const reduce = useReducedMotion();
  // the cards follow the kind of day (a run, a lift, rest, a day of words); the lead card comes first. A caller's `initial`
  // is honoured when the day has that card; on a day that isn't a run the Day card leads (a Bubble asked for because there
  // were no Strava miles would hide "Rest" and the habits behind a chat bubble)
  const templates = useMemo(() => templatesFor(data), [data]);
  const start = Math.max(0, initial && !(initial === 'bubble' && dayTypeOf(data) !== 'run') ? templates.indexOf(initial) : 0);
  const [i, setI] = useState(start);
  const t = templates[i] ?? 'stamp';
  const [caption, setCaption] = useState(() => defaultCaption(data));
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const cur = useRef(start);

  // the card nearest the middle is the one in view; a step is one select tick
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    kids.forEach((k, n) => {
      const dd = Math.abs(k.offsetLeft + k.offsetWidth / 2 - mid);
      if (dd < dist) {
        dist = dd;
        best = n;
      }
    });
    if (best !== cur.current) {
      cur.current = best;
      haptics.select();
      setI(best);
    }
  };
  const go = (n: number) => {
    const el = track.current;
    const k = el?.children[n] as HTMLElement | undefined;
    if (!el || !k) return;
    el.scrollTo({ left: k.offsetLeft - (el.clientWidth - k.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  };
  useEffect(() => {
    if (start) requestAnimationFrame(() => go(start));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (mode: 'share' | 'save') => {
    setBusy(mode);
    try {
      const blob = await renderCard(t, data, caption);
      const r = await shareImage(blob, `logbook-${data.date}.png`, mode);
      if (r !== 'cancelled') haptics.success();
      if (r === 'saved') toast('Saved');
    } catch {
      haptics.error();
      toast('Couldn’t make the image. Try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="share">
      <div className="share-main">
        <div ref={track} className="share-track" role="group" aria-roledescription="carousel" aria-label="Card templates" onScroll={onScroll}>
          {templates.map((k, n) => (
            <button
              key={k}
              type="button"
              className={`share-slide ${n === i ? 'is-cur' : ''}`}
              aria-roledescription="slide"
              aria-label={`${TEMPLATE_NAME[k]} card, ${n + 1} of ${templates.length}${n === i ? ', in view' : ''}`}
              aria-current={n === i}
              onClick={() => (n === i ? undefined : go(n))}
            >
              <span className="share-card">
                <CardCanvas template={k} data={data} caption={caption} active={n === i} />
              </span>
            </button>
          ))}
        </div>
        <div className="share-pager">
          <span className="share-name">{TEMPLATE_NAME[t]}</span>
          <span className="share-dots" role="tablist" aria-label="Templates">
            {templates.map((k, n) => (
              <button key={k} type="button" role="tab" aria-selected={n === i} aria-label={TEMPLATE_NAME[k]} className={`share-dot ${n === i ? 'on' : ''}`} onClick={() => go(n)}>
                <i />
              </button>
            ))}
          </span>
        </div>
        {/* the caption sits right under the card it writes on, never under the footer */}
        {t === 'bubble' ? <input className="in share-caption" value={caption} maxLength={80} aria-label="Caption" placeholder="Say something" onChange={(e) => setCaption(e.target.value)} /> : null}
      </div>
      <div className="sheet-foot">
        <Button variant="quiet" disabled={!!busy} onClick={() => run('save')}>
          {busy === 'save' ? 'Saving' : 'Save'}
        </Button>
        <div className="foot-right">
          <Button variant="primary" disabled={!!busy} onClick={() => run('share')}>
            {busy === 'share' ? 'Sharing' : 'Share'}
          </Button>
        </div>
      </div>
    </div>
  );
};
