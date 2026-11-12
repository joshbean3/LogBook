/**
 * The poster kit: the card every redesigned screen leads with, and the pictures under and inside it.
 * `import { Poster, PosterScene, PathLine, PathStop, PathCheck, FarHills, WeekLights } from '@/ui/poster'`.
 */
export { Poster, type PosterBand, type PosterProps } from './Poster';
export { PosterScene, type PosterSceneProps } from './PosterScene';
export { PathCheck, PathLine, PathStop, type PathCheckProps, type PathLineProps, type PathStopProps } from './PathLine';
export { FarHills, type FarHill, type FarHillsProps } from './FarHills';
export { WeekLights, type WeekLight, type WeekLightsProps } from './WeekLights';
export { pathSegments, stopStates, sunProgress, type Segment, type StopSegments, type StopState } from './logic';
