export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

const KEY = 'hl_token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: t => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch {} },
};

export async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, credentials: 'include', headers: {} };
  const t = tokenStore.get();
  if (t) opts.headers.Authorization = 'Bearer ' + t;
  if (form) opts.body = form;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch('/api' + path, opts); } catch { throw new ApiError('Нет соединения с сервером', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) tokenStore.set(null);
    if (res.status === 401 && !path.startsWith('/auth')) window.dispatchEvent(new Event('hl:unauthorized'));
    throw new ApiError(data.error || `Ошибка ${res.status}`, res.status);
  }
  return data;
}
