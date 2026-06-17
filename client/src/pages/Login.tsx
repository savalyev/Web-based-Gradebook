import { FormEvent, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiError } from '../api/client';
import { Spinner } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Введите email и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const fill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-white to-brand-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-200">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Электронный журнал</h1>
          <p className="text-sm text-gray-500">Войдите, чтобы продолжить</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
              {error}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Spinner className="h-4 w-4" />}
            Войти
          </button>
        </form>

        <div className="mt-4 rounded-lg border border-gray-100 bg-white p-4 text-sm">
          <p className="mb-2 font-medium text-gray-600">Демо-доступ:</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fill('admin@demo', 'admin123')}
              className="btn-secondary !px-2 text-xs"
            >
              Админ
            </button>
            <button
              type="button"
              onClick={() => fill('teacher@demo', 'teacher123')}
              className="btn-secondary !px-2 text-xs"
            >
              Препод.
            </button>
            <button
              type="button"
              onClick={() => fill('student@demo', 'student123')}
              className="btn-secondary !px-2 text-xs"
            >
              Студент
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
