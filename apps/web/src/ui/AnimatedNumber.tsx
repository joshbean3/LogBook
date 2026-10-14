import { Ticker } from './Ticker';

/**
 * @deprecated use `Ticker` (same behaviour: shows the first value as is, springs on change, on `springs.number`).
 * Kept so existing imports compile.
 */
export const AnimatedNumber = ({ value, format }: { value: number; format?: (v: number) => string }) => <Ticker value={value} format={format} />;
