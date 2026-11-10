import { describe, expect, it } from 'vitest';
import { isTextField } from './keyboard';

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
