import type { WatchState } from '@shared/types'

/** Items count as watched once 95% of the runtime has played. */
export function computeState(positionMs: number, durationMs: number): WatchState {
  if (durationMs <= 0) return 'in_progress'
  if (positionMs / durationMs >= 0.95) return 'watched'
  return 'in_progress'
  // NOTE: we never downgrade to 'unwatched' here — once play is pressed the
  // item is in_progress regardless of position (including position=0).
}
