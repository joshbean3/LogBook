import { fmtDate, shiftDays, type ISODate } from '@logbook/shared';
import { deprecated } from '@/lib/motion';

/*
 * @deprecated module (contracts rule 5): the arrows, the chip and the hold-repeat are gone (§2, §13.1: the strip and the
 * Today pill replace them). What stays for the pages that still render it (DayView, MorningView) are its hidden Previous /
 * Next buttons, for VoiceOver and the keyboard. WP1 deletes it after WP2 and WP3 land.
 */

/** @deprecated the hidden `dpager-sr` Previous/Next buttons only; no haptic. */
export const DayStepper = ({ date, onGo }: { date: ISODate; today?: ISODate; onGo: (d: ISODate) => void }) => {
  deprecated('DayStepper');
  return (
    <>
      <button type="button" className="dpager-sr" onClick={() => onGo(shiftDays(date, -1))}>
        {`Previous day, ${fmtDate('long', shiftDays(date, -1))}`}
      </button>
      <button type="button" className="dpager-sr" onClick={() => onGo(shiftDays(date, 1))}>
        {`Next day, ${fmtDate('long', shiftDays(date, 1))}`}
      </button>
    </>
  );
};
