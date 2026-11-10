import { describe, expect, it } from 'vitest';
import { cleanProposal, cleanTurn, cleanTurns } from './sanitize';
import { chatsFrom } from './store';

const proposal = { id: 'a1', summary: 'Move the tempo', changes: [{ op: { op: 'move_session', id: 's1', date: '2026-11-12' }, label: 'Move Tempo 6 to Thu' }], status: 'proposed' };

describe('saved chats, checked before the sheet draws them', () => {
  it('drops what is not a turn and keeps the rest in order', () => {
    const saved = [{ role: 'user', text: 'hi' }, null, 'words', 7, [], { role: 'system', text: 'x' }, { role: 'assistant' }, { role: 'assistant', text: 'Two runs left.', proposal: null }];
    expect(cleanTurns(saved)).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'Two runs left.', proposal: null },
    ]);
    expect(cleanTurns(null)).toEqual([]);
    expect(cleanTurns({ 0: { role: 'user', text: 'hi' } })).toEqual([]);
  });

  it('takes a proposal with no list of changes off its answer, and drops the answer when nothing else is left', () => {
    expect(cleanProposal({ id: 'a1', summary: 'x', status: 'proposed' })).toBeNull();
    expect(cleanProposal({ ...proposal, changes: [null] })).toBeNull();
    expect(cleanProposal({ ...proposal, changes: [{ label: 'no op' }] })).toBeNull();
    expect(cleanProposal({ ...proposal, status: 'pending' })).toBeNull();
    expect(cleanTurn({ role: 'assistant', text: 'Here it is.', proposal: { id: 'a1', summary: 'x', status: 'proposed' } })).toEqual({ role: 'assistant', text: 'Here it is.' });
    expect(cleanTurn({ role: 'assistant', text: '', proposal: { id: 'a1', summary: 'x', status: 'proposed' } })).toBeNull();
  });

  it('keeps a whole proposal, with only the skipped indexes that point at a change', () => {
    expect(cleanTurn({ role: 'assistant', text: '', proposal: { ...proposal, skipped: [0, 4, 'x', -1] } })).toEqual({ role: 'assistant', text: '', proposal: { ...proposal, skipped: [0] } });
  });

  it('keeps each extra only in the shape the thread reads', () => {
    const t = cleanTurn({ role: 'assistant', text: 'ok', replies: 'Move it', steps: [1, 'Read your plan'], thoughts: 5, thoughtSeconds: 'six', rating: 'sideways', stopped: 'yes', error: 1, files: [{ name: 3 }] });
    expect(t).toEqual({ role: 'assistant', text: 'ok', steps: ['Read your plan'] });
    expect(cleanTurn({ role: 'user', text: '', files: [{ name: 'week.pdf', mediaType: 'application/pdf' }, null, { name: 'p.jpg', mediaType: 'image/jpeg', thumb: 'javascript:alert(1)' }] })).toEqual({
      role: 'user',
      text: '',
      files: [
        { name: 'week.pdf', mediaType: 'application/pdf' },
        { name: 'p.jpg', mediaType: 'image/jpeg' },
      ],
    });
    expect(cleanTurn({ role: 'user', text: '   ' })).toBeNull();
  });

  it('loads a chat with a malformed turn without it, and leaves out chats with nothing left or no id', () => {
    const chats = chatsFrom([
      { id: 'c1', title: 'Moving the tempo', named: true, updatedAt: 5, turns: [{ role: 'user', text: 'Move the tempo' }, null, { role: 'assistant', text: 'Done.', proposal: { id: 'a1' } }] },
      { id: 'c2', title: 7, turns: [{ role: 'user', text: 'What is left on the plan this week?' }] },
      { id: 'c3', title: 'Empty', turns: [null] },
      { title: 'No id', turns: [{ role: 'user', text: 'hi' }] },
      { id: 'c1', title: 'A second c1', turns: [{ role: 'user', text: 'hi' }] },
      null,
      'chat',
    ]);
    expect(chats).toEqual([
      { id: 'c1', title: 'Moving the tempo', named: true, updatedAt: 5, turns: [{ role: 'user', text: 'Move the tempo' }, { role: 'assistant', text: 'Done.' }] },
      { id: 'c2', title: 'What is left on the plan this week?', updatedAt: 0, turns: [{ role: 'user', text: 'What is left on the plan this week?' }] },
    ]);
    expect(chatsFrom({})).toEqual([]);
  });
});
