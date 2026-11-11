import { describe, expect, it } from 'vitest';
import { liftsShadow } from './devChecks';

describe('liftsShadow', () => {
  it('counts a lifting shadow', () => {
    expect(liftsShadow('rgba(14, 34, 54, 0.04) 0px 1px 1px 0px, rgba(14, 34, 54, 0.2) 0px 10px 28px -14px')).toBe(true);
  });
  it('ignores none and inset rings', () => {
    expect(liftsShadow('none')).toBe(false);
    expect(liftsShadow('rgb(14, 34, 54) 0px 0px 0px 1.5px inset')).toBe(false);
  });
  it('counts a lift beside a ring', () => {
    expect(liftsShadow('rgb(14, 34, 54) 0px 0px 0px 1.5px inset, rgba(0, 0, 0, 0.1) 0px 2px 4px 0px')).toBe(true);
  });
});
