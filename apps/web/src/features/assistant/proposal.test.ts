import type { AssistantChange } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { countLine } from './Proposal';

const c = (op: string): AssistantChange => ({ op: { op } as AssistantChange['op'], label: op });

describe('a long proposal’s count line', () => {
  it('names every kind of change, so none is hidden before Apply', () => {
    const changes = [...Array(6).fill('add_session'), ...Array(2).fill('delete_session'), 'delete_todo', ...Array(3).fill('move_session')].map(c);
    expect(countLine(changes)).toBe('12 changes: 6 added, 3 removed, 3 moved');
    expect(countLine([c('update_session'), c('mark_session'), c('set_goal'), c('add_todo')])).toBe('4 changes: 1 added, 3 changed');
  });
});
