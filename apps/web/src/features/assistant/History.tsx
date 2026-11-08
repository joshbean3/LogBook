import { MessageSquare, SquarePen, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { haptics } from '@/lib/haptics';
import { assistantStore, useAssistantBusyChat, useAssistantChatId, useAssistantChats, type AssistantChat } from './store';

const DAY = 86_400_000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
/** Today, Yesterday, Previous 7 days, Previous 30 days, then by month ("October"), as ChatGPT groups them. */
export const groupOf = (t: number, now = Date.now()) => {
  const today = startOfDay(now);
  if (t >= today) return 'Today';
  if (t >= today - DAY) return 'Yesterday';
  if (t >= today - 7 * DAY) return 'Previous 7 days';
  if (t >= today - 30 * DAY) return 'Previous 30 days';
  const d = new Date(t);
  return d.toLocaleDateString(undefined, d.getFullYear() === new Date(now).getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' });
};
const timeOf = (t: number, now = Date.now()) =>
  t >= startOfDay(now) ? new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** The last thing said in a chat, in one line, under its title. */
const previewOf = (c: AssistantChat) => {
  const last = [...c.turns].reverse().find((t) => t.text && !t.error);
  if (!last) return '';
  return last.text.replace(/[*_`#>|]/g, '').replace(/\s+/g, ' ').trim();
};

/**
 * History (pushed inside the assistant's sheet): every saved chat, newest first, grouped by when. A tap opens it; the
 * trash takes it off the phone. "New chat" at the top starts a clean one.
 */
export const HistoryPanel = ({ onDone }: { onDone: () => void }) => {
  const chats = useAssistantChats();
  const open = useAssistantChatId();
  const busy = useAssistantBusyChat();
  const groups = useMemo(() => {
    const out: { name: string; items: AssistantChat[] }[] = [];
    for (const c of chats) {
      const name = groupOf(c.updatedAt);
      const g = out[out.length - 1];
      if (g?.name === name) g.items.push(c);
      else out.push({ name, items: [c] });
    }
    return out;
  }, [chats]);
  return (
    <div className="as-history">
      <button
        type="button"
        className="pill-row as-history-new"
        onClick={() => {
          assistantStore.clear();
          onDone();
        }}
      >
        <SquarePen size={18} strokeWidth={2.2} aria-hidden="true" /> New chat
      </button>
      {groups.length === 0 ? (
        <div className="card as-history-empty">
          <MessageSquare size={22} aria-hidden="true" />
          <p>No chats yet. Your conversations with the assistant are kept here, on this phone.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.name} className="as-history-group">
            <h3 className="sec-head t-label">{g.name}</h3>
            <ul className="group">
              {g.items.map((c) => (
                <li key={c.id} className={`as-history-row${c.id === open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="as-history-pick"
                    onClick={() => {
                      assistantStore.open(c.id);
                      onDone();
                    }}
                  >
                    <span className="as-history-title">
                      {c.id === busy ? <span className="as-history-live" aria-label="Answering" /> : null}
                      {c.title}
                    </span>
                    <span className="as-history-sub">
                      <span className="as-history-time">{timeOf(c.updatedAt)}</span>
                      <span className="as-history-prev">{previewOf(c)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="as-history-del"
                    aria-label={`Delete “${c.title}”`}
                    onClick={() => {
                      haptics.delete();
                      assistantStore.remove(c.id);
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="as-history-foot">Kept on this phone only.</p>
    </div>
  );
};
