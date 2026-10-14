import type { Quote } from '@logbook/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { springs, useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Segmented, TAB_RESELECT, TabHeader, type TabReselectDetail } from '@/ui';
import { addToDraft } from './JournalDaySection';
import { asPrompt, JournalHome } from './JournalHome';
import { Library, LibrarySearchButton, useOpenQuote } from './Library';
import './journal.css';

type Seg = 'journal' | 'library';
const ORDER: Record<Seg, number> = { journal: 0, library: 1 };

/**
 * Journal (docs/experience.md §5.5). Two segments under the header, Journal · Library; the content slides the way the
 * switch moved. Journal: write first, memory second, every entry last. Library: the fuel (Reads, favourites, your quotes,
 * the quote library). `/journal/library` is the library; the old `/journal/quotes` and `/journal/favorites` land on it,
 * scrolled to that section.
 */
export default function JournalView() {
  const params = useParams();
  const nav = useNavigate();
  const today = useToday();
  const reduce = useReduced();
  const seg: Seg = params.tab === 'library' || params.tab === 'quotes' || params.tab === 'favorites' ? 'library' : 'journal';
  const focus = params.tab === 'quotes' || params.tab === 'favorites' ? params.tab : null;
  const prev = useRef(seg);
  const dir = ORDER[seg] - ORDER[prev.current] || 0;
  useEffect(() => {
    prev.current = seg;
  }, [seg]);
  const [focusComposer, setFocusComposer] = useState(false);

  const go = (s: Seg) => {
    if (window.scrollY > 120) window.scrollTo({ top: 0 });
    nav(s === 'journal' ? '/journal' : '/journal/library', { replace: true });
  };
  // the lit tab tapped again at the top: back to writing
  useEffect(() => {
    const f = (e: Event) => (e as CustomEvent<TabReselectDetail>).detail.atTop && go('journal');
    window.addEventListener(TAB_RESELECT, f);
    return () => window.removeEventListener(TAB_RESELECT, f);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /** "Write about it" from the library (or a quote's sheet): the quote goes on top of today's draft, and the composer opens. */
  const writeAbout = (q: Quote) => {
    addToDraft(today, asPrompt(q));
    setFocusComposer(true);
    go('journal');
  };
  /** "Open in library" on the quote line: the library, with that quote's sheet up. */
  const openQuote = useOpenQuote(writeAbout);
  const openInLibrary = (q: Quote) => {
    go('library');
    setTimeout(() => openQuote(q), reduce ? 160 : 360);
  };
  useEffect(() => {
    if (!focusComposer || seg !== 'journal') return;
    const t = setTimeout(() => setFocusComposer(false), 600);
    return () => clearTimeout(t);
  }, [focusComposer, seg]);

  const variants = {
    enter: (d: number) => (reduce || !d ? { opacity: 0 } : { opacity: 0, x: `${d * 30}%` }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce || !d ? { opacity: 0 } : { opacity: 0, x: `${d * -30}%` }),
  };
  return (
    <div className="page journal-page">
      <TabHeader title="Journal" accessory={seg === 'library' ? <LibrarySearchButton onWrite={writeAbout} /> : null}>
        <Segmented
          className="j-seg"
          label="Journal or library"
          options={[
            ['journal', 'Journal'],
            ['library', 'Library'],
          ]}
          value={seg}
          onChange={go}
        />
      </TabHeader>
      <div className="j-stage">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={seg}
            className="j-pane"
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.15 } : { x: springs.page, opacity: { duration: 0.12 } }}
          >
            {seg === 'journal' ? <JournalHome today={today} onOpenQuote={openInLibrary} focusOnMount={focusComposer} /> : <Library focus={focus} onWrite={writeAbout} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
