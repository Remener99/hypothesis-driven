import METRICS from './metrics.js';
export { METRICS };
export const METRIC_MAP = Object.fromEntries(METRICS.map(m => [m.key, m]));
