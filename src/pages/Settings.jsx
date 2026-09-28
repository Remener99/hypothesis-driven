import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Confirm, Field, PageHeader } from '../components/ui';

export default function Settings() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const [p, setP] = useState({ name: user.name, company: user.company || '' });
  const [pw, setPw] = useState({ currentPassword: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [reset, setReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function saveProfile(e) {
    e.preventDefault(); setSaving(true);
    const prev = user; setUser({ ...user, ...p }); // optimistic
    try { const r = await api('/auth/me', { method: 'PATCH', body: p }); setUser(r.user); toast.success('Профиль обновлён'); }
    catch (e) { setUser(prev); toast.error(e.message); } finally { setSaving(false); }
  }
  async function savePw(e) {
    e.preventDefault(); setPwSaving(true);
    try { await api('/auth/me', { method: 'PATCH', body: pw }); setPw({ currentPassword: '', password: '' }); toast.success('Пароль изменён'); }
    catch (e) { toast.error(e.message); } finally { setPwSaving(false); }
  }
  async function doReset() {
    setResetting(true);
    try { await api('/demo/reset', { method: 'POST' }); await qc.invalidateQueries(); toast.success('Демо-данные восстановлены'); setReset(false); }
    catch (e) { toast.error(e.message); } finally { setResetting(false); }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Настройки" subtitle={user.email} />
      <form onSubmit={saveProfile} className="card space-y-4 p-5">
        <h2 className="font-semibold">Профиль</h2>
        <Field label="Имя"><input className="input" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} /></Field>
        <Field label="Компания / магазин"><input className="input" value={p.company} onChange={e => setP({ ...p, company: e.target.value })} /></Field>
        <div className="flex justify-end"><Button type="submit" icon={Save} loading={saving}>Сохранить</Button></div>
      </form>
      <form onSubmit={savePw} className="card mt-6 space-y-4 p-5">
        <h2 className="font-semibold">Смена пароля</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Текущий пароль"><input type="password" className="input" value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="Новый пароль"><input type="password" className="input" value={pw.password} onChange={e => setPw({ ...pw, password: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end"><Button type="submit" variant="secondary" icon={KeyRound} loading={pwSaving} disabled={!pw.password}>Изменить пароль</Button></div>
      </form>
      <div className="card mt-6 flex flex-col gap-3 border-rose-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold">Сбросить демо-данные</h2><p className="text-sm text-slate-500">Удалит все ваши гипотезы и датасеты и загрузит демонстрационный набор заново.</p></div>
        <Button variant="secondary" icon={RotateCcw} className="text-rose-600" onClick={() => setReset(true)}>Сбросить</Button>
      </div>
      <Confirm open={reset} onClose={() => setReset(false)} onConfirm={doReset} loading={resetting} title="Сбросить все данные?" text="Все гипотезы и загруженные файлы будут заменены демо-набором." confirmText="Сбросить" />
    </div>
  );
}
