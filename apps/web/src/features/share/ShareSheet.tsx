import { useState } from 'react';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { shareText, type ShareData, type Template } from './cards';
import { shareText as shareOut } from './shareOut';

/**
 * The one Share (docs/system.md): the day in words, and one verb that hands it to the system share sheet. `initial` is
 * accepted from older callers and ignored (there are no cards any more).
 */
export const ShareSheet = ({ data }: { data: ShareData; initial?: Template }) => {
  const toast = useToast();
  const sheet = useSheet();
  const [busy, setBusy] = useState(false);
  const text = shareText(data);
  const run = async () => {
    setBusy(true);
    try {
      const r = await shareOut(text, data.name);
      if (r === 'copied') toast('Copied');
      if (r !== 'cancelled') sheet.close();
    } catch {
      haptics.error();
      toast('Couldn’t share. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="share">
      <pre className="share-text t-body">{text}</pre>
      <div className="sheet-foot">
        <span />
        <div className="foot-right">
          <Button variant="primary" disabled={busy} onClick={() => void run()}>
            {busy ? 'Sharing' : 'Share'}
          </Button>
        </div>
      </div>
    </div>
  );
};
