import { useEffect, useState } from 'react';
import { Plus, Trash2, Layers, Library } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, EmptyState } from '../../components/ui';

interface Item {
  id: number;
  name: string;
}

/** Generic CRUD list for simple name-only dictionaries (groups / subjects). */
function Dictionary({
  path,
  title,
  subtitle,
  icon,
  placeholder,
}: {
  path: 'groups' | 'subjects';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  placeholder: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get(`/admin/${path}`)
      .then((res) => setItems(res.data[path]))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [path]);

  const add = async () => {
    if (!name.trim()) return;
    try {
      await api.post(`/admin/${path}`, { name: name.trim() });
      setName('');
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить? Это также удалит связанные данные.')) return;
    try {
      await api.delete(`/admin/${path}/${id}`);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} icon={icon} />
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      <div className="card mb-4 flex gap-2 p-4">
        <input
          className="input"
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn-primary shrink-0" onClick={add}>
          <Plus className="h-4 w-4" /> Добавить
        </button>
      </div>

      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState title="Пусто" hint="Добавьте первую запись выше" />
      ) : (
        <div className="card divide-y divide-gray-50">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{it.name}</span>
              <button className="btn-ghost !px-2 text-brand-600" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminGroups() {
  return (
    <Dictionary
      path="groups"
      title="Группы"
      subtitle="Учебные группы студентов"
      icon={<Layers className="h-6 w-6" />}
      placeholder="Например, ИС-21"
    />
  );
}

export function AdminSubjects() {
  return (
    <Dictionary
      path="subjects"
      title="Предметы"
      subtitle="Справочник учебных дисциплин"
      icon={<Library className="h-6 w-6" />}
      placeholder="Например, Базы данных"
    />
  );
}
