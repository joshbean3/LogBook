/**
 * The run read in Logbook's voice. `assess` (shared) writes plain diagnostics ("Faded: the second half was 16 s/mi
 * slower (8:01–8:40)."); the session sheet says them the brand's way: numbers first, short sentences, what to do next,
 * never a grade. Lines this doesn't recognise pass through untouched.
 */
type Rule = [RegExp, (m: RegExpExecArray) => string];

const RULES: Rule[] = [
  [/^Full distance: (\S+) of (\S+) mi\.$/, (m) => `${m[1]} of ${m[2]} mi. All of it.`],
  [/^Went long: (\S+) mi against (\S+) planned\.$/, (m) => `${m[1]} mi, ${m[2]} planned. Went long.`],
  [/^Close: (\S+) of (\S+) mi \(\d+%\)\.$/, (m) => `${m[1]} of ${m[2]} mi. Close enough to count.`],
  [/^Short: (\S+) of (\S+) mi \(\d+%\)\.$/, (m) => `${m[1]} of ${m[2]} mi. Short, and it still counts.`],
  [/^Too easy for threshold: averaged (\d+) bpm \(Z(\d)\)\. Threshold work sits at (\S+) bpm\.(.*)$/, (m) => `${m[1]} bpm average (Z${m[2]}), under threshold’s ${m[3]}.${lapNote(m[4])} Push the middle next time.`],
  [/^Harder than threshold: averaged (\d+) bpm \(Z(\d)\)\.$/, (m) => `${m[1]} bpm average (Z${m[2]}), past threshold. Ease the middle next time.`],
  [/^Threshold effort hit: averaged (\d+) bpm \(Z(\d)\)\.(.*)$/, (m) => `${m[1]} bpm average (Z${m[2]}). Right at threshold.${lapNote(m[3])}`],
  [/^Reached the hard end: max (\d+) bpm \(Z(\d)\)\.$/, (m) => `${m[1]} bpm at the top (Z${m[2]}). The reps got hard enough.`],
  [/^Never got above Z3 \(max (\S+) bpm\): the fast reps were likely too easy\.$/, (m) => `${m[1]} bpm at the top, never past Z3. Push the reps next time.`],
  [/^Race effort: averaged (\S+), max (\S+) bpm\.$/, (m) => `${m[1]} bpm average, ${m[2]} at the top. Race effort.`],
  [/^Easy effort held: averaged (\d+) bpm \(Z(\d)\), under the (\d+) ceiling\.$/, (m) => `${m[1]} bpm average (Z${m[2]}), under the ${m[3]} ceiling. Easy, as planned.`],
  [/^Easy effort: averaged (\d+) bpm \(Z(\d)\), under the (\d+) ceiling\.$/, (m) => `${m[1]} bpm average (Z${m[2]}), under the ${m[3]} ceiling. Easy.`],
  [/^Ran hot for an easy day: averaged (\d+) bpm \(Z(\d)\)\. Keep easy runs under (\d+)\.$/, (m) => `${m[1]} bpm average (Z${m[2]}), over the ${m[3]} ceiling. Slow the next easy day down.`],
  [/^No heart rate on this run, so effort can’t be checked\.$/, () => 'No heart rate on this one.'],
  [/^Negative split: the second half was (\d+ s\/mi) faster \(.*\)\.$/, (m) => `Second half ${m[1]} faster. A negative split.`],
  [/^Faded: the second half was (\d+ s\/mi) slower \(.*\)\.$/, (m) => `Second half ${m[1]} slower. Hold back early next time.`],
  [/^Even pacing: (\S+)–(\S+) per mile\.$/, (m) => `Miles from ${m[1]} to ${m[2]}, the halves even.`],
  [/^Heart rate drifted up (\d+) bpm at a steady pace: heat, fatigue or fuel\.$/, (m) => `Heart rate up ${m[1]} bpm at the same pace. Heat, fatigue or fuel.`],
];

/** " 3 of 5 full miles reached Z3–Z4." → " 3 of 5 miles in Z3–Z4." */
const lapNote = (s = '') => {
  const m = /(\d+) of (\d+) full miles reached (Z\S+)\./.exec(s);
  return m ? ` ${m[1]} of ${m[2]} miles in ${m[3]}.` : '';
};

export const voiceLine = (line: string): string => {
  for (const [re, fn] of RULES) {
    const m = re.exec(line.trim());
    if (m) return fn(m);
  }
  return line;
};

/** The read's heading ("Full distance, effort on target") as a short line: "Full distance · on target". */
export const voiceHead = (head: string): string =>
  head
    .replace(/effort on target/g, 'on target')
    .replace(/too hard for easy/g, 'too hard for an easy day')
    .split(', ')
    .join(' · ');
