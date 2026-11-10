import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LineChart } from './charts';

const draw = (points: Array<{ key: string; label: string; y: number | null }>) =>
  renderToStaticMarkup(<LineChart label="Pace of each easy run" points={points} format={(v) => String(Math.round(v))} readout={() => <span>readout</span>} />);

describe('the sheets’ line chart', () => {
  it('says there is nothing to draw when it has no values, and never a NaN', () => {
    for (const html of [draw([]), draw([{ key: 'a', label: 'Nov 1', y: null }])]) {
      expect(html).toContain('Nothing to draw yet.');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('Infinity');
      expect(html).not.toContain('<svg');
    }
  });

  it('draws one point and many without a NaN', () => {
    for (const html of [draw([{ key: 'a', label: 'Nov 1', y: 540 }]), draw([{ key: 'a', label: 'Nov 1', y: 540 }, { key: 'b', label: 'Nov 3', y: null }, { key: 'c', label: 'Nov 5', y: 520 }])]) {
      expect(html).toContain('<svg');
      expect(html).toContain('readout');
      expect(html).not.toContain('NaN');
    }
  });
});
