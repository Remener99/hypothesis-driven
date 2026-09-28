import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { STATUS_MAP, MP_COLORS } from '../lib/constants';

export const cn = clsx;

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, ...p }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  }[variant];
  const s = { sm: 'h-8 px-2.5 text-[13px] gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', lg: 'h-11 px-5 text-sm gap-2' }[size];
  return (
    <button {...p} disabled={p.disabled || loading} className={cn('inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50', v, s, className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, className, label, ...p }) {
  return (
    <button aria-label={label} title={label} {...p} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800', className)}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function StatusBadge({ status, className }) {
  const s = STATUS_MAP[status] || STATUS_MAP.planned;
  return (
    <span className={cn('chip ring-1 ring-inset', s.chip, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />{s.label}
    </span>
  );
}

export function MpBadge({ mp }) {
  if (!mp) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={cn('h-2 w-2 rounded-sm', MP_COLORS[mp] || 'bg-slate-400')} />{mp}
    </span>
  );
}

export function IceBadge({ value, className }) {
  const c = value >= 7 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : value >= 5 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-100 text-slate-600 ring-slate-200';
  return <span title="ICE-скор = ∛(Impact × Confidence × Ease)" className={cn('chip ring-1 ring-inset tabular-nums', c, className)}>ICE {value?.toFixed?.(1) ?? value}</span>;
}

export function Skeleton({ className }) { return <div className={cn('skeleton', className)} />; }

export function EmptyState({ icon: Icon, title, text, action, className, illustration }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in', className)}>
      {illustration || (
        <div className="relative mb-5">
          <div className="absolute inset-0 -m-3 rounded-full bg-brand-100/60 blur-xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-100 bg-gradient-to-b from-white to-brand-50 shadow-soft">
            {Icon && <Icon className="h-6 w-6 text-brand-600" />}
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const h = e => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop animate-scale-in sm:rounded-2xl', w)}>
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              {title && <h2 className="text-base font-semibold">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            {onClose && <IconButton icon={X} onClick={onClose} label="Закрыть" className="-mr-1.5 -mt-1" />}
          </div>
        )}
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, onClose, onConfirm, title, text, confirmText = 'Удалить', loading }) {
  return (
    <Modal open={open} onClose={onClose} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button variant="danger" loading={loading} onClick={onConfirm}>{confirmText}</Button></>}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50"><AlertTriangle className="h-5 w-5 text-rose-600" /></div>
        <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-slate-500">{text}</p></div>
      </div>
    </Modal>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Select({ value, onChange, options, className, placeholder, ...p }) {
  return (
    <select {...p} value={value ?? ''} onChange={e => onChange(e.target.value)} className={cn('input appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%2394a3b8%27%3E%3Cpath d=%27M5.5 7.5l4.5 4.5 4.5-4.5%27 stroke=%27%2394a3b8%27 stroke-width=%271.5%27 fill=%27none%27/%3E%3C/svg%3E")] bg-[length:18px] bg-[right_8px_center] bg-no-repeat pr-8', className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(o => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export function Menu({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div onClick={() => setOpen(false)} className={cn('absolute z-30 mt-1 min-w-[200px] rounded-xl border border-slate-200 bg-white p-1 shadow-pop animate-scale-in', align === 'right' ? 'right-0' : 'left-0')}>
          {children}
        </div>
      )}
    </div>
  );
}
export function MenuItem({ icon: Icon, children, danger, ...p }) {
  return (
    <button {...p} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition', danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100')}>
      {Icon && <Icon className="h-4 w-4 opacity-70" />}{children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented({ value, onChange, options, className }) {
  return (
    <div className={cn('inline-flex rounded-lg bg-slate-100 p-0.5', className)}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium transition', value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
          {o.icon && <o.icon className="h-3.5 w-3.5" />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, onChange, hint }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-700">{label}</span>
        <span className="rounded-md bg-slate-100 px-1.5 text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <input type="range" min={1} max={10} value={value} onChange={e => onChange(+e.target.value)} className="w-full" />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Spinner({ className }) { return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} />; }

export function TagInput({ value = [], onChange, placeholder = 'Добавьте тег и нажмите Enter' }) {
  const [t, setT] = useState('');
  const add = () => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setT(''); };
  return (
    <div className="input flex min-h-[38px] flex-wrap items-center gap-1.5 py-1.5">
      {value.map(tag => (
        <span key={tag} className="chip bg-brand-50 text-brand-700">
          {tag}<button type="button" onClick={() => onChange(value.filter(x => x !== tag))} className="hover:text-brand-900"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={t} onChange={e => setT(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1)); }} onBlur={add} placeholder={value.length ? '' : placeholder} className="min-w-[120px] flex-1 bg-transparent text-sm outline-none" />
    </div>
  );
}
