import { CircleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/errorReport';
import { SectionEmpty } from '@/ui/primitives';

interface Props {
  /** The section's name, for the row's label and the report: "Plan your day", "Habits". */
  name: string;
  /** When this changes (the page's day), a section that broke is drawn again. */
  resetKey?: string;
  children: ReactNode;
}
interface State {
  error: Error | null;
  /** The key the error was caught under. */
  at?: string;
}

/**
 * One Today section's own boundary. The page's boundary (app/ErrorBoundary.tsx, scope `page`) replaces the whole screen
 * with "This screen hit a snag"; a section that throws inside this one is replaced by a single row and the rest of Today
 * (the training card, the habits, the journal, the tab bar) keeps working. The row says so and offers Try again, which
 * draws the section once more; it is reported once, like every other crash (Contract 7).
 */
export class SectionGuard extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // another day's page (or the same page on a new day) starts clean
    if (state.error && state.at !== undefined && state.at !== props.resetKey) return { error: null, at: undefined };
    return null;
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    reportError(error, `section: ${this.props.name}${info.componentStack ? `\ncomponent stack:${info.componentStack}` : ''}`);
    this.setState({ at: this.props.resetKey ?? '' });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="day-guard" aria-label={this.props.name} role="alert">
        <SectionEmpty icon={<CircleAlert size={18} aria-hidden="true" />} title="This part hit a snag" line="Your data is safe." action={{ label: 'Try again', onPress: () => this.setState({ error: null, at: undefined }), voiceLabel: `Try again: ${this.props.name}` }} />
      </section>
    );
  }
}
