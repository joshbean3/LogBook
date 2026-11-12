/**
 * Today's row for the line is the Journal row now (features/journal/TonightRow.tsx). This file only keeps the old name
 * working until Today mounts `TonightRow` itself; it can go once nothing imports it.
 */
export { TonightRow as LearnedPrompt } from '../journal/TonightRow';
