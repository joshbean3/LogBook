/** The chart kit (docs/inspiration.md §3): small SVG charts with no dependencies, drawn from the pure helpers in scale.ts. */
export { TrendChart, type TrendChartProps, type ChartZone } from './TrendChart';
export { Spark } from './Spark';
export { RangeControl } from './RangeControl';
export { TrendTable } from './TrendTable';
export type { TrendTone } from './tone';
export { Ring, Rings, type RingItem } from './Rings';
export { Gauge } from './Gauge';
export { useChartWidth } from './useWidth';
export * from './scale';
export * from './range';
export { useScrub, type ScrubOptions } from './useScrub';
export { BAR_SHARE, barCenter, barLayout, bucketAt, MAX_BAR, MIN_BAR, scrubIntent, stepIndex, type BarLayout, type ScrubIntent } from './scrub';
