import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FlaskConical, LineChart, Target } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Field } from '../components/ui';
import { Logo } from '../components/Layout';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: isLogin ? 'demo@hypolab.ru' : '', password: isLogin ? 'demo1234' : '', name: '', company: '', withDemo: true });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      if (isLogin) await login(f.email, f.password); else await register(f);
      nav(loc.state?.from || '/', { replace: true });
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo withText size={36} />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">{isLogin ? 'С возвращением' : 'Создайте аккаунт'}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{isLogin ? 'Войдите, чтобы продолжить работу с гипотезами' : 'Первые гипотезы — уже через 2 минуты'}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {!isLogin && (<>
              <Field label="Имя"><input className="input" value={f.name} onChange={set('name')} placeholder="Анна Ковалёва" autoFocus /></Field>
              <Field label="Компания / магазин" hint="Необязательно"><input className="input" value={f.company} onChange={set('company')} placeholder="ИП Иванова" /></Field>
            </>)}
            <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} placeholder="you@company.ru" autoComplete="email" /></Field>
            <Field label="Пароль"><input className="input" type="password" value={f.password} onChange={set('password')} placeholder="Минимум 6 символов" autoComplete={isLogin ? 'current-password' : 'new-password'} /></Field>
            {!isLogin && (
              <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <input type="checkbox" checked={f.withDemo} onChange={set('withDemo')} className="mt-0.5 accent-brand-600" />
                <span><b className="font-medium">Заполнить демо-данными</b><span className="block text-xs text-slate-500">11 гипотез и 2 выгрузки аналитики — можно удалить позже</span></span>
              </label>
            )}
            {err && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 animate-fade-in">{err}</div>}
            <Button type="submit" size="lg" className="w-full" loading={loading}>{isLogin ? 'Войти' : 'Зарегистрироваться'} <ArrowRight className="h-4 w-4" /></Button>
          </form>
          {isLogin && <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">Демо-доступ уже подставлен: <b>demo@hypolab.ru</b> / <b>demo1234</b></p>}
          <p className="mt-6 text-center text-sm text-slate-500">
            {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
            <Link to={isLogin ? '/register' : '/login'} className="font-medium text-brand-600 hover:text-brand-700">{isLogin ? 'Зарегистрироваться' : 'Войти'}</Link>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-600 lg:block">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-16 text-white">
          <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">Для селлеров Wildberries, Ozon, Яндекс Маркета</span>
          <h2 className="mt-6 max-w-md text-4xl font-semibold leading-tight tracking-tight">Рост продаж — это система гипотез, а не удача</h2>
          <div className="mt-10 space-y-5">
            {[[Target, 'Генератор по методологии Growth Hacking', 'Воронка AARRR, SMART-формулировки и ICE-приоритизация'],
              [FlaskConical, 'Цикл HADI от идеи до масштабирования', 'Бэклог со статусами, канбан и история изменений'],
              [LineChart, 'Автоанализ «до / во время / после»', 'Загрузите Excel из ЛК — метрики и даты распознаются сами']].map(([I, t, d]) => (
              <div key={t} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20"><I className="h-5 w-5" /></div>
                <div><div className="font-medium">{t}</div><div className="text-sm text-white/70">{d}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-12 max-w-md rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
            <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-300" />Гипотеза подтверждена</div>
            <div className="mt-1 text-sm text-white/80">CTR карточки: <b className="text-white">+22,4%</b> при цели +15%, p &lt; 0,001. Эффект сохранился после теста.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
