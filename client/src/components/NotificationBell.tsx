import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, GraduationCap, ClipboardCheck, AlarmClock } from 'lucide-react';
import { api } from '../api/client';

interface Notif {
  id: number;
  type: 'grade' | 'review' | 'deadline' | 'info';
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const ICONS: Record<string, JSX.Element> = {
  grade: <GraduationCap className="h-4 w-4 text-brand-600" />,
  review: <ClipboardCheck className="h-4 w-4 text-green-600" />,
  deadline: <AlarmClock className="h-4 w-4 text-amber-500" />,
  info: <Bell className="h-4 w-4 text-gray-400" />,
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return new Date(iso).toLocaleDateString('ru-RU');
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    api
      .get('/notifications')
      .then((res) => {
        setItems(res.data.notifications);
        setUnread(res.data.unread);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAll = async () => {
    await api.post('/notifications/read');
    setItems((p) => p.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const openItem = async (n: Notif) => {
    if (!n.is_read) {
      await api.post(`/notifications/${n.id}/read`).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        aria-label="Уведомления"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="font-semibold">Уведомления</span>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Прочитать все
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Уведомлений нет</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${
                    n.is_read ? '' : 'bg-brand-50/40'
                  }`}
                >
                  <span className="mt-0.5">{ICONS[n.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body && <span className="block truncate text-sm text-gray-500">{n.body}</span>}
                    <span className="block text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
