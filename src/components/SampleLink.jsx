import { IS_STATIC } from '../lib/api';

/** Link to a demo .xlsx: served by the API, or generated in the browser in the static build */
export default function SampleLink({ file, children, className }) {
  if (!IS_STATIC) return <a href={'/api/samples/' + file} className={className}>{children}</a>;
  const onClick = async e => { e.preventDefault(); const { downloadSample } = await import('../local/backend.js'); downloadSample(file); };
  return <a href={'#download-' + file} onClick={onClick} className={className}>{children}</a>;
}
