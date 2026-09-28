// Isomorphic SheetJS import: Node gets the CJS module via `default`,
// the browser (xlsx.mjs) exposes named exports only.
import * as ns from 'xlsx';
const DEFAULT_KEY = 'default';
const cjs = ns[DEFAULT_KEY];
const XLSX = cjs && cjs.read ? cjs : ns;
export default XLSX;
