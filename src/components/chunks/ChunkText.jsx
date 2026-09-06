import { useMemo, useState } from 'react';
import cn from '../../utils/cn';
import { stripHtml } from '../../utils/format';

/** Past this many characters a chunk gets a toggle instead of the whole wall. */
const PREVIEW_LENGTH = 320;

/**
 * Chunk text is arbitrary length, so it is clipped by character count rather
 * than by height: measuring the DOM would mean a layout pass per row, and the
 * cutoff only has to be "enough to recognise the passage".
 *
 * The clip is measured on the cleaned text, so the count in the toggle matches
 * what is actually on screen rather than counting stripped markup.
 */
const ChunkText = ({ text, className }) => {
  const [open, setOpen] = useState(false);

  const value = useMemo(() => stripHtml(text), [text]);
  const clipped = value.length > PREVIEW_LENGTH;
  const shown = clipped && !open ? `${value.slice(0, PREVIEW_LENGTH).trimEnd()}…` : value;

  return (
    <div>
      <p className={cn('whitespace-pre-wrap break-words leading-relaxed', className)}>{shown}</p>

      {clipped && (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="mt-1.5 text-[12px] font-medium text-blue hover:underline"
        >
          {open ? 'Show less' : `Show more (${value.length.toLocaleString()} characters)`}
        </button>
      )}
    </div>
  );
};

export default ChunkText;
