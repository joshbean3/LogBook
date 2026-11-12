import { Check } from 'lucide-react';
import { useState } from 'react';
import { FarHills, PathCheck, PathLine, PathStop, Poster, PosterScene, stopStates, WeekLights } from '@/ui/poster';
import { Button, ChipButton, Section } from '@/ui/primitives';

/** /dev/ui: the poster kit (ui/poster) in the states the four redesigned screens use. Sample words only. */

const TODOS = [
  { id: 'a', title: 'Book dentist appointment' },
  { id: 'b', title: 'Email Alex about the race' },
  { id: 'c', title: 'Renew passport' },
];
const WEEK = [
  { letter: 'F', lit: false },
  { letter: 'S', lit: false },
  { letter: 'S', lit: false },
  { letter: 'M', lit: true },
  { letter: 'T', lit: false },
  { letter: 'W', lit: true },
];

const SAMPLES: readonly (readonly [string, string])[] = [
  ['po-today-empty', 'Today empty'],
  ['po-today-filled', 'Today filled'],
  ['po-today-off', 'Fitness off'],
  ['po-today-full', 'Goal, full'],
  ['po-goals-empty', 'Goals empty'],
  ['po-goals-filled', 'Goals filled'],
  ['po-learned', 'Learned'],
  ['po-fitness', 'Fitness'],
  ['po-long', 'Long words'],
];

const Actions = ({ onSet }: { onSet?: () => void }) => (
  <div className="po-actions">
    <Button variant="primary" onClick={onSet}>
      <Check size={18} aria-hidden="true" /> Set this goal
    </Button>
    <Button variant="quiet">Something else</Button>
  </div>
);

const TodayFilled = ({ size }: { size: 'full' | 'slim' }) => {
  const [done, setDone] = useState<string[]>(['a']);
  const states = stopStates(TODOS.map((t) => done.includes(t.id)));
  const toggle = (id: string) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  return (
    <Poster
      size={size}
      title="Finish the long run notes"
      titleSize="goal"
      now="Today’s goal"
      meta="9 h left"
      scene={<PosterScene size={size} lit total={TODOS.length} done={done.length} />}
      band={{ label: 'To-dos today', words: `${done.length} of ${TODOS.length} done` }}
      path={
        <PathLine label="To-dos">
          {TODOS.map((t, i) => (
            <PathStop
              key={t.id}
              id={t.id}
              state={states[i]!}
              title={t.title}
              tag={states[i] === 'next' ? 'Next' : undefined}
              onPress={states[i] === 'done' ? () => toggle(t.id) : undefined}
              label={states[i] === 'done' ? `${t.title}, done. Mark not done` : undefined}
              trailing={states[i] === 'next' ? <PathCheck label={`${t.title}, done`} onPress={() => toggle(t.id)} /> : undefined}
            />
          ))}
          <PathStop state="add" title="Add a to-do" onPress={() => {}} trailing={<Button variant="quiet">All to-dos</Button>} />
        </PathLine>
      }
    />
  );
};

