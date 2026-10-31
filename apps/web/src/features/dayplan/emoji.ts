/**
 * A to-do's icon on the board: an emoji read from its words (the first rule that matches), else its section's own. The
 * words are matched whole, so "ran" never catches "orange".
 */
const RULES: Array<[RegExp, string]> = [
  // the specific before the general: "book the dentist" is the dentist, not a book
  [/\b(doctor|dentist|physio|pt|appointment|meds|medicine|pharmacy)\b/, '🩺'],
  [/\b(run|runs|ran|jog|tempo|intervals?|strides|5k|10k|marathon|miles?)\b/, '🏃'],
  [/\b(lift|lifts|gym|squat|deadlift|bench|weights?|workout|strength)\b/, '🏋️'],
  [/\b(stretch|yoga|mobility|foam roll)\b/, '🧘'],
  [/\b(swim|pool)\b/, '🏊'],
  [/\b(bike|ride|cycle|cycling|peloton)\b/, '🚴'],
  [/\b(walk|hike|steps)\b/, '🚶'],
  [/\b(call|phone|ring|facetime)\b/, '📞'],
  [/\b(email|emails|inbox|reply|respond|write to|message|text)\b/, '✉️'],
  [/\b(meet|meeting|sync|standup|1:1|interview)\b/, '🤝'],
  [/\b(bank|pay|bill|bills|invoice|tax|taxes|budget|money|venmo|rent)\b/, '💳'],
  [/\b(model|deck|slides|spreadsheet|excel|report|memo|doc|draft|proposal)\b/, '📊'],
  [/\b(code|deploy|ship|bug|pr|review)\b/, '💻'],
  [/\b(read|reading|chapter|article|novel)\b/, '📖'],
  [/\b(study|learn|course|class|homework|exam)\b/, '📚'],
  [/\b(journal|reflect|plan|planning)\b/, '📝'],
  [/\b(clean|tidy|laundry|dishes|vacuum|chores?)\b/, '🧹'],
  [/\b(dry cleaning|pick up|pickup|errand|errands|post office|return)\b/, '🛍️'],
  [/\b(groceries|grocery|shop|shopping|buy|order)\b/, '🛒'],
  [/\b(cook|meal|dinner|lunch|breakfast|prep|eat|protein)\b/, '🥗'],
  [/\b(water|hydrate|drink)\b/, '💧'],
  [/\b(sleep|nap|bed|bedtime)\b/, '😴'],
  [/\b(mom|dad|family|parents|brother|sister|kids?)\b/, '👨‍👩‍👧'],
  [/\b(friend|friends|date|dinner with|drinks|party|birthday|gift)\b/, '🎉'],
  [/\b(dog|cat|vet|walk the dog|pet)\b/, '🐶'],
  [/\b(car|gas|oil change|commute|flight|travel|pack|trip)\b/, '🚗'],
  [/\b(meditate|meditation|breathe|breath)\b/, '🌿'],
  [/\b(music|guitar|piano|practice)\b/, '🎵'],
  [/\b(art|paint|draw|sketch|watercolor)\b/, '🎨'],
];

export const emojiOf = (text: string, fallback: string): string => {
  const t = ` ${text.toLowerCase()} `;
  for (const [re, e] of RULES) if (re.test(t)) return e;
  return fallback;
};
