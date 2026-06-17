import { useState } from 'react';
import { UserCircle, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { api, apiError } from '../api/client';
import { PageHeader } from '../components/Layout';
import { ErrorBanner, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  student: 'Студент',
  teacher: 'Преподаватель',
  admin: 'Администратор',
};

export default function Profile() {
  const { user } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setOk(false);
    if (next.length < 4) { setErr('Новый пароль минимум 4 символа'); return; }
    if (next !== confirm) { setErr('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      await api.post('/auth/password', { currentPassword: cur, newPassword: next });
      setOk(true);
      setCur(''); setNext(''); setConfirm('');
    } catch (e2) {
      setErr(apiError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Личный кабинет" subtitle="Профиль и безопасность" icon={<UserCircle className="h-6 w-6" />} />

      <div className="card mb-6 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700">
            {user?.fullName?.[0] ?? '?'}
          </div>
          <div>
            <p className="text-lg font-semibold">{user?.fullName}</p>
            <p className="flex items-center gap-1.5 text-sm text-gray-500"><Mail className="h-4 w-4" />{user?.email}</p>
            <span className="badge mt-1 bg-brand-50 text-brand-700">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />{ROLE_LABELS[user?.role ?? ''] ?? ''}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-brand-600" /> Смена пароля</h3>
        {err && <ErrorBanner message={err} />}
        {ok && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
            Пароль успешно изменён
          </div>
        )}
        <div>
          <label className="label">Текущий пароль</label>
          <input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Новый пароль</label>
            <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Повторите пароль</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <button className="btn-primary" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} Сохранить пароль
        </button>
      </form>
    </div>
  );
}
