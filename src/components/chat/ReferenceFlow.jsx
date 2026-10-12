import { chunkLocation, followedReferences } from '../../utils/crossReferences';

const ReferenceFlow = ({ chunks, onSelect }) => {
  const links = followedReferences(chunks);
  return links.length > 0 && <div className="mt-2 space-y-2" aria-label="Followed reference paths">{links.map((link, index) => <button key={index} type="button"
    onClick={() => onSelect?.(link)} disabled={!onSelect} className="block w-full rounded-(--radius-sm) border border-amber-400/40 bg-amber-50 p-3 text-left text-[12px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">
    <strong className="block">🔗 Followed Reference: {link.reference ?? 'Unspecified reference'}</strong>
    <span className="mt-1 block">{chunkLocation(link.seed)}</span>
    <span className="ml-3 block">└─→ Referenced: {link.reference ?? 'Unspecified reference'}</span>
    <span className="ml-6 block">└─→ Pulled: {chunkLocation(link.target)}</span>
    {onSelect && <span className="mt-1 block text-[11px]">Show connected evidence</span>}
  </button>)}</div>;
};
export default ReferenceFlow;
