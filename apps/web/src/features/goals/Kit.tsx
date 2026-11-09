import type * as React from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { PageSection, type PageSectionProps } from '@/ui/layout';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import './kit.css';

/*
 * The shape kit's pieces (kit.css): a section (the shared PageSection), the sheet's pinned pill, and the sheet's delete (a red
 * trash in a tinted circle, then a confirm). Shared by Goals, Learned, Journal, Library and Reads so they read the same.
 */

/** A section: the shared header (ui/layout.tsx: serif title, grey meta, an orange action at the right), then its cards. */
export const KSection = ({ className = '', ...rest }: PageSectionProps) => <PageSection className={`k-sec ${className}`.trim()} {...rest} />;

/** The sheet's foot: one full-width navy pill pinned at the bottom (and an optional quiet pill under it). */
export const KPin = ({ children }: { children: React.ReactNode }) => <div className="sheet-foot k-pin">{children}</div>;

/** The confirm a sheet's trash pushes: what goes, in words, then one red pill. */
const KConfirm = ({ what, words, verb, onConfirm }: { what?: React.ReactNode; words: string; verb: string; onConfirm: () => void }) => {
  const sheet = useSheet();
  return (
    <div className="k-sheet">
      <section className="k-card k-confirm">
        {what ? <div className="k-confirm-what">{what}</div> : null}
        <p className="k-foot">{words}</p>
      </section>
      <KPin>
        <Button
          block
          className="k-danger"
          onClick={() => {
            sheet.close();
            onConfirm();
          }}
        >
          {verb}
        </Button>
      </KPin>
    </div>
  );
};

/** A sheet's header action for delete: a red trash in a tinted circle that pushes the confirm. */
export const KTrash = ({ label, title, what, words, verb, onConfirm }: { label: string; title: string; what?: React.ReactNode; words: string; verb: string; onConfirm: () => void }) => {
  const sheet = useSheet();
  return (
    <button type="button" className="icon-btn k-trash" aria-label={label} title={label} onClick={() => sheet.push({ title, body: <KConfirm what={what} words={words} verb={verb} onConfirm={onConfirm} /> })}>
      <Trash2 size={18} aria-hidden="true" />
    </button>
  );
};
