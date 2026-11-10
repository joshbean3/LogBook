import { useState } from 'react';
import { haptics } from '@/lib/haptics';
import { SUPPORT_EMAIL } from '@/lib/siteLinks';
import { Button } from '@/ui/primitives';
import { plainOf } from './plain';

export const REASONS = ['Wrong', 'Unsafe or harmful', 'Not what I asked', 'Other'] as const;
export type Reason = (typeof REASONS)[number];
/** The answer goes in the mail as words, cut so the mail link stays short enough for every mail app. */
const ANSWER_CHARS = 1500;

/** The prefilled mail to the support address: what was wrong, the note, and the answer when there is one. */
export const reportMail = (reason: Reason | null, note: string, answer?: string) => {
  const words = answer ? plainOf(answer) : '';
  const cut = words.length > ANSWER_CHARS ? `${words.slice(0, ANSWER_CHARS).trimEnd()}…` : words;
  const subject = answer ? `Assistant answer: ${reason ?? 'Report'}` : 'Assistant: a problem';
  const body = [reason ? `What was wrong: ${reason}` : '', note.trim() ? `Note: ${note.trim()}` : '', cut ? `The answer:\n${cut}` : ''].filter(Boolean).join('\n\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

/**
 * Report an answer (after thumbs down) or a problem with the assistant (from History): a reason, an optional note, and
 * Report, which opens a prefilled mail to the support address. Nothing is sent until the person sends that mail.
 * Storing reports on the server comes later (plan, Deferred).
 */
export const ReportPanel = ({ answer, onDone }: { answer?: string; onDone: () => void }) => {
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const send = () => {
    haptics.select();
    window.location.href = reportMail(reason, note, answer);
    onDone();
  };
  return (
    <div className="as-report">
      <p className="as-report-lead">{answer ? 'What was wrong with this answer?' : 'What went wrong?'}</p>
      {answer ? (
        <div className="as-report-reasons" role="radiogroup" aria-label="What was wrong">
          {REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className={`as-report-reason${reason === r ? ' is-on' : ''}`} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
      ) : null}
      <label className="as-report-note">
        <span className="sr-only">A note (optional)</span>
        <textarea rows={3} maxLength={1000} placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <p className="as-report-foot">{answer ? 'Report opens an email to Orby with this answer in it. Nothing is sent until you send it.' : 'Report opens an email to Orby. Nothing is sent until you send it.'}</p>
      <Button variant="primary" block disabled={!!answer && !reason && !note.trim()} onClick={send}>
        Report
      </Button>
    </div>
  );
};
