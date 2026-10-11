import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, ChipButton } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { defaultCaption, DRAW_MS, drawCard, H, loadFonts, renderCard, TEMPLATE_NAME, TEMPLATES, W, type ShareData, type Template } from './cards';
import { shareImage } from './shareOut';
import './share.css';

/** One template, live. Draws once the fonts are in; the first show animates (route draws, numerals tick), after that it is still. */
const CardCanvas = ({ template, data, caption }: { template: Template; data: ShareData; caption: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const settled = useRef(false);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!ctx) return;
    let alive = true;
    let raf = 0;
    void loadFonts().then(() => {
      if (!alive) return;
      const dur = reduce ? 0 : DRAW_MS[template];
      if (settled.current || !dur) {
        settled.current = true;
        drawCard(ctx, template, data, { progress: 1, caption });
        return;
      }
      settled.current = true;
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
  }, [template, data, caption, reduce]);
  return <canvas ref={ref} width={W} height={H} className="share-canvas" role="img" aria-label={`${TEMPLATE_NAME[template]} card`} />;
};

/** The share sheet: a 9:16 card, the caption under it when the card takes one, the templates in one scrolling row, Share and Save. */
export const ShareSheet = ({ data, initial }: { data: ShareData; initial?: Template }) => {
  const toast = useToast();
  const templates = useMemo(() => TEMPLATES.filter((t) => (t !== 'route' || !!data.polyline) && (t !== 'week' || !!data.week)), [data]);
  const [t, setT] = useState<Template>(initial && templates.includes(initial) ? initial : (templates[0] ?? 'stamp'));
  const [caption, setCaption] = useState(() => defaultCaption(data));
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const run = async (mode: 'share' | 'save') => {
    setBusy(mode);
    try {
      const blob = await renderCard(t, data, caption);
      const r = await shareImage(blob, `logbook-${data.date}.png`, mode);
      if (r === 'saved') toast('Saved');
    } catch {
      toast('Couldn’t make the image. Try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="share">
      <div className="share-main">
        <div className="share-stage">
          <AnimatePresence initial={false}>
            <motion.div key={t} className="share-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <CardCanvas template={t} data={data} caption={caption} />
            </motion.div>
          </AnimatePresence>
        </div>
        {/* the caption sits right under the card it writes on, never under the footer */}
        {t === 'bubble' ? <input className="in share-caption" value={caption} maxLength={80} aria-label="Caption" placeholder="Say something" onChange={(e) => setCaption(e.target.value)} /> : null}
        <div className="share-templates" role="radiogroup" aria-label="Template">
          {templates.map((k) => (
            <ChipButton key={k} role="radio" aria-checked={t === k} on={t === k} onClick={() => setT(k)}>
              {TEMPLATE_NAME[k]}
            </ChipButton>
          ))}
        </div>
      </div>
      <div className="sheet-foot">
        <Button variant="ghost" disabled={!!busy} onClick={() => run('save')}>
          {busy === 'save' ? 'Saving…' : 'Save'}
        </Button>
        <div className="foot-right">
          <Button variant="primary" disabled={!!busy} onClick={() => run('share')}>
            {busy === 'share' ? 'Sharing…' : 'Share'}
          </Button>
        </div>
      </div>
    </div>
  );
};
