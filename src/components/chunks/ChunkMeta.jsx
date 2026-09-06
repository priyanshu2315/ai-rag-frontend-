/**
 * Whatever the ingester recorded about a chunk — the page it came from, its
 * position in the document, and anything added later.
 *
 * Known keys get read as a phrase ("Page 3"); the rest fall back to their own
 * name, so a field the backend starts sending tomorrow shows up here instead
 * of being silently dropped.
 */
const LABELS = {
  page_number: 'Page',
  chunk_index: 'Chunk',
};

const describe = ([key, value]) =>
  LABELS[key] ? `${LABELS[key]} ${value}` : `${key.replace(/_/g, ' ')}: ${value}`;

const entriesOf = (metadata) =>
  Object.entries(metadata ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );

const ChunkMeta = ({ metadata, className }) => {
  const entries = entriesOf(metadata);
  if (entries.length === 0) return null;

  return (
    <ul className={className}>
      {entries.map((entry) => (
        <li
          key={entry[0]}
          className="rounded-(--radius-sm) border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted"
        >
          {describe(entry)}
        </li>
      ))}
    </ul>
  );
};

export default ChunkMeta;
