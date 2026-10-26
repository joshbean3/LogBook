/**
 * The foundation, in one import: `import { Pressable, NavBar, useSheet } from '@/ui'` (contracts rule 1).
 * The navigation API lives in '@/app/NavController' (useNav, useTab, useRouteParams, useRootRequest, useHomeControl).
 */
export * from './primitives';
export { Pressable, type PressableProps, type PressStyle } from './Pressable';
export { usePress } from './usePress';
export { useHold, type HoldInfo, type DragPoint, type HoldState, type HoldOpts, type HoldHandlers } from './useHold';
export { ContextMenu, ContextMenuProvider, useContextMenu, type ContextMenuItem, type ContextMenuProps, type OpenContextMenu, type ContextMenuApi } from './ContextMenu';
export { SwipeRow, type SwipeAction, type SwipeRowProps } from './SwipeRow';
export { Ticker, type TickerProps } from './Ticker';
export { useFirstToday, markSeenToday, resetSeenToday } from './useFirstToday';
export { Skeleton, SkeletonGroup, SkeletonRows, SkeletonPage, type SkeletonProps } from './Skeleton';
export { WeekRing, weekRingLabel, weekRingKept, type WeekDayStatus, type WeekRingProps } from './WeekRing';
export { GhostBars, GhostLines, GhostRows, ghostOf, type GhostBarsProps, type GhostLinesProps, type GhostRowsProps, type GhostKind } from './Ghost';
export { NavBar, DateStrip, TodayPill, PushedBar, BackButton, dayCaption, capsWord, dayTitle, weekCaption, monthCaption, type NavBarProps, type DateStripProps, type StripStatus, type StackedLabel, type PushedBarProps } from './NavBar';
export { DayPager, useDayPagerHandle, type DayPagerHandle, type DayPagerProps } from './DayPager';
export { PushedLayer, usePop, type PushedLayerProps } from './PushedLayer';
export { Avatar, useInitial, type AvatarProps } from './Avatar';
export { SheetProvider, useSheet, useSheetDepth, type SheetApi, type SheetSpec, type Detent } from './Sheet';
export { useSheetMotion, type SheetMotion } from './sheetMotion';
export { ToastProvider, useToast, type ToastAction } from './Toast';
export { createToastStore } from './toastStore';
export { TABS, ROUTES, REFRESH, PAGE_COMMIT, NAV_EVENT, matchRoute, tabDef, type TabId, type TabDef, type RouteDef, type RouteKind, type RouteMatch, type PushedEntry, type TabState, type NavState, type PageCommitDetail, type NavEventDetail } from './nav';
