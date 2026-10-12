import { messageCitations, messageSteps, normalizeCitations } from './messageMetadata.js';
import { parseCitations } from './crag.js';
import { referenceNotice } from './crossReferences.js';

export const safeFileUrl = (value) => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};

export const sourceKey = (source) => JSON.stringify([
  source.documentId, source.fileUrl, source.chunkId ?? source.id ?? source.sourceId, source.pageNumber, source.startOffset, source.endOffset,
]);

export const buildCitationIndex = (citations = []) => {
  const bySourceId = new Map();
  const byChunkId = new Map();
  for (const citation of normalizeCitations(citations)) {
    for (const [map, key] of [[bySourceId, citation.sourceId], [byChunkId, citation.chunkId]]) {
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(citation);
    }
  }
  return { bySourceId: Object.fromEntries(bySourceId), byChunkId: Object.fromEntries(byChunkId) };
};

export const mergeEvidence = (previous = [], incoming = []) => [...new Map(
  [...previous, ...incoming].map((chunk) => [JSON.stringify([chunk.documentId, chunk.id]), chunk])
).values()];

/** Final generation context is authoritative; earlier candidates remain available until it arrives. */
export const evidenceForAnswer = (message) => {
  const steps = messageSteps(message);
  const collected = mergeEvidence(steps.flatMap((step) => step.event?.documents ?? step.event?.chunks ?? []), message.retrievedChunks ?? []);
  const final = [...steps].reverse().find((step) => step.kind === 'generation_context');
  const records = final && Array.isArray(final.event?.documents) ? final.event.documents : collected;
  return records.map((record) => {
    const prior = collected.find((chunk) => chunk.id === record.id && (!record.documentId || chunk.documentId === record.documentId));
    const citation = messageCitations(message).find((item) => item.chunkId === record.id && (!record.documentId || item.documentId === record.documentId));
    const merged = { ...prior, ...record };
    const metadata = record.metadata ?? {};
    return { ...merged,
      documentTitle: record.documentTitle ?? metadata.document_title ?? prior?.documentTitle ?? citation?.documentTitle,
      fileUrl: record.fileUrl ?? prior?.fileUrl ?? citation?.fileUrl,
      pageNumber: record.pageNumber ?? metadata.page_number ?? prior?.pageNumber ?? citation?.pageNumber,
      sourcePages: record.sourcePages ?? metadata.source_pages ?? prior?.sourcePages ?? citation?.sourcePages,
      headingPath: record.headingPath ?? metadata.heading_path ?? prior?.headingPath,
      sectionId: record.sectionId ?? metadata.section_id ?? prior?.sectionId,
      startOffset: record.startOffset ?? prior?.startOffset ?? citation?.startOffset,
      endOffset: record.endOffset ?? prior?.endOffset ?? citation?.endOffset,
    };
  });
};

export const uniqueSources = (sources = []) => [...new Map(sources.filter(Boolean).map((source) => [sourceKey(source), source])).values()];

/** A page label is not a chunk ID. Bind with the URL and supplied offsets, never page alone. */
export const chunkForCitation = (citation, chunks = []) => {
  const matches = chunks.filter((chunk) => {
    if (citation.documentId && chunk.documentId && citation.documentId !== chunk.documentId) return false;
    if (chunk.id === (citation.chunkId ?? citation.sourceId)) return !citation.fileUrl || !chunk.fileUrl || chunk.fileUrl === citation.fileUrl;
    if (citation.chunkId) return false;
    return Boolean(citation.fileUrl) && chunk.fileUrl === citation.fileUrl &&
      (chunk.pageNumber === citation.pageNumber || chunk.sourcePages?.includes(citation.pageNumber)) &&
      Number.isInteger(citation.startOffset) && Number.isInteger(citation.endOffset) &&
      chunk.startOffset === citation.startOffset && chunk.endOffset === citation.endOffset;
  });
  return matches.length === 1 ? matches[0] : null;
};

export const previewSource = (citation, chunks = []) => {
  const chunk = chunkForCitation(citation, chunks);
  const filename = chunk?.documentTitle ?? citation.documentTitle ?? citation.displayLabel ?? 'Source document';
  return {
    file: { filename, fileUrl: safeFileUrl(citation.fileUrl ?? chunk?.fileUrl) },
    selection: {
      displayLabel: citation.displayLabel ?? filename,
      pageNumber: citation.pageNumber ?? chunk?.pageNumber,
      sourcePages: citation.sourcePages ?? chunk?.sourcePages,
      headingPath: chunk?.headingPath ?? chunk?.metadata?.heading_path,
      startOffset: citation.startOffset ?? chunk?.startOffset,
      endOffset: citation.endOffset ?? chunk?.endOffset,
      text: chunk?.text ?? citation.text ?? citation.snippet ?? '',
      snippet: citation.snippet,
      referenceNotice: referenceNotice(citation),
    },
  };
};

export const citationFromChunk = (chunk) => ({ ...chunk, sourceId: chunk.id,
  displayLabel: `${chunk.documentTitle ?? 'Document'}${chunk.pageNumber != null ? `, Page ${chunk.pageNumber}` : ''}` });

