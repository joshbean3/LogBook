/**
 * Ghost previews for empty states, drawn as shapes only: no words, no dates, no sites, no numbers. A new account must
 * never be shown a log it did not write (critic B1). Each row is two grey bars, 60% and 35% wide, the way a line of text
 * and its byline sit; the EmptyState fades the whole ghost to 30%.
 */

/** Rows of two bars, with an optional square where a date or a mark would stand. */
export const GhostLines = ({ rows = 3, lead = false }: { rows?: number; lead?: boolean }) => (
  <div className="jghost" aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="jghost-row">
        {lead ? <span className="jghost-lead" /> : null}
        <span className="jghost-lines">
          <span className="jghost-bar" style={{ width: `${60 - i * 6}%` }} />
          <span className="jghost-bar short" style={{ width: `${35 - i * 4}%` }} />
        </span>
      </div>
    ))}
  </div>
);

/** Two cards in the carousel's shape, each with bars where a quote and its author would be. */
export const GhostCards = () => (
  <div className="carousel fav-carousel" aria-hidden="true">
    {[0, 1].map((i) => (
      <div key={i} className="fav-card jghost-card">
        <span className="jghost-lines">
          <span className="jghost-bar" style={{ width: '82%' }} />
          <span className="jghost-bar" style={{ width: '60%' }} />
        </span>
        <span className="jghost-bar short" style={{ width: '35%' }} />
      </div>
    ))}
  </div>
);
