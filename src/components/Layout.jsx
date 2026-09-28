import { useEffect, useId, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Sparkles, KanbanSquare, Database, Settings, LogOut, Menu as MenuIcon, X, Plus, ChevronsUpDown, BookOpen } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useHypotheses } from '../lib/hooks';
import { cn, Menu, MenuItem } from './ui';
import { IS_STATIC } from '../lib/api';

export function Logo({ size = 32, withText }) {
  const gid = 'lg' + useId().replace(/:/g, '');
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#6d28d9" /></linearGradient></defs>
        <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
        <path d="M9 21.5c2.5-1 4-3.5 5.2-6.3 1-2.3 2.3-4.2 4.3-4.2 2.4 0 2.7 3 4.5 3" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="23" cy="14" r="2.2" fill="#fde68a" />
      </svg>
      {withText && <span className="text-[17px] font-semibold tracking-tight">Hypo<span className="text-brand-600">Lab</span></span>}
    </div>
  );
}

function Nav({ onNavigate }) {
  const { data } = useHypotheses();
  const testing = data?.filter(h => h.status === 'testing').length;
  const backlog = data?.length;
  const items = [
    { to: '/', label: 'Обзор', icon: LayoutDashboard, end: true },
    { to: '/generator', label: 'Генератор гипотез', icon: Sparkles },
    { to: '/backlog', label: 'Бэклог', icon: KanbanSquare, badge: backlog, badge2: testing },
    { to: '/data', label: 'Данные и анализ', icon: Database },
  ];
  return (
    <nav className="space-y-0.5">
      {items.map(i => (
        <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate}
          className={({ isActive }) => cn('group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition', isActive ? 'bg-white text-slate-900 shadow-soft ring-1 ring-slate-200/70' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900')}>
          {({ isActive }) => (<>
            <i.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} />
            <span className="flex-1">{i.label}</span>
            {i.badge2 ? <span title="Тестируется" className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700">{i.badge2}</span> : null}
            {i.badge != null && <span className="text-xs tabular-nums text-slate-400">{i.badge}</span>}
          </>)}
        </NavLink>
      ))}
    </nav>
  );
}

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex h-full flex-col gap-6 px-3 py-4">
      <div className="px-2"><Logo withText /></div>
      <button onClick={() => { nav('/generator'); onNavigate?.(); }} className="group flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-3 py-2.5 text-sm font-medium text-white shadow-md shadow-brand-600/25 transition hover:from-brand-600 hover:to-brand-700 active:scale-[.98]">
        <Plus className="h-4 w-4 transition group-hover:rotate-90" /> Новая гипотеза
      </button>
      <Nav onNavigate={onNavigate} />
      <div className="mt-auto space-y-3">
        {IS_STATIC && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <b className="font-semibold">Демо-версия.</b> Все данные хранятся только в этом браузере и никуда не отправляются.
          </div>
        )}
        <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-800"><BookOpen className="h-4 w-4" />Цикл HADI</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600"><b>H</b>ypothesis → <b>A</b>ction → <b>D</b>ata → <b>I</b>nsights. Проверяйте 2–3 гипотезы в неделю.</p>
        </div>
        <Menu align="left" trigger={
          <button className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-white/70">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-xs font-semibold text-white">{user?.name?.split(' ').map(s => s[0]).slice(0, 2).join('')}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{user?.name}</div><div className="truncate text-xs text-slate-500">{user?.company || user?.email}</div></div>
            <ChevronsUpDown className="h-4 w-4 text-slate-400" />
          </button>}>
          <MenuItem icon={Settings} onClick={() => { nav('/settings'); onNavigate?.(); }}>Настройки профиля</MenuItem>
          <MenuItem icon={LogOut} danger onClick={logout}>Выйти</MenuItem>
        </Menu>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/70 bg-slate-100/70 backdrop-blur lg:block"><Sidebar /></aside>
      {/* mobile */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur lg:hidden">
        <Logo withText size={28} />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Меню"><MenuIcon className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-slate-50 shadow-pop animate-fade-in">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 hover:bg-slate-200"><X className="h-4 w-4" /></button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <main className="lg:pl-64">
        <div key={loc.pathname} className="mx-auto max-w-[1400px] px-4 py-6 animate-fade-in sm:px-6 lg:px-8 lg:py-8"><Outlet /></div>
      </main>
    </div>
  );
}
