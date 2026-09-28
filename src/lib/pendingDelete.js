// Deferred deletes with "Undo": items are hidden immediately (optimistic),
// the DELETE request is sent only after the undo window expires.
import { useSyncExternalStore } from 'react';
let hidden = new Set();
const subs = new Set();
const emit = () => { hidden = new Set(hidden); subs.forEach(f => f()); };
export const hide = id => { hidden.add(id); emit(); };
export const unhide = id => { hidden.delete(id); emit(); };
export const useHidden = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => hidden);
