import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSplashDoneOnPaint } from '@/lib/native';
import { useFitness } from '@/lib/prefs';
import { Pressable } from '@/ui';
import { backAction, TOUR_HOME, tourExit } from './route';
import { Tour } from './Tour';
import '../onboarding.css';

/**
 * "How Orby works" as a screen of its own: full screen, like first run, with the same bar (Back at the left, Skip tour at
 * the right), the tour's pages, its dots and its button. Back turns to the page before, and on the first page leaves; Skip
 * tour and the last page's button leave too. Leaving is the caller's (`onClose`): the tour ends where it was opened from.
 * Nothing is saved and nothing is changed by it.
 */
export const TourScreen = ({ onClose, fitness = true, doneLabel = 'Done' }: { onClose: () => void; /** false: Fitness is off, so the tour has no Fitness page */ fitness?: boolean; /** the last page's button */ doneLabel?: string }): React.JSX.Element => {
  useSplashDoneOnPaint();
  const [page, setPage] = useState(0);
  const main = useRef<HTMLElement>(null);
  // the arrival: VoiceOver's focus goes to the first page's heading (a page turn moves it itself)
  useEffect(() => {
    const id = setTimeout(() => main.current?.querySelector<HTMLElement>('.tour-title')?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(id);
  }, []);
  // Escape leaves, as it closes a sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const turn = backAction(page) === 'turn';
  return (
    <main ref={main} className="ob tour-screen" aria-label="How Orby works">
      <span className="ob-halo" aria-hidden="true" />
      <header className="ob-bar ob-top">
        <span className="ob-slot">
          <button type="button" className="icon-btn ob-back" aria-label={turn ? 'Back' : 'Close'} onClick={turn ? () => setPage(page - 1) : onClose}>
            <ChevronLeft size={26} aria-hidden="true" />
          </button>
        </span>
        <span aria-hidden="true" />
        <span className="ob-slot end">
          <Pressable className="ob-skip" press="dim" onPress={onClose}>
            Skip tour
          </Pressable>
        </span>
      </header>
      <div className="ob-swipe">
        <div className="ob-stage">
          <Tour page={page} onPage={setPage} onDone={onClose} doneLabel={doneLabel} fitness={fitness} />
        </div>
      </div>
    </main>
  );
};

/**
 * The tour's own address, `/welcome/how` (App.tsx): opened from Settings and from the end of first run. It ends where it
 * was opened from: one step back when the opener said so (`tourFrom()`), else Today.
 */
export default function TourRoute(): React.JSX.Element {
  const nav = useNavigate();
  const loc = useLocation();
  const fitness = useFitness();
  const exit = tourExit(loc.state);
  const left = useRef(false);
  const close = () => {
    // one leave, however many taps
    if (left.current) return;
    left.current = true;
    if (exit === 'back') void nav(-1);
    else void nav(TOUR_HOME, { replace: true });
  };
  return <TourScreen onClose={close} fitness={fitness} />;
}
