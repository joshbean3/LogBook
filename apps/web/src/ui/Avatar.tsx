import { useNavInternal, usePushedEntry } from '@/app/NavController';
import { useBootstrap } from '@/api/queries';

export interface AvatarProps {
  /** Override the letter (the gallery; a future display name). Default: the first letter of the account's email. */
  initial?: string;
  className?: string;
}

/**
 * The way to Profile and Settings from every tab header: the account's initial in a 32px circle, a 44px hit area. Tapping
 * it pushes `/settings` (no haptic: it only navigates). On Settings itself it wears the accent ring and is marked current.
 */
/** The account's initial: the first letter of its email, upper case. */
export const useInitial = (override?: string) => {
  const boot = useBootstrap();
  const u = boot.data?.user;
  return (override || u?.name?.trim() || u?.email || '').trim().charAt(0).toUpperCase() || '·';
};

export const Avatar = ({ initial, className = '' }: AvatarProps) => {
  const nav = useNavInternal();
  const here = !!usePushedEntry()?.path.startsWith('/settings');
  const letter = useInitial(initial);
  return (
    <a
      href="/settings"
      className={`avatar ${here ? 'on' : ''} ${className}`}
      aria-label="Profile and settings"
      aria-current={here ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (here) return;
        // Today's avatar pushes Settings; an old header on another tab still shows one until its package lands: a jump
        if (nav.getState().active === 'today') nav.push('/settings');
        else nav.go('/settings');
      }}
    >
      <span className="avatar-disc" aria-hidden="true">
        {letter}
      </span>
    </a>
  );
};
