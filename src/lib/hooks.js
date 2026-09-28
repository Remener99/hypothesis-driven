import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './api';
import { iceScore } from './constants';

export const useHypotheses = () => useQuery({ queryKey: ['hypotheses'], queryFn: () => api('/hypotheses') });
export const useHypothesis = id => useQuery({ queryKey: ['hypothesis', +id], queryFn: () => api('/hypotheses/' + id), enabled: !!id });
export const useDatasets = () => useQuery({ queryKey: ['datasets'], queryFn: () => api('/datasets') });
export const useDataset = (id, sku) => useQuery({ queryKey: ['dataset', +id, sku || ''], queryFn: () => api(`/datasets/${id}${sku ? '?sku=' + encodeURIComponent(sku) : ''}`), enabled: !!id, placeholderData: p => p });
export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api('/stats') });

const withIce = h => ({ ...h, ice: iceScore(h.impact, h.confidence, h.ease) });

/** Create with optimistic insertion of a temporary row */
export function useCreateHypothesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: body => api('/hypotheses', { method: 'POST', body }),
    onMutate: async body => {
      await qc.cancelQueries({ queryKey: ['hypotheses'] });
      const prev = qc.getQueryData(['hypotheses']);
      const temp = withIce({ id: 'tmp-' + Date.now(), status: 'planned', tags: [], impact: 5, confidence: 5, ease: 5, ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19), _optimistic: true });
      qc.setQueryData(['hypotheses'], old => (old ? [temp, ...old] : [temp]));
      return { prev, tempId: temp.id };
    },
    onError: (e, _, ctx) => { qc.setQueryData(['hypotheses'], ctx?.prev); toast.error(e.message); },
    onSuccess: (h, _, ctx) => { qc.setQueryData(['hypotheses'], old => old?.map(x => (x.id === ctx.tempId ? h : x))); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['stats'] }); },
  });
}

/** Update with optimistic patch in list + detail caches, rollback on error */
export function useUpdateHypothesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api('/hypotheses/' + id, { method: 'PATCH', body }),
    onMutate: async ({ id, ...patch }) => {
      await Promise.all([qc.cancelQueries({ queryKey: ['hypotheses'] }), qc.cancelQueries({ queryKey: ['hypothesis', id] })]);
      const prevList = qc.getQueryData(['hypotheses']);
      const prevOne = qc.getQueryData(['hypothesis', id]);
      const apply = h => withIce({ ...h, ...patch, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19) });
      qc.setQueryData(['hypotheses'], old => old?.map(h => (h.id === id ? apply(h) : h)));
      if (prevOne) qc.setQueryData(['hypothesis', id], apply(prevOne));
      return { prevList, prevOne, id };
    },
    onError: (e, _, ctx) => {
      qc.setQueryData(['hypotheses'], ctx.prevList);
      if (ctx.prevOne) qc.setQueryData(['hypothesis', ctx.id], ctx.prevOne);
      toast.error('Не удалось сохранить: ' + e.message);
    },
    onSuccess: (h, { id }) => { qc.setQueryData(['hypotheses'], old => old?.map(x => (x.id === id ? h : x))); },
    onSettled: (_, __, { id }) => {
      qc.invalidateQueries({ queryKey: ['hypothesis', id] });
      qc.invalidateQueries({ queryKey: ['analysis', id] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/** Delete: optimistic removal + undo toast (delayed commit) */
export function useDeleteHypothesis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: id => api('/hypotheses/' + id, { method: 'DELETE' }),
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: ['hypotheses'] });
      const prev = qc.getQueryData(['hypotheses']);
      qc.setQueryData(['hypotheses'], old => old?.filter(h => h.id !== id));
      return { prev };
    },
    onError: (e, _, ctx) => { qc.setQueryData(['hypotheses'], ctx.prev); toast.error(e.message); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['stats'] }); qc.invalidateQueries({ queryKey: ['datasets'] }); },
  });
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: id => api('/datasets/' + id, { method: 'DELETE' }),
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: ['datasets'] });
      const prev = qc.getQueryData(['datasets']);
      qc.setQueryData(['datasets'], old => old?.filter(d => d.id !== id));
      return { prev };
    },
    onError: (e, _, ctx) => { qc.setQueryData(['datasets'], ctx.prev); toast.error(e.message); },
    onSuccess: () => toast.success('Датасет удалён'),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['datasets'] }); qc.invalidateQueries({ queryKey: ['hypotheses'] }); qc.invalidateQueries({ queryKey: ['stats'] }); },
  });
}

export function useUpdateDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api('/datasets/' + id, { method: 'PATCH', body }),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['datasets'] });
      const prev = qc.getQueryData(['datasets']);
      qc.setQueryData(['datasets'], old => old?.map(d => (d.id === id ? { ...d, ...patch } : d)));
      return { prev };
    },
    onError: (e, _, ctx) => { qc.setQueryData(['datasets'], ctx.prev); toast.error(e.message); },
    onSettled: (_, __, { id }) => { qc.invalidateQueries({ queryKey: ['datasets'] }); qc.invalidateQueries({ queryKey: ['dataset', id] }); },
  });
}