/** Match inline labels against authoritative citation payloads; ambiguous global labels stay unbound. */
export const streamCitationFor = (parsed, citations = [], index = buildCitationIndex(citations)) => {
  const direct = index.byChunkId[parsed.chunkId ?? parsed.sourceId];
  const candidates = normalizeCitations(Array.isArray(direct) ? direct : citations);
  const matches = candidates.filter((citation) => {
    if (parsed.documentId && citation.documentId !== parsed.documentId) return false;
    if (parsed.documentTitle && citation.documentTitle !== parsed.documentTitle && !citation.displayLabel?.startsWith(`${parsed.documentTitle},`)) return false;
    if (parsed.chunkId && citation.chunkId !== parsed.chunkId) return false;
    if (citation.chunkId && citation.chunkId === parsed.sourceId) return true;
    if (parsed.raw === `[${citation.displayLabel}]` || parsed.raw === `[${citation.sourceId}]`) return true;
    if (parsed.sourceId === citation.sourceId) return true;
    const span = parsed.pageEnd !== parsed.pageStart ? `${parsed.pageStart}-${parsed.pageEnd}` : String(parsed.pageStart);
    return parsed.sourceId === 'Source ID' && citation.sourceId?.replace(/–/g, '-') === `Page ${span}` &&
      (!parsed.documentTitle || citation.displayLabel?.startsWith(`${parsed.documentTitle},`)) &&
      (!parsed.section || citation.displayLabel?.includes(`(${parsed.section})`));
  });
  return matches.length === 1 ? matches[0] : null;
};

/** Recognize source tags in prose; Markdown traversal keeps code and ordinary links literal. */
export const resolveCitations = (content = '', citations = [], citationIndex) => {
  if (typeof content !== 'string') return [];
  const supplied = normalizeCitations(citations);
  const index = citationIndex ?? buildCitationIndex(supplied);
  return [...content.matchAll(/\[([^\]\n]+)\]/g)].flatMap((match) => {
    const raw = match[0];
    const label = match[1].replace(/^(?:Source ID:|Source:)\s*/i, '').trim();
    const parsed = parseCitations(raw)[0] ?? { raw, sourceId: label };
    const citation = streamCitationFor(parsed, supplied, index) ?? streamCitationFor({ raw: `[${label}]`, sourceId: label }, supplied, index);
    const recognized = citation || /^(?:Source ID:|Source:|Page\s+\d)/i.test(match[1]) || parseCitations(raw).length > 0;
    if (!recognized) return [];
    return [{ raw, index: match.index, citation,
      label: parsed.pageStart != null ? `Page ${parsed.pageStart}${parsed.pageEnd !== parsed.pageStart ? `-${parsed.pageEnd}` : ''}` : label }];
  });
};

export const pdfPageUrl = (url, pageNumber) => {
  const safe = safeFileUrl(url);
  if (!safe) return null;
  const parsed = new URL(safe);
  if (Number.isInteger(pageNumber) && pageNumber > 0) parsed.hash = `page=${pageNumber}`;
  return parsed.href;
};

export const validOffsetRange = (start, end) => Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start;

// Normalize whitespace for PDF text matching while retaining the original UTF-16 positions.
const normalized = (text) => {
  let value = '';
  const positions = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (/\s/.test(character)) {
      if (value && !value.endsWith(' ')) { value += ' '; positions.push(index); }
    } else {
      const lowered = character.toLowerCase();
      value += lowered;
      for (let offset = 0; offset < lowered.length; offset += 1) positions.push(index);
    }
  }
  return { value, positions };
};

/** Offsets refer to backend source text, which may differ from PDF extraction. Verify before applying. */
export const findPassageRange = (pageText, selection = {}) => {
  const page = normalized(pageText);
  for (const candidate of [selection.text, selection.snippet]) {
    if (typeof candidate !== 'string') continue;
    const needle = normalized(candidate.replace(/(?:\.\.\.|…)\s*$/, '')).value.trim();
    if (!needle) continue;
    const first = page.value.indexOf(needle);
    if (first < 0) continue;
    const last = page.value.indexOf(needle, first + 1);
    if (last >= 0) {
      // A repeated passage is only disambiguated when supplied offsets match this exact text.
      if (!validOffsetRange(selection.startOffset, selection.endOffset) || selection.endOffset > pageText.length ||
        normalized(pageText.slice(selection.startOffset, selection.endOffset)).value.trim() !== needle) return null;
      return { start: selection.startOffset, end: selection.endOffset };
    }
    return { start: page.positions[first], end: page.positions[first + needle.length - 1] + 1 };
  }
  // With no excerpt, there is no basis for assuming that backend offsets index this PDF text.
  return null;
};

export const textItemRanges = (items, range) => {
  let cursor = 0;
  return items.filter((item) => typeof item.str === 'string').map((item) => {
    const start = cursor;
    cursor += item.str.length + 1;
    if (!range || range.end <= start || range.start >= start + item.str.length) return null;
    return { start: Math.max(0, range.start - start), end: Math.min(item.str.length, range.end - start) };
  });
};
