import { Check, ChevronRight, Plus } from 'lucide-react';
import { animate, useReducedMotion } from 'motion/react';
import { Children, createContext, isValidElement, useContext, useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { reducedFade, springs } from '@/lib/motion';
import { useNowMark } from '@/ui/nowBudget';
import { Pressable } from '@/ui/Pressable';
import { pathSegments, type Segment, type StopSegments, type StopState } from './logic';
import './poster.css';

const Segs = createContext<StopSegments | null>(null);

export interface PathStopProps {
  /** done: a filled check, the line behind it solid. next: the one lit stop. ahead: an open ring. add: a plus ring, the end of the line. */
  state: StopState;
  /** The stop's words. */
  title?: ReactNode;
  /** A caption over the title, in caps and quiet: "Tomorrow · Fri 13". */
  caption?: ReactNode;
  /** The tag over a next stop's title, in the now color: "Next". It takes the caption's place. */
  tag?: ReactNode;
  /** A quieter line under the title: "Z2, conversational". */
  subtitle?: ReactNode;
  /** A control at the row's end, outside the row's own button: `<PathCheck>`, a link. */
  trailing?: ReactNode;
  /** Draw a chevron at the row's end (a row that opens something). */
  chevron?: boolean;
  /** The row (node and words) is a button. */
  onPress?: () => void;
  /** The row button's VoiceOver label. Default: its words (a done stop says "Done" first). */
  label?: string;
  /** In place of the words: the stop's own content (the "Set this goal" actions). The row is then not highlighted. */
  children?: ReactNode;
  /** ring: the 24 pt ring (to-dos). dot: a small Deep Sky ring (a day on Fitness). Default ring. */
  node?: 'ring' | 'dot';
  /** Strike the title through. Default: done stops. */
  struck?: boolean;
  /** The Cloud ground behind the row. Default: a next stop with words. */
  highlight?: boolean;
  /** A stable name for the stop (the to-do's id): the light moves when the next stop's id changes. Default: its place in the line. */
  id?: string;
  /** Set the line yourself (a stop wrapped in another component cannot be seen by PathLine). See `pathSegments`. */
  lineIn?: Segment;
  lineOut?: Segment;
}

/** One stop on the path. Use inside `<PathLine>`. */
export const PathStop = ({ state, title, caption, tag, subtitle, trailing, chevron, onPress, label, children, node = 'ring', struck, highlight, id, lineIn, lineOut }: PathStopProps) => {
  const seg = useContext(Segs);
  // the light is one of the screen's three now marks; past the budget it yields to Night Ink
  const paint = useNowMark('pointer', state === 'next');
  const strike = struck ?? state === 'done';
  const hl = highlight ?? (state === 'next' && children == null);
  const words = children ?? (
    <span className="pth-text">
      {tag ? <span className="pth-tag">{tag}</span> : caption ? <span className="pth-cap">{caption}</span> : null}
      <span className={`pth-title${strike ? ' is-struck' : ''}`}>
        {state === 'done' && !label ? <span className="sr-only">Done: </span> : null}
        {title}
      </span>
      {subtitle ? <span className="pth-sub">{subtitle}</span> : null}
    </span>
  );
  const end = chevron ? <ChevronRight className="pth-chev" size={18} aria-hidden="true" /> : null;
  return (
    <li className={`pth-stop is-${state} in-${lineIn ?? seg?.in ?? 'none'} out-${lineOut ?? seg?.out ?? 'none'}${node === 'dot' ? ' is-dot' : ''}${hl ? ' is-hl' : ''}${trailing ? ' has-end' : ''}`} data-stop={id}>
      <span className="pth-node" aria-hidden="true">
        {state === 'done' && node === 'ring' ? <Check size={14} strokeWidth={3} /> : null}
        {state === 'add' ? <Plus size={16} /> : null}
        {state === 'next' ? (
          <span className="pth-lit" data-now={paint === 'ink' ? 'ink' : undefined}>
            <span className="pth-halo" />
            <span className="pth-disc" />
            <span className="pth-light" />
          </span>
        ) : null}
      </span>
      {onPress ? (
        <Pressable className="pth-main" press="surface" label={label} onPress={() => onPress()}>
          {words}
          {end}
        </Pressable>
      ) : (
        <div className="pth-main" aria-label={label}>
          {words}
          {end}
        </div>
      )}
      {trailing ? <span className="pth-end">{trailing}</span> : null}
    </li>
  );
};

export interface PathLineProps {
  /** `<PathStop>` elements, top to bottom. Anything else is rendered as it is (wrap it in an `<li>`). */
  children: ReactNode;
  /** The line starts at the edge above the first stop (the poster's band, a card's top). Default true. */
  lead?: boolean;
  /** The list's accessible name: "To-dos", "The days ahead". */
  label?: string;
  className?: string;
}

const isStop = (k: unknown): k is ReactElement<PathStopProps> => isValidElement(k) && k.type === PathStop;

/**
 * The path: one line of stops. It is solid behind the next stop and dotted ahead, runs unbroken through rows of any
 * height, and can start at the band above it. PathLine reads its `<PathStop>` children's states and draws each stretch
 * (`pathSegments`). When the next stop changes, the light moves from the old stop to the new one (transform only;
 * under Reduce Motion a short fade).
 */
export const PathLine = ({ children, lead = true, label, className = '' }: PathLineProps) => {
  const kids = Children.toArray(children);
  const segs = pathSegments(kids.filter(isStop).map((k) => k.props.state), { lead });
  const ref = useRef<HTMLUListElement>(null);
  const last = useRef<{ key: string; y: number } | null>(null);
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const root = ref.current;
    const lit = root?.querySelector<HTMLElement>('.pth-lit');
    const stop = lit?.closest<HTMLElement>('.pth-stop');
    if (!root || !lit || !stop) {
      last.current = null;
      return;
    }
    const key = stop.dataset.stop ?? `#${Array.from(root.children).indexOf(stop)}`;
    const y = stop.offsetTop + stop.offsetHeight / 2;
    const was = last.current;
    last.current = { key, y };
    if (!was || was.key === key) return;
    if (reduce) void animate(lit, { opacity: [0, 1] }, reducedFade);
    else if (was.y !== y) void animate(lit, { y: [was.y - y, 0] }, springs.settle);
  });
  let i = 0;
  return (
    <ul ref={ref} className={`pth ${className}`.trim()} aria-label={label}>
      {kids.map((k) =>
        isStop(k) ? (
          <Segs.Provider key={k.key} value={segs[i++] ?? null}>
            {k}
          </Segs.Provider>
        ) : (
          k
        ),
      )}
    </ul>
  );
};

export interface PathCheckProps {
  checked?: boolean;
  onPress: () => void;
  /** What VoiceOver says: "Email Alex about the race, done". */
  label: string;
}

/** The check at a stop's end: a 48 pt Paper coin. Checked, it fills Deep Sky. */
export const PathCheck = ({ checked = false, onPress, label }: PathCheckProps) => (
  <Pressable className={`pth-check${checked ? ' is-on' : ''}`} label={label} aria-pressed={checked} onPress={() => onPress()}>
    <Check size={22} aria-hidden="true" />
  </Pressable>
);
