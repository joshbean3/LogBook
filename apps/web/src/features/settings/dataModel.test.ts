import { describe, expect, it } from 'vitest';
import { EXPORT_SUB, IMPORT_MAX_BYTES, IMPORT_SUB, importDone, importError, importKind } from './dataModel';

describe('Import', () => {
  it('knows an Orby export from any other JSON', () => {
    expect(importKind({ version: 2, user: {} })).toBe('v2');
    expect(importKind({ habits: { items: [] } })).toBe('legacy');
    expect(importKind({ version: 1, journal: {} })).toBe('legacy');
    expect(importKind({})).toBeNull();
    expect(importKind({ foo: 1 })).toBeNull();
    expect(importKind({ version: 3, habits: {} })).toBeNull();
    expect(importKind([1, 2])).toBeNull();
    expect(importKind('text')).toBeNull();
    expect(importKind(null)).toBeNull();
  });
  it('says a file is too big for a 413, not ours for a 422, and to try again otherwise', () => {
    expect(importError(413)).toBe('That file is too big.');
    expect(importError(422)).toBe('That file isn’t an Orby export.');
    expect(importError(500)).toBe('Import didn’t finish. Try again.');
    expect(importError(null)).toBe('Import didn’t finish. Try again.');
    expect(IMPORT_MAX_BYTES).toBe(20 * 1024 * 1024);
  });
  it('names what arrived in plain words', () => {
    expect(importDone({ journal: 2, todos: 1, blocks: 1 })).toBe('Imported 2 journal entries, 1 to-do, 1 plan.');
    // the journal's lines are named as the app names them, never as learnings
    expect(importDone({ journal: 1, learnings: 3 })).toBe('Imported 1 journal entry, 3 journal lines.');
    expect(importDone({ learnings: 1 })).toBe('Imported 1 journal line.');
    expect(importDone({ name: 1, trainingProfile: 1, habits: 3 })).toBe('Imported 3 habits, your settings.');
    expect(importDone({ sessions: 1200, mystery: 2 })).toBe('Imported 1,200 sessions, 2 other items.');
    expect(importDone({ journal: 0 })).toBe('Nothing new: it was all here already.');
    expect(importDone(undefined)).toBe('Nothing new: it was all here already.');
  });
});

describe('Data page rows', () => {
  it('describe the file without claiming more than it holds', () => {
    expect(IMPORT_SUB).toBe('An Orby export file (JSON).');
    expect(EXPORT_SUB).not.toMatch(/everything/i);
  });
});
