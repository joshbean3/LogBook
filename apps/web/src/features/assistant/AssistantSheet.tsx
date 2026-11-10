import { fmtDate, PHASE_WORDS, screenLabel, type AssistantLive, type AssistantScreen, type AssistantTurn, type ISODate } from '@logbook/shared';
import { Orb } from '@/ui/Orb';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Copy,
  FileText,
  History,
  Lightbulb,
  Pencil,
  Plus,
  RotateCw,
  Share,
  Square,
  SquarePen,
  Sun,
  Target,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { onUnauthorized } from '@/api/client';
import { useBootstrap } from '@/api/queries';
import { AI_LABEL, DISCLAIMER } from '@/lib/copy';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { isNative } from '@/lib/native';
import { useToday } from '@/lib/useToday';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { ATTACHMENT_LIMITS, type AssistantFileShown } from '@logbook/shared';
import { askAssistant, stopAssistant, waitForJob } from './api';
import { AttachError, prepareFile, type PreparedFile } from './attach';
import { editTurn, regenerate, resumeAsk, retryAsk, runAsk, sendTurn, stopAsk } from './conversation';
import { attachNoteSeen, markAttachNoteSeen } from './attachNote';
import { HistoryPanel } from './History';
import { plainOf } from './plain';
import { AssistantPermission, useAssistantGate } from './Permission';
import { ProposalCard } from './Proposal';
import { Rich } from './Rich';
import { assistantStore, useAssistantBusy, useAssistantBusyChat, useAssistantChatId, useAssistantChats, useAssistantLive, useAssistantOffline, useAssistantStopped, useAssistantTurns } from './store';
import './assistant.css';

/** The files a turn carried, as the thread shows them: a photo's preview, a PDF's name. */
const TurnFiles = ({ files }: { files: AssistantFileShown[] }) => (
  <div className="as-turn-files">
    {files.map((f, i) =>
      f.thumb ? (
        <img key={i} className="as-turn-photo" src={f.thumb} alt={f.name} />
      ) : (
        <span key={i} className="as-turn-doc">
          <FileText size={15} aria-hidden="true" />
          <span>{f.name}</span>
        </span>
      ),
    )}
  </div>
);

const SCREEN_ICON: Record<AssistantScreen['tab'], LucideIcon> = { today: Sun, plan: CalendarDays, progress: Activity, goals: Target, learned: Lightbulb, journal: BookOpen };

/** Ways to start an empty chat: two lines each (what, then the rest), as ChatGPT's starter cards read. */
type Starter = { title: string; sub: string; send?: string; attach?: true };
const startersFor = (date: ISODate, today: ISODate): Starter[] => {
  const run = date === today ? 'today’s run' : `${fmtDate('short', date)}’s run`;
  return [
    { title: 'What’s left', sub: 'on the plan this week', send: 'What’s left on the plan this week?' },
    { title: 'Push missed runs', sub: 'to next week', send: 'Push the runs I missed this week to next week' },
    { title: `Move ${run}`, sub: 'to the next day', send: `Move ${run} to the next day` },
    { title: 'Set this week’s goal', sub: 'from my plan', send: 'Set this week’s goal from my plan' },
    { title: 'Read a plan', sub: 'from a photo or a PDF', attach: true },
  ];
};

const greeting = (h = new Date().getHours()) => (h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');

/** Seconds since `since`, ticking once a second while shown. */
const useSeconds = (since: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.floor((now - since) / 1000));
};

/**
 * The words as they arrive, revealed smoothly: the server's text comes in chunks a third of a second apart; this lets
 * the shown text catch up a few characters a frame, so it flows instead of jumping.
 */