export const PosterGallery = () => {
  const [saved, setSaved] = useState(false);
  // one sample at a time: each is checked against the screen's real budget of now marks
  const [pick, setPick] = useState<string>(SAMPLES[0]![0]);
  return (
    <Section title="Poster kit" meta="ui/poster">
      <div className="gal-poster" data-testid="gal-poster">
        <div className="gal-chips">
          {SAMPLES.map(([id, name]) => (
            <ChipButton key={id} on={pick === id} data-pick={id} onClick={() => setPick(id)}>
              {name}
            </ChipButton>
          ))}
        </div>
        {pick === 'po-today-empty' ? (
          <>
            <span className="caps">Today, nothing set (slim, Fitness on)</span>
            <div data-testid="po-today-empty">
              <Poster
                size="slim"
                title="What would make today count?"
                now="Today"
                meta="14 h left"
                band={{ label: 'An idea · from Fitness', words: 'Bike 40 min, before lunch' }}
                path={
                  <PathLine label="Plan your day">
                    <PathStop state="next">
                      <Actions />
                    </PathStop>
                    <PathStop state="add" title="Add a to-do" onPress={() => {}} />
                  </PathLine>
                }
              />
            </div>
          </>
        ) : null}
        {pick === 'po-today-filled' ? (
          <>
            <span className="caps">Today, goal set (slim). Tap the check: the light moves</span>
            <div data-testid="po-today-filled">
              <TodayFilled size="slim" />
            </div>
          </>
        ) : null}
        {pick === 'po-today-off' ? (
          <>
            <span className="caps">Today, Fitness off (full)</span>
            <div data-testid="po-today-off">
              <Poster
                title="What would make today count?"
                now="Today"
                meta="14 h left"
                band={{ label: 'An idea · from your habits', words: 'All 7 habits, done by 9' }}
                path={
                  <PathLine label="Plan your day">
                    <PathStop state="next">
                      <Actions />
                    </PathStop>
                    <PathStop state="add" title="Add a to-do" onPress={() => {}} />
                  </PathLine>
                }
              />
            </div>
          </>
        ) : null}
        {pick === 'po-today-full' ? (
          <>
            <span className="caps">Goal set (full): the sun at 1 of 3</span>
            <div data-testid="po-today-full">
              <TodayFilled size="full" />
            </div>
          </>
        ) : null}
        {pick === 'po-goals-empty' ? (
          <>
            <span className="caps">Goals, nothing set</span>
            <div data-testid="po-goals-empty" className="gal-poster-stack">
              <Poster title="What would make today count?" now="Today" meta="14 h left" band={{ label: 'An idea · from Fitness', words: 'Bike 40 min, before lunch' }}>
                <Actions />
              </Poster>
              <FarHills
                hills={[
                  { caption: '2026', onPress: () => {} },
                  { caption: 'November', onPress: () => {} },
                  { caption: 'This week · 4 days left', words: 'Set this week’s goal', plus: true, onPress: () => {} },
                ]}
              />
            </div>
          </>
        ) : null}
        {pick === 'po-goals-filled' ? (
          <>
            <span className="caps">Goals, filled</span>
            <div data-testid="po-goals-filled" className="gal-poster-stack">
              <Poster
                title="Finish the long run notes"
                titleSize="goal"
                now="Today’s goal"
                meta="5 h left"
                scene={<PosterScene lit total={3} done={2} />}
                band={{ label: 'Today · 2 of 3 to-dos done', words: 'Next: Renew passport', onPress: () => {}, pressLabel: 'Today, 2 of 3 to-dos done. Next: Renew passport. Open Today' }}
              />
              <FarHills
                hills={[
                  { caption: '2026 · 50 days left', words: 'Half marathon under 2:00', onPress: () => {} },
                  { caption: 'November · 19 days left', words: 'Set a goal for November', plus: true, onPress: () => {} },
                  { caption: 'This week · 4 days left', words: 'Four runs and one lift', value: '2 of 5', onPress: () => {} },
                ]}
              />
            </div>
          </>
        ) : null}
        {pick === 'po-learned' ? (
          <>
            <span className="caps">What I learned (dusk). Tap the button: tonight lights</span>
            <div data-testid="po-learned">
              <Poster
                ground="dusk"
                title={saved ? 'One more thing you know.' : 'What did you learn today?'}
                meta={saved ? 'Tonight’s line is kept.' : 'One line is enough.'}
                scene={<WeekLights days={WEEK} tonight={saved ? 'lit' : 'waiting'} />}
                band={saved ? { label: 'This week', words: '3 lines kept' } : { label: 'This week · 2 lines kept', words: 'Tonight’s line lights the third' }}
              >
                <div className="po-actions">
                  <span className="caps">From today’s bike</span>
                  <Button variant="primary" onClick={() => setSaved((s) => !s)}>
                    {saved ? 'Edit' : 'Finish the line'}
                  </Button>
                </div>
              </Poster>
            </div>
          </>
        ) : null}
        {pick === 'po-fitness' ? (
          <>
            <span className="caps">Fitness: the days ahead (a card of its own)</span>
            <div data-testid="po-fitness" className="card gal-poster-card">
              <PathLine label="The days ahead">
                <PathStop state="ahead" node="dot" caption="Tomorrow · Fri 13" title="Easy 3" subtitle="Z2, conversational" chevron onPress={() => {}} />
                <PathStop state="ahead" node="dot" caption="Sat 14" title="Long 5" subtitle="Z2, conversational" chevron onPress={() => {}} />
                <PathStop state="add" title="Add a session" onPress={() => {}} />
              </PathLine>
            </div>
          </>
        ) : null}
        {pick === 'po-long' ? (
          <>
            <span className="caps">Long words: nothing clips</span>
            <div data-testid="po-long" className="gal-poster-stack">
              <Poster
                title="Write the first full draft of the half marathon race report"
                titleSize="goal"
                now="Today’s goal"
                meta="2 h left"
                scene={<PosterScene lit total={4} done={4} />}
                band={{ label: 'To-dos today', words: '4 of 4 done', second: 'the day is yours', trailing: <PathCheck label="Goal done" onPress={() => {}} /> }}
                path={
                  <PathLine>
                    <PathStop state="done" title="Collect every split from the watch and the photos from the finish line" />
                    <PathStop state="done" title="Outline" />
                    <PathStop state="add" title="Add a to-do" onPress={() => {}} />
                  </PathLine>
                }
              />
              <FarHills
                hills={[
                  { caption: '2026 · 50 days left', words: 'Run a half marathon under two hours without walking any of the hills', value: '3 of 12', onPress: () => {} },
                  { caption: 'November · 19 days left', words: 'Four long runs, two of them past ten miles', onPress: () => {} },
                  { caption: 'This week · 4 days left', words: 'Set this week’s goal', plus: true, onPress: () => {} },
                ]}
              />
            </div>
          </>
        ) : null}
      </div>
    </Section>
  );
};
