import { query } from '../config/db';

interface NotifyInput {
  userId: number;
  type: 'grade' | 'review' | 'deadline' | 'info';
  title: string;
  body?: string | null;
  link?: string | null;
  refId?: number | null;
}

/**
 * Create (or refresh) a notification. Re-using the same (user, type, ref_id)
 * marks it unread again — e.g. when a grade is changed.
 */
export async function notify(n: NotifyInput): Promise<void> {
  await query(
    `INSERT INTO notifications (user_id, type, title, body, link, ref_id, is_read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, now())
     ON CONFLICT (user_id, type, ref_id) DO UPDATE SET
       title = EXCLUDED.title,
       body = EXCLUDED.body,
       link = EXCLUDED.link,
       is_read = false,
       created_at = now()`,
    [n.userId, n.type, n.title, n.body ?? null, n.link ?? null, n.refId ?? null]
  );
}
