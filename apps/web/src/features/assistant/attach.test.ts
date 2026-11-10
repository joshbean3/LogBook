import { zAssistantAsk, type AssistantTurn, type Attachment } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { requestTurns, SEND_TURNS, TURN_CHARS } from './attach';

const file = (name: string, kb = 10): Attachment => ({ name, mediaType: 'image/jpeg', data: 'A'.repeat(Math.ceil((kb * 1024) / 3) * 4) });
const shown = (f: Attachment) => ({ name: f.name, mediaType: f.mediaType });

describe('what the assistant is sent', () => {
  it('sends the files with the turn they came with, and the proposal a reply carried in words', () => {
    const plan = file('plan.jpg');
    const ask: AssistantTurn = { role: 'user', text: 'Put this in', files: [shown(plan)] };
    const reply: AssistantTurn = { role: 'assistant', text: 'Here it is.', proposal: { id: 'a', summary: 'Add 4 runs', changes: [], status: 'proposed' } };
    const data = new Map<AssistantTurn, Attachment[]>([[ask, [plan]]]);
    const out = requestTurns([ask, reply], (t) => data.get(t));
    expect(out[0]).toEqual({ role: 'user', text: 'Put this in', attachments: [plan] });
    expect(out[1]!.text).toBe('Here it is.\n[Proposed: Add 4 runs Status: proposed.]');
  });

  it('keeps the newest files when there are more than four, and names the ones left out', () => {
    const turns: AssistantTurn[] = [];
    const data = new Map<AssistantTurn, Attachment[]>();
    for (const n of ['a', 'b', 'c']) {
      const fs = [file(`${n}1.jpg`), file(`${n}2.jpg`)];
      const t: AssistantTurn = { role: 'user', text: n, files: fs.map(shown) };
      data.set(t, fs);
      turns.push(t, { role: 'assistant', text: 'ok' });
    }
    const out = requestTurns(turns, (t) => data.get(t));
    expect(out.map((t) => t.attachments?.length ?? 0)).toEqual([0, 0, 2, 0, 2, 0]);
    expect(out[0]!.text).toBe('a\n[Sent earlier: a1.jpg, a2.jpg]');
  });

  it('leaves out an ask that did not go through, and names the changes the owner removed', () => {
    const turns: AssistantTurn[] = [
      { role: 'user', text: 'Clear my list' },
      { role: 'assistant', text: 'That didn’t go through. Try again.', error: true },
      {
        role: 'assistant',
        text: 'Here.',
        proposal: { id: 'a', summary: 'Delete 2 to-dos', changes: [{ op: { op: 'delete_todo', id: 't1' }, label: 'Delete to-do “x”' }, { op: { op: 'delete_todo', id: 't2' }, label: 'Delete to-do “y”' }], status: 'applied', skipped: [1] },
      },
    ];
    const out = requestTurns(turns, () => undefined);
    expect(out.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(out[1]!.text).toBe('Here.\n[Proposed: Delete 2 to-dos Status: applied. They left out: Delete to-do “y”.]');
  });

  it('names the files of a turn whose data is gone (the app was reopened)', () => {
    const t: AssistantTurn = { role: 'user', text: '', files: [{ name: 'week.pdf', mediaType: 'application/pdf' }] };
    expect(requestTurns([t], () => undefined)[0]).toEqual({ role: 'user', text: '[Sent earlier: week.pdf]' });
  });

  it('sends the last 20 turns of a long chat, starting at one of the owner’s', () => {
    const turns: AssistantTurn[] = [];
    for (let i = 0; i < 30; i++) turns.push({ role: 'user', text: `q${i}` }, { role: 'assistant', text: `a${i}` });
    turns.push({ role: 'user', text: 'and now?' });
    expect(turns).toHaveLength(61);
    const out = requestTurns(turns, () => undefined);
    // the window of 20 opens on an answer: it goes, so the conversation starts with a question
    expect(out).toHaveLength(SEND_TURNS - 1);
    expect(out[0]).toEqual({ role: 'user', text: 'q21' });
    expect(out[out.length - 1]).toEqual({ role: 'user', text: 'and now?' });
    expect(zAssistantAsk.safeParse({ date: '2026-11-10', turns: out }).success).toBe(true);
  });

  it('cuts a very long answer to what the server takes, and says so, keeping what was proposed', () => {
    const long = 'word '.repeat(6000);
    expect(long).toHaveLength(30_000);
    const turns: AssistantTurn[] = [
      { role: 'user', text: 'Write me the whole plan' },
      { role: 'assistant', text: long, proposal: { id: 'a', summary: 'Add 40 runs', changes: [], status: 'applied' } },
      { role: 'assistant', text: long, stopped: true },
      { role: 'user', text: 'Thanks. Shorter?' },
    ];
    const out = requestTurns(turns, () => undefined);
    expect(out[1]!.text.length).toBeLessThanOrEqual(TURN_CHARS);
    expect(out[1]!.text.startsWith('word word ')).toBe(true);
    expect(out[1]!.text.endsWith('\n[Cut here for length.]\n[Proposed: Add 40 runs Status: applied.]')).toBe(true);
    expect(out[2]!.text.length).toBeLessThanOrEqual(TURN_CHARS);
    expect(out[2]!.text.endsWith('[They stopped this answer partway.]')).toBe(true);
    expect(zAssistantAsk.safeParse({ date: '2026-11-10', turns: out }).success).toBe(true);
  });

  it('only resends files from the turns it sends', () => {
    const old = file('old.jpg');
    const first: AssistantTurn = { role: 'user', text: 'see this', files: [shown(old)] };
    const turns: AssistantTurn[] = [first];
    for (let i = 0; i < 12; i++) turns.push({ role: 'assistant', text: `a${i}` }, { role: 'user', text: `q${i}` });
    const out = requestTurns(turns, (t) => (t === first ? [old] : undefined));
    expect(out.some((t) => t.attachments?.length)).toBe(false);
    expect(out[0]).toEqual({ role: 'user', text: 'q2' });
  });
});
