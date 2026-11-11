import { describe, expect, it } from 'vitest';
import { isTextField, revealFloor } from './keyboard';

/** auth-06: every text field is revealed above the keyboard by one listener; this is what counts as a text field. */
describe('which focused elements are scrolled clear of the keyboard', () => {
  it.each([
    [{ tagName: 'TEXTAREA' }, true],
    [{ tagName: 'INPUT', type: 'text' }, true],
    [{ tagName: 'INPUT' }, true],
    [{ tagName: 'INPUT', type: 'email' }, true],
    [{ tagName: 'INPUT', type: 'password' }, true],
    [{ tagName: 'INPUT', type: 'search' }, true],
    [{ tagName: 'INPUT', type: 'number' }, true],
    [{ tagName: 'INPUT', type: 'date' }, true],
    [{ tagName: 'DIV', isContentEditable: true }, true],
    [{ tagName: 'INPUT', type: 'checkbox' }, false],
    [{ tagName: 'INPUT', type: 'radio' }, false],
    [{ tagName: 'INPUT', type: 'range' }, false],
    [{ tagName: 'INPUT', type: 'file' }, false],
    [{ tagName: 'INPUT', type: 'text', readOnly: true }, false],
    [{ tagName: 'TEXTAREA', disabled: true }, false],
    [{ tagName: 'BUTTON' }, false],
    [{ tagName: 'DIV' }, false],
    [null, false],
  ])('%o: %s', (el, want) => {
    expect(isTextField(el)).toBe(want);
  });
});

/** A field is revealed above whatever covers the end of its scroller: the keyboard, or a sheet's pinned foot. */
describe('where a revealed field must end', () => {
  it('16 above the keyboard, or above the scroller\'s own bottom when that is higher', () => {
    expect(revealFloor(844, 844, 336, null)).toBe(492);
    expect(revealFloor(400, 844, 336, null)).toBe(384);
    expect(revealFloor(700, 844, 0, null)).toBe(684);
  });
  it('16 above a foot pinned over the scroller (the Add sheet\'s name field sat behind its foot)', () => {
    // a sheet lifted over the keyboard: it ends at 508, its pinned foot starts at 358
    expect(revealFloor(508, 844, 336, 358)).toBe(342);
    // a foot further down than the keyboard changes nothing
    expect(revealFloor(844, 844, 336, 700)).toBe(492);
  });
});
