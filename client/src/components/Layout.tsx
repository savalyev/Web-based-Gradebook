import { ReactNode, useState } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import {
  CalendarDays,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LogOut,
  Menu,
  X,
  FlaskConical,
  Users,
  Library,
  BookMarked,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const studentNav: NavItem[] = [
  { to: '/', label: 'Расписание', icon: <CalendarDays className="h-5 w-5" /> },
  { to: '/journal', label: 'Журнал', icon: <BookOpen className="h-5 w-5" /> },
];

const teacherNav: NavItem[] = [
  { to: '/', label: 'Расписание', icon: <CalendarDays className="h-5 w-5" /> },
  { to: '/courses', label: 'Журнал', icon: <BookOpen className="h-5 w-5" /> },
];

const adminNav: NavItem[] = [
  { to: '/admin/users', label: 'Пользователи', icon: <Users className="h-5 w-5" /> },
  { to: '/admin/groups', label: 'Группы', icon: <Layers className="h-5 w-5" /> },
  { to: '/admin/subjects', label: 'Предметы', icon: <Library className="h-5 w-5" /> },
  { to: '/admin/courses', label: 'Курсы', icon: <BookMarked className="h-5 w-5" /> },
  { to: '/admin/schedule', label: 'Расписание', icon: <CalendarDays className="h-5 w-5" /> },
];

const ROLE_LABELS: Record<string, string> = {
  teacher: 'Преподаватель',
  student: 'Студент',
  admin: 'Администратор',
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const nav =
    user?.role === 'teacher' ? teacherNav : user?.role === 'admin' ? adminNav : studentNav;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Электронный</p>
          <p className="text-sm font-bold leading-tight text-brand-600">журнал</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <Link
          to="/profile"
          onClick={() => setOpen(false)}
          className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {user?.fullName?.[0] ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.fullName}</p>
            <p className="text-xs text-gray-400">{ROLE_LABELS[user?.role ?? ''] ?? ''}</p>
          </div>
        </Link>
        <button onClick={handleLogout} className="btn-ghost w-full justify-start">
          <LogOut className="h-4 w-4" /> Выйти
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-gray-100 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-gray-100 lg:hidden">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold lg:hidden">Электронный журнал</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export { ClipboardList, FlaskConical };
