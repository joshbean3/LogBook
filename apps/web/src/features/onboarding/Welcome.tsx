import { Link } from 'react-router';

/** Placeholder for first run (/welcome/*). The onboarding team replaces this file (docs/experience.md §5.8). */
export default function Welcome() {
  return (
    <main className="page" style={{ minHeight: '100dvh', display: 'grid', alignContent: 'center', gap: 8 }}>
      <h1 className="ph-title">Welcome</h1>
      <p className="ink2">Your day, lit.</p>
      <Link to="/today" className="btn primary" style={{ justifySelf: 'start', marginTop: 24 }}>
        Start
      </Link>
    </main>
  );
}
