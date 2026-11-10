import { niceDomain, type Series } from './scale';

/**
 * The y domain a chart draws on: a fixed one when the caller gives it (a share reads on 0 to 100, whatever the data),
 * otherwise the round domain `niceDomain` builds around the values.
 */
export const chartDomain = (values: Series, opts: Parameters<typeof niceDomain>[1] & { domain?: readonly [number, number] } = {}): [number, number] => {
  const { domain, ...rest } = opts;
  if (domain && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[1] > domain[0]) return [domain[0], domain[1]];
  return niceDomain(values, rest);
};
