/**
 * The foundation, in one import: `import { Pressable, ContextMenu, SwipeRow } from '@/ui'`.
 * The manual is docs/foundation.md; every primitive is live at /dev/ui.
 */
export * from './primitives';
export { Pressable, type PressableProps } from './Pressable';
export { ContextMenu, ContextMenuProvider, useContextMenu, type ContextMenuItem, type ContextMenuProps, type OpenContextMenu, type ContextMenuApi } from './ContextMenu';
export { SwipeRow, SWIPE_COMMIT, SWIPE_LOCK, SWIPE_RUBBER, type SwipeAction, type SwipeRowProps } from './SwipeRow';
export { Ticker, type TickerProps } from './Ticker';
export { AnimatedNumber } from './AnimatedNumber';
export { useFirstToday, markSeenToday, resetSeenToday } from './useFirstToday';
export { Skeleton, SkeletonGroup, SkeletonRows, SkeletonPage, type SkeletonProps } from './Skeleton';
export { WeekRing, weekRingLabel, type WeekDayStatus, type WeekRingProps } from './WeekRing';
export { TabHeader, PushedHeader, BackButton, dateLine, usePushedBack, type TabHeaderProps, type PushedHeaderProps } from './headers';
export { PushedPage, usePushedFrame, EDGE_SWIPE_COMMIT, EDGE_SWIPE_PX, EDGE_SWIPE_VELOCITY } from './PushedPage';
export { Avatar, useInitial, type AvatarProps } from './Avatar';
export { DatePager, type DatePagerProps } from './DatePager';
export { SheetProvider, shared, useSheet, useSheetDepth, type SheetApi, type SheetSpec } from './Sheet';
export { ToastProvider, useToast } from './Toast';
export { useLongPress, LONG_PRESS_MS, LONG_PRESS_SLOP, type LongPressInfo } from './useLongPress';
export { TABS, PUSHED, TAB_RESELECT, routeInfo, useRouteInfo, canPopHistory, type TabId, type TabDef, type RouteInfo, type TabReselectDetail } from './nav';
