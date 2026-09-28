import { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from './api';

const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me').then(r => r.user).catch(() => null), staleTime: Infinity, retry: false });
  useEffect(() => {
    const h = () => { tokenStore.set(null); qc.setQueryData(['me'], null); };
    window.addEventListener('hl:unauthorized', h);
    return () => window.removeEventListener('hl:unauthorized', h);
  }, [qc]);
  const value = {
    user: data, loading: isLoading,
    async login(email, password) { const r = await api('/auth/login', { method: 'POST', body: { email, password } }); tokenStore.set(r.token); qc.removeQueries({ predicate: q => q.queryKey[0] !== 'me' }); qc.setQueryData(['me'], r.user); },
    async register(p) { const r = await api('/auth/register', { method: 'POST', body: p }); tokenStore.set(r.token); qc.removeQueries({ predicate: q => q.queryKey[0] !== 'me' }); qc.setQueryData(['me'], r.user); },
    async logout() { await api('/auth/logout', { method: 'POST' }).catch(() => {}); tokenStore.set(null); qc.removeQueries({ predicate: q => q.queryKey[0] !== 'me' }); qc.setQueryData(['me'], null); },
    setUser(u) { qc.setQueryData(['me'], u); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