const useSmoothText = (target: string) => {
  const [n, setN] = useState(target.length);
  const want = useRef(target);
  want.current = target;
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setN((cur) => {
        const goal = want.current.length;
        if (cur > goal) return goal;
        if (cur === goal) return cur;
        return Math.min(goal, cur + Math.max(1, Math.ceil((goal - cur) / 9)));
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return target.slice(0, Math.min(n, target.length));
};

/**
 * How it got to the answer (Claude's and ChatGPT's fold above a reply): "Thought for 7s ›" opens the steps it took
 * ("Read your plan, Nov 2 to Nov 8") and its reasoning. Nothing shows for an answer that took no time and no steps.
 */
const Process = ({ thoughts, seconds, steps }: { thoughts?: string; seconds?: number; steps?: string[] }) => {
  const [open, setOpen] = useState(false);
  const secs = Math.max(1, seconds ?? 0);
  if (!thoughts && !steps?.length && (seconds ?? 0) < 2) return null;
  return (
    <div className={`as-process${open ? ' is-open' : ''}`}>
      <button type="button" className="as-process-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {thoughts ? `Thought for ${secs}s` : steps?.length ? `${steps.length === 1 ? steps[0] : `${steps.length} steps`} · ${secs}s` : `Worked for ${secs}s`}
        <ChevronRight size={15} strokeWidth={2.4} aria-hidden="true" />
      </button>
      {open ? (
        <div className="as-process-body">
          {steps?.map((s, i) => (
            <p key={i} className="as-step">
              <Check size={14} strokeWidth={2.6} aria-hidden="true" />
              {s}
            </p>
          ))}
          {thoughts ? <p className="as-thought-text">{thoughts}</p> : null}
          <p className="as-step is-done">
            <Check size={14} strokeWidth={2.6} aria-hidden="true" />
            Done
          </p>
        </div>
      ) : null}
    </div>
  );
};

/**
 * The answer while it is written: what it is doing now with the seconds running ("Reading your plan · 4s", light passing
 * over the words), the steps so far, the latest line of its reasoning; then its words fading in one by one behind a dot.
 * Before anything comes back it says Thinking. After 20 s a line says closing is fine.
 */
const LiveAnswer = ({ since, live }: { since: number; live: AssistantLive | null }) => {
  const secs = useSeconds(since);
  const text = useSmoothText(live?.text ?? '');
  const offline = useAssistantOffline();
  const [open, setOpen] = useState(false);
  const phase = live?.phase ?? 'thinking';
  const writing = text.length > 0;
  const lastThought = (live?.thoughts ?? '').trim().split(/\n+/).pop() ?? '';
  return (
    <div className="as-turn is-assistant is-live" aria-busy="true">
      {writing ? (
        <Process thoughts={live?.thoughts} seconds={live?.seconds ?? secs} steps={live?.steps} />
      ) : (
        <div className="as-working">
          <button type="button" className="as-phase" aria-expanded={open} onClick={() => setOpen((v) => !v)} disabled={!live?.thoughts && !live?.steps?.length}>
            <Orb size={18} state="think" className="as-orb" />
            <span className="as-shimmer" aria-live="polite">
              {PHASE_WORDS[phase]}
            </span>
            <span className="as-phase-secs">{secs}s</span>
            {live?.thoughts || live?.steps?.length ? <ChevronDown size={14} strokeWidth={2.4} className="as-phase-chev" aria-hidden="true" /> : null}
          </button>
          {live?.steps?.map((s, i) => (
            <p key={i} className="as-step is-new">
              <Check size={14} strokeWidth={2.6} aria-hidden="true" />
              {s}
            </p>
          ))}
          {open && live?.thoughts ? <p className="as-thought-text">{live.thoughts}</p> : lastThought ? <p className="as-thought-line">{lastThought}</p> : null}
          {offline ? <p className="as-slow">Waiting for a connection.</p> : null}
          {secs >= 20 && !offline ? <p className="as-slow">Still working. A plan from photos can take a minute or two. You can close this and come back.</p> : null}
        </div>
      )}
      {writing ? (
        <div className="as-answer">
          <Rich text={text} fade after={<span className="as-caret" aria-hidden="true" />} />
        </div>
      ) : null}
    </div>
  );
};

/** One speaker for the whole chat: Read aloud on one answer stops any other. */
const useSpeaker = () => {
  const [speaking, setSpeaking] = useState<number | null>(null);
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => void (ok && window.speechSynthesis.cancel()), [ok]);
  const toggle = useCallback(
    (i: number, text: string) => {
      if (!ok) return;
      window.speechSynthesis.cancel();
      if (speaking === i) return setSpeaking(null);
      const u = new SpeechSynthesisUtterance(plainOf(text));
      u.rate = 1.02;
      u.onend = u.onerror = () => setSpeaking((s) => (s === i ? null : s));
      setSpeaking(i);
      window.speechSynthesis.speak(u);
    },
    [ok, speaking],
  );
  return { speaking, toggle, ok };
};

const shareText = async (text: string) => {
  if (isNative) {
    const { Share: S } = await import('@capacitor/share');
    await S.share({ text });
    return true;
  }
  if (navigator.share) {
    await navigator.share({ text });
    return true;
  }
  return false;
};

/** Under a finished answer, as ChatGPT lays them out: Copy, Read aloud, thumbs, Share, and Ask again on the newest. */
const AnswerActions = ({ t, index, newest, speaker, onRegenerate }: { t: AssistantTurn; index: number; newest: boolean; speaker: ReturnType<typeof useSpeaker>; onRegenerate: () => void }) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainOf(t.text));
      haptics.select();
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast('Couldn’t copy that.');
    }
  };
  const share = async () => {
    try {
      if (!(await shareText(plainOf(t.text)))) await copy();
    } catch {
      /* the owner closed the share sheet */
    }
  };
  const rate = (r: 'up' | 'down') => {
    haptics.select();
    assistantStore.rate(index, r);
    if (t.rating !== r) toast(r === 'up' ? 'Thanks. Glad that helped.' : 'Thanks. Ask again or tell it what was off.');
  };
  const speaking = speaker.speaking === index;
  return (
    <div className="as-actions" role="group" aria-label="Answer actions">
      <button type="button" className="as-act" aria-label={copied ? 'Copied' : 'Copy'} onClick={() => void copy()}>
        {copied ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : <Copy size={16} strokeWidth={2.1} aria-hidden="true" />}
      </button>
      {speaker.ok ? (
        <button type="button" className={`as-act${speaking ? ' is-on' : ''}`} aria-label={speaking ? 'Stop reading' : 'Read aloud'} aria-pressed={speaking} onClick={() => speaker.toggle(index, t.text)}>
          {speaking ? <VolumeX size={16} strokeWidth={2.1} aria-hidden="true" /> : <Volume2 size={16} strokeWidth={2.1} aria-hidden="true" />}
        </button>
      ) : null}
      {t.rating !== 'down' ? (
        <button type="button" className={`as-act${t.rating === 'up' ? ' is-on' : ''}`} aria-label="Good answer" aria-pressed={t.rating === 'up'} onClick={() => rate('up')}>
          <ThumbsUp size={16} strokeWidth={2.1} fill={t.rating === 'up' ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ) : null}
      {t.rating !== 'up' ? (
        <button type="button" className={`as-act${t.rating === 'down' ? ' is-on' : ''}`} aria-label="Bad answer" aria-pressed={t.rating === 'down'} onClick={() => rate('down')}>
          <ThumbsDown size={16} strokeWidth={2.1} fill={t.rating === 'down' ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" className="as-act" aria-label="Share" onClick={() => void share()}>
        <Share size={16} strokeWidth={2.1} aria-hidden="true" />
      </button>
      {newest ? (
        <button type="button" className="as-act" aria-label="Ask again" onClick={onRegenerate}>
          <RotateCw size={16} strokeWidth={2.1} aria-hidden="true" />
        </button>
      ) : null}
      {t.stopped ? <span className="as-stopped">Stopped</span> : null}
    </div>
  );
};

/** The owner's words: a soft bubble at the right. A tap shows Copy and Edit under it (ChatGPT's message menu). */
const UserTurn = ({ t, canEdit, onEdit }: { t: AssistantTurn; canEdit: boolean; onEdit: () => void }) => {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      {t.files?.length ? <TurnFiles files={t.files} /> : null}
      {t.text ? (
        <button type="button" className={`as-bubble${open ? ' is-open' : ''}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {t.text}
        </button>
      ) : null}
      {open ? (
        <div className="as-user-actions">
          <button
            type="button"
            className="as-act"
            aria-label="Copy"
            onClick={() => {
              void navigator.clipboard.writeText(t.text).then(
                () => haptics.select(),
                () => toast('Couldn’t copy that.'),
              );
              setOpen(false);
            }}
          >
            <Copy size={16} strokeWidth={2.1} aria-hidden="true" />
          </button>
          {canEdit ? (
            <button
              type="button"
              className="as-act"
              aria-label="Edit"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              <Pencil size={16} strokeWidth={2.1} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

/** The waiting proposal, when it has scrolled out of view: a bar over the composer that brings it back. */
const useOutOfView = (el: HTMLElement | null) => {
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === 'undefined') return setOut(false);
    const root = el.closest<HTMLElement>('.sheet-body');
    // the composer sits over the bottom of the scroller: a proposal behind it is not in view
    const io = new IntersectionObserver(([e]) => setOut(!e!.isIntersecting), { root, rootMargin: '0px 0px -160px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return out;
};

/** The chat's title and its History and New buttons, in the sheet's header (one white capsule at the right). */
const useHeader = (onHistory: () => void, pushed: React.RefObject<boolean>) => {
  const sheet = useSheet();
  const id = useAssistantChatId();
  const chats = useAssistantChats();
  const title = chats.find((c) => c.id === id)?.title ?? 'New chat';
  useEffect(() => {
    if (pushed.current) return;
    sheet.update({
      title: <span className="as-title">{title}</span>,
      action: (
        <span className="as-head-actions">
          <button type="button" className="as-head-btn" aria-label="History" title="History" onClick={onHistory}>
            <History size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="as-head-btn"
            aria-label="New chat"
            title="New chat"
            onClick={() => {
              haptics.select();
              assistantStore.clear();
            }}
          >
            <SquarePen size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </span>
      ),
    });
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps
};

/**
 * The assistant (Claude Sonnet), laid out the way ChatGPT and Claude are on a phone: a greeting and starter cards on a
 * new chat; the owner's words in soft bubbles at the right; the answers straight on the page, full width, with how it got
 * there folded above and its actions below; the question just sent pinned at the top while the answer streams in under
 * it; a composer box with the attach button, the screen it was opened from and Send (Stop while it works). Every chat is
 * kept in History. It answers, or proposes changes that run only when Apply is tapped (and Undo takes back).
 */
export const AssistantSheet = (props: { date: ISODate; initial?: string; screen?: AssistantScreen }) => {
  // the permission step comes first: the conversation (and its composer) is not there to send from until it is answered
  const { gate, retry } = useAssistantGate();
  if (gate !== 'open') return <AssistantPermission gate={gate} retry={retry} date={props.date} screen={props.screen} />;
  return <Conversation {...props} />;
};

const Conversation = ({ date, initial, screen: openedFrom }: { date: ISODate; initial?: string; screen?: AssistantScreen }) => {
  const today = useToday();
  const turns = useAssistantTurns();
  const busySince = useAssistantBusy();
  const busyChat = useAssistantBusyChat();
  const chatId = useAssistantChatId();
  const live = useAssistantLive();
  const busyAnywhere = busySince !== null;
  // the answer being written belongs to this chat (one can carry on in another while this one is open)
  const busy = busyAnywhere && busyChat === chatId;
  const name = useBootstrap().data?.user.name?.trim().split(/\s+/)[0];
  const sheet = useSheet();
  const speaker = useSpeaker();
  // turns added while the sheet is open come in with a rise; the ones already there just show
  const mountedAt = useRef(turns.length);
  useEffect(() => {
    mountedAt.current = turns.length;
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [screen, setScreen] = useState(openedFrom);
  // with the screen removed, the question is about no page in particular: today
  const askDate = openedFrom && !screen ? today : date;
  const [draft, setDraft] = useState(initial ?? '');
  const [editing, setEditing] = useState<number | null>(null);
  const [pending, setPending] = useState<PreparedFile[]>([]);
  const [preparing, setPreparing] = useState(false);
  // the first file ever attached on this phone: one line says where it goes, until that message is sent
  const [attachNote, setAttachNote] = useState(false);
  const toast = useToast();
  const root = useRef<HTMLDivElement>(null);
  const tail = useRef<HTMLDivElement>(null);
  const compose = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const bodyOf = () => root.current?.closest<HTMLElement>('.sheet-body') ?? null;

  // an answer a reload interrupted carries on (or says it is gone, with Retry)
  useEffect(() => void resumeAsk(waitForJob, stopAssistant), []);
  // signed out mid-chat: the app goes to sign in, so the sheet closes
  useEffect(() => {
    const fn = () => sheet.close();
    onUnauthorized.add(fn);
    return () => void onUnauthorized.delete(fn);
  }, [sheet]);

  const pushed = useRef(false);
  useHeader(() => {
    pushed.current = true;
    sheet.push({
      title: 'History',
      body: (
        <HistoryPanel
          onDone={() => {
            pushed.current = false;
            sheet.pop();
          }}
        />
      ),
    });
  }, pushed);
  // coming back from History (or any pop), the header is this chat's again
  useEffect(() => {
    const t = setInterval(() => {
      if (pushed.current && !document.querySelector('.as-history')) pushed.current = false;
    }, 400);
    return () => clearInterval(t);
  }, []);

  const fitField = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };
  // a request handed in pre-filled (Plan's "Move them") shows whole, not cut to one line
  useEffect(() => fitField(field.current), [initial]);

  // ---------- scrolling, the ChatGPT way ----------
  // The last exchange (the newest question and everything after it) sits in a block at least a screen tall, so the
  // question just sent can rise to the top and the answer stream in below it without the page jumping. Open a chat and
  // it shows its end.
  const [tailMin, setTailMin] = useState(0);
  useLayoutEffect(() => {
    const body = bodyOf();
    if (!body || typeof ResizeObserver === 'undefined') return;
    const measure = () => setTailMin(Math.max(0, body.clientHeight - (compose.current?.offsetHeight ?? 0) - 12));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    if (compose.current) ro.observe(compose.current);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const body = bodyOf();
    if (body) body.scrollTop = body.scrollHeight;
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = turns[turns.length - 1];
  const sentAt = useRef(0);
  useLayoutEffect(() => {
    if (last?.role !== 'user' || turns.length <= mountedAt.current) return;
    const body = bodyOf();
    const el = tail.current;
    if (!body || !el) return;
    sentAt.current = Date.now();
    const top = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 4;
    body.scrollTo({ top, behavior: 'smooth' });
  }, [turns.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // scrolled up from the end: a round arrow over the composer takes it back down
  const [away, setAway] = useState(false);
  useEffect(() => {
    const body = bodyOf();
    if (!body) return;
    const on = () => setAway(body.scrollHeight - body.scrollTop - body.clientHeight > 160);
    on();
    body.addEventListener('scroll', on, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(on) : null;
    if (root.current) ro?.observe(root.current);
    return () => {
      body.removeEventListener('scroll', on);
      ro?.disconnect();
    };
  }, []);
  const toBottom = () => {
    const body = bodyOf();
    body?.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  };

  // the newest proposal still waiting for a decision, and whether it has scrolled away
  const waiting = [...turns].reverse().find((t) => t.proposal?.status === 'proposed')?.proposal ?? null;
  const [waitingEl, setWaitingEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setWaitingEl(root.current?.querySelector<HTMLElement>('.as-proposal[data-waiting]') ?? null), [waiting?.id, turns.length]);
  const outOfView = useOutOfView(waitingEl);
  const waitingCount = waiting ? waiting.changes.length - (waiting.skipped?.length ?? 0) : 0;

  /** Picked files: each becomes a photo (shrunk, as a JPEG) or a PDF, up to four with a message. */
  const addFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const room = ATTACHMENT_LIMITS.perTurn - pending.length;
    if (files.length > room) toast(`Up to ${ATTACHMENT_LIMITS.perTurn} files with a message. ${room > 0 ? `The first ${room} ${room === 1 ? 'was' : 'were'} added.` : ''}`.trim());
    setPreparing(true);
    try {
      const ready: PreparedFile[] = [];
      for (const f of files.slice(0, Math.max(0, room))) {
        try {
          ready.push(await prepareFile(f));
        } catch (e) {
          toast(e instanceof AttachError ? e.message : `Couldn’t add ${f.name || 'that file'}.`);
        }
      }
      if (ready.length) {
        setPending((p) => [...p, ...ready].slice(0, ATTACHMENT_LIMITS.perTurn));
        if (!attachNoteSeen()) {
          markAttachNoteSeen();
          setAttachNote(true);
        }
      }
    } finally {
      setPreparing(false);
      if (picker.current) picker.current.value = '';
    }
  };

  const send = (text: string) => {
    const t = text.trim();
    const files = pending;
    if ((!t && !files.length) || busyAnywhere || preparing) return;
    setDraft('');
    setPending([]);
    setAttachNote(false);
    // the field grew with the words; empty again, it goes back to one line
    if (field.current) field.current.style.height = '';
    if (editing !== null) {
      setEditing(null);
      void editTurn(askAssistant, askDate, screen, editing, t, stopAssistant);
      return;
    }
    void sendTurn(askAssistant, askDate, screen, t, { shown: files.length ? files.map((f) => f.shown) : undefined, data: files.map((f) => f.file) }, stopAssistant);
  };
  const startEdit = (i: number) => {
    setEditing(i);
    setDraft(turns[i]!.text);
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      fitField(el);
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const replies = !busy && last?.role === 'assistant' && !last.error && last.replies?.length ? last.replies : null;
  const tailFrom = (() => {
    for (let i = turns.length - 1; i >= 0; i--) if (turns[i]!.role === 'user') return i;
    return turns.length;
  })();
  const newestAnswer = turns.length - 1;

  const renderTurn = (t: AssistantTurn, i: number) => (
    <div key={`${chatId}-${i}`} className={`as-turn is-${t.role}${t.error ? ' is-error' : ''}${i >= mountedAt.current ? ' is-new' : ''}${editing === i ? ' is-editing' : ''}`}>
      {t.role === 'user' ? (
        <UserTurn t={t} canEdit={!busyAnywhere && !t.files?.length} onEdit={() => startEdit(i)} />
      ) : t.error ? (
        <div className="as-error" role="alert">
          <CircleAlert size={16} className="as-error-ic" aria-hidden="true" />
          <p>{t.text}</p>
          {i === turns.length - 1 && !busyAnywhere ? (
            <button type="button" className="as-retry" onClick={() => void retryAsk(askAssistant, askDate, screen, stopAssistant)}>
              <RotateCw size={14} strokeWidth={2.4} aria-hidden="true" /> Retry
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <Process thoughts={t.thoughts} seconds={t.thoughtSeconds} steps={t.steps} />
          {t.text ? (
            <div className="as-answer">
              <Rich text={t.text} />
            </div>
          ) : null}
          {t.proposal ? <ProposalCard p={t.proposal} waiting={t.proposal.id === waiting?.id} /> : null}
          <AnswerActions t={t} index={i} newest={i === newestAnswer && !busyAnywhere} speaker={speaker} onRegenerate={() => void regenerate(askAssistant, askDate, screen, stopAssistant)} />
        </>
      )}
    </div>
  );

  const empty = turns.length === 0 && !busy;
  const stoppedHere = useAssistantStopped() === chatId;
  // an answer being written in another chat: one line over the composer, and a way there
  const elsewhere = busyAnywhere && !busy && busyChat !== null;
  const ScreenIcon = screen ? SCREEN_ICON[screen.tab] : null;
  const canSend = (draft.trim() || pending.length) && !preparing && !busyAnywhere;

  return (
    <div className={`as-sheet${empty ? ' is-empty' : ''}`} ref={root}>
      <div className="as-thread">
        {empty ? (
          <div className="as-hello">
            <Orb size={64} className="as-hello-mark" />
            <p className="as-hello-title">
              {greeting()}
              {name ? `, ${name}` : ''}.
            </p>
            <p className="as-hello-sub">Ask about your plan, or ask for a change.</p>
            <p className="as-hello-foot">Nothing changes until you tap Apply.</p>
            <p className="as-hello-legal">{DISCLAIMER}</p>
          </div>
        ) : (
          <>
            {turns.slice(0, tailFrom).map((t, i) => renderTurn(t, i))}
            <div className="as-tail" ref={tail} style={{ minHeight: tailFrom < turns.length || busy ? tailMin : undefined }}>
              {turns.slice(tailFrom).map((t, j) => renderTurn(t, tailFrom + j))}
              {replies ? (
                <div className="as-followups" role="group" aria-label="Suggested replies">
                  {replies.map((s) => (
                    <button key={s} type="button" className="as-followup" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              {busy && busySince !== null ? <LiveAnswer since={busySince} live={live} /> : null}
              {last?.role === 'user' && !busy ? (
                <div className="as-turn is-assistant as-noanswer">
                  <p className="as-noanswer-text">{stoppedHere ? 'Stopped' : busyAnywhere ? 'Waiting for the other chat to finish.' : 'No answer.'}</p>
                  {!busyAnywhere ? (
                    <button type="button" className="as-retry" onClick={() => void runAsk(askAssistant, askDate, screen, Date.now, stopAssistant)}>
                      <RotateCw size={14} strokeWidth={2.4} aria-hidden="true" /> Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="as-compose" ref={compose}>
        {away && !empty && !(waiting && outOfView) ? (
          <button type="button" className="icon-btn as-jump" aria-label="Jump to the newest" onClick={toBottom}>
            <ArrowDown size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : null}
        {waiting && outOfView ? (
          <button type="button" className="as-review" onClick={() => waitingEl?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
            <span className="as-review-n" aria-hidden="true">
              {waitingCount}
            </span>
            <span className="as-review-text">
              Review changes<span className="sr-only"> ({waitingCount})</span>
            </span>
            <ChevronUp size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : null}
        {elsewhere ? (
          <button type="button" className="as-elsewhere" onClick={() => assistantStore.open(busyChat!)}>
            <Orb size={16} state="think" className="as-orb" />
            <span>Answering in another chat</span>
            <ChevronRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </button>
        ) : null}
        {empty && !draft && !pending.length ? (
          <div className="as-starters" role="group" aria-label="Ways to start">
            {startersFor(askDate, today).map((s) => (
              <button key={s.title} type="button" className="as-starter" onClick={() => (s.attach ? picker.current?.click() : send(s.send!))}>
                <span className="as-starter-title">{s.title}</span>
                <span className="as-starter-sub">{s.sub}</span>
              </button>
            ))}
          </div>
        ) : null}
        {editing !== null ? (
          <div className="as-editing">
            <Pencil size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Editing your message</span>
            <button
              type="button"
              className="as-editing-x"
              aria-label="Cancel editing"
              onClick={() => {
                setEditing(null);
                setDraft('');
                if (field.current) field.current.style.height = '';
              }}
            >
              <X size={14} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="as-box">
          {pending.length || preparing ? (
            <div className="as-files" aria-label="Files to send">
              {pending.map((f, i) => (
                <span key={i} className={`as-file ${f.shown.thumb ? 'is-photo' : 'is-doc'}`}>
                  {f.shown.thumb ? <img src={f.shown.thumb} alt="" /> : <FileText size={18} aria-hidden="true" />}
                  {f.shown.thumb ? null : <span className="as-file-name">{f.shown.name}</span>}
                  <button type="button" className="as-file-x" aria-label={`Remove ${f.shown.name}`} onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>
                    <X size={12} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                </span>
              ))}
              {preparing ? (
                <span className="as-file is-preparing" aria-label="Preparing">
                  <Orb size={18} state="think" className="as-orb" />
                </span>
              ) : null}
            </div>
          ) : null}
          {attachNote && pending.length ? (
            <p className="as-attach-note" role="status">
              {pending.length === 1 ? 'This file goes' : 'These files go'} to Claude, by Anthropic, to answer you.
            </p>
          ) : null}
          <textarea
            ref={field}
            className="as-input"
            rows={1}
            maxLength={2000}
            placeholder={pending.length ? 'Add a note (optional)' : turns.length ? 'Reply to Logbook' : askDate !== today ? `Ask about ${fmtDate('short', askDate)}` : 'Ask anything'}
            aria-label="Ask the assistant"
            enterKeyHint="send"
            value={draft}
            autoFocus
            onFocus={(e) => revealField(e.currentTarget)}
            onChange={(e) => {
              setDraft(e.target.value);
              fitField(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
          />
          <div className="as-tools">
            <button type="button" className="as-plus" aria-label="Attach a photo or a PDF" disabled={busyAnywhere || preparing || pending.length >= ATTACHMENT_LIMITS.perTurn} onClick={() => picker.current?.click()}>
              <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <input ref={picker} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={(e) => void addFiles(e.currentTarget.files)} />
            {screen && ScreenIcon ? (
              <span className="as-ctx-pill">
                <ScreenIcon size={14} strokeWidth={2.2} aria-hidden="true" />
                <span className="as-ctx-pill-text">{screenLabel(screen)}</span>
                <button type="button" className="as-ctx-pill-x" aria-label={`Don’t send ${screenLabel(screen)} with the question`} onClick={() => setScreen(undefined)}>
                  <X size={12} strokeWidth={2.8} aria-hidden="true" />
                </button>
              </span>
            ) : null}
            {busy ? (
              <button type="button" className="as-send is-stop" aria-label="Stop" onClick={() => void stopAsk(stopAssistant)}>
                <Square size={12} strokeWidth={0} fill="currentColor" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className={`as-send${canSend ? ' is-ready' : ''}`} aria-label={editing !== null ? 'Send edit' : 'Send'} disabled={!canSend} onClick={() => send(draft)}>
                <ArrowUp size={18} strokeWidth={2.6} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <p className="as-ai-label">{AI_LABEL}</p>
      </div>
    </div>
  );
};
