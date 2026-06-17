/**
 * Late detection based on hardcoded bell schedule timings (stored in DB).
 * Given a lesson period's start time and the moment a student is checked in,
 * decide whether they are on-time or late.
 *
 * LATE_THRESHOLD_MIN — grace period after lesson start before counting as late.
 */
export const LATE_THRESHOLD_MIN = 5;

/** Parse a "HH:MM[:SS]" time string into minutes from midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Returns the suggested attendance status for a check-in at `checkedAt`
 * relative to a lesson that starts at `startsAt` and ends at `endsAt`.
 */
export function detectAttendance(
  startsAt: string,
  endsAt: string,
  checkedAt: Date = new Date()
): 'present' | 'late' | 'absent' {
  const nowMin = checkedAt.getHours() * 60 + checkedAt.getMinutes();
  const start = timeToMinutes(startsAt);
  const end = timeToMinutes(endsAt);

  if (nowMin > end) return 'absent';
  if (nowMin > start + LATE_THRESHOLD_MIN) return 'late';
  return 'present';
}
