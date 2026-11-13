/**
 * The assistant's greeting, the first line of an empty conversation: "Good morning, Sam." Pure, in its own file, so the
 * assistant sheet and first run's name question (which shows the greeting being written as the name is typed) say the
 * same words by the same rule.
 */

/** The greeting for an hour of the day (0 to 23). Before 5 it is still last evening. */
export const helloGreeting = (hour: number = new Date().getHours()): string => (hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

/** The name the greeting uses: the first word of the profile's name, or none. */
export const helloName = (name: string | null | undefined): string => (typeof name === 'string' ? (name.trim().split(/\s+/)[0] ?? '') : '');

/** "Good morning, Sam." With no name: "Good morning." */
export const helloLine = (name: string | null | undefined, hour?: number): string => {
  const first = helloName(name);
  return `${helloGreeting(hour)}${first ? `, ${first}` : ''}.`;
};
