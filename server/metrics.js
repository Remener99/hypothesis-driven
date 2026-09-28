import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const METRICS = JSON.parse(readFileSync(path.join(__dirname, '..', 'shared', 'metrics.json'), 'utf8'));
export const METRIC_MAP = Object.fromEntries(METRICS.map(m => [m.key, m]));
