import { pagesOf, sortByMetadataIndex } from './chunkInspector.js';

const orderedParents = (parents) => sortByMetadataIndex(parents, 'chunk_index');
const orderedChildren = (children) => sortByMetadataIndex(children, 'child_index');
const stringifyWithoutEmbeddingArrays = (value) => JSON.stringify(value, (key, item) =>
  (key === 'embedding' || key === 'embeddings') && Array.isArray(item) ? undefined : item, 2);

export const chunkDownloadFilename = ({ filename, scope, page, endPage, format }) => {
  const sourceName = String(filename ?? '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  const safeName = sourceName.replace(/[<>:"/\\|?*]/g, '-').replace(/[. ]+$/, '').trim() || 'document';
  const suffix = scope === 'page' ? `page-${page}` : scope === 'across' ? `pages-${page}-to-${endPage}` : 'all';
  return `${safeName}-chunks-${suffix}.${format}`;
};

const inPageRange = (metadata, startPage, endPage) =>
  pagesOf(metadata).some((value) => value >= Number(startPage) && value <= Number(endPage));

export const selectDownloadParents = (parents, childResponses, scope, page, endPage) => {
  const ordered = orderedParents(parents);
  if (scope === 'all') return ordered;
  const lastPage = scope === 'page' ? page : endPage;
  return ordered.filter((parent) =>
    inPageRange(parent.metadata, page, lastPage) ||
    childResponses[parent.id]?.children?.some((child) => inPageRange(child.metadata, page, lastPage))
  );
};

export const buildChunkDownload = ({ parents, childResponses, scope, page, endPage, filename, format }) => {
  const selected = selectDownloadParents(parents, childResponses, scope, page, endPage);
  const title = scope === 'page' ? `Page ${page} chunks` : scope === 'across' ? `Pages ${page}–${endPage} chunks` : 'All chunks';
  const md = format === 'md';
  const lines = [md ? `# ${title}` : title, '', `Document: ${filename}`,
    `Scope: ${scope}${scope === 'page' ? ` (page ${page})` : scope === 'across' ? ` (pages ${page}–${endPage}, inclusive)` : ''}`, `Parent chunks: ${selected.length}`, ''];

  if (scope === 'across' && selected.length) {
    lines.push('Chunk flow in source order:', selected.map((parent) => {
      const parentPage = pagesOf(parent.metadata).join(', ') || 'unknown';
      const children = orderedChildren(childResponses[parent.id].children).filter((child) =>
        inPageRange(child.metadata, page, endPage) ||
        (!pagesOf(child.metadata).length && inPageRange(parent.metadata, page, endPage)));
      return `Page ${parentPage}: Parent ${parent.id}${children.map((child) =>
        ` → Page ${pagesOf(child.metadata).join(', ') || 'unknown'}: Child ${child.id}`).join('')}`;
    }).join(' → '), '');
  }

  if (!selected.length) lines.push('No chunks match this selection.', '');
  selected.forEach((parent, index) => {
    const response = childResponses[parent.id];
    const allChildren = orderedChildren(response.children);
    const children = scope !== 'all' ? allChildren.filter((child) => {
      const childPages = pagesOf(child.metadata);
      const lastPage = scope === 'page' ? page : endPage;
      return inPageRange(child.metadata, page, lastPage) ||
        (!childPages.length && inPageRange(parent.metadata, page, lastPage));
    }) : allChildren;
    const parentPages = pagesOf(parent.metadata);
    lines.push(md ? `## Parent ${index + 1} — ${parent.id}` : `Parent ${index + 1} — ${parent.id}`,
      `Pages: ${parentPages.length ? parentPages.join(', ') : 'unknown'}`,
      `Previous parent ID: ${parent.prevParentId ?? 'none'}`,
      `Next parent ID: ${parent.nextParentId ?? 'none'}`,
      `Flow: Parent ${parent.id}${children.map((child) => ` → Child ${child.id} (page ${pagesOf(child.metadata).join(', ') || 'unknown'})`).join('')}`,
      `Children in this download: ${children.length}`, '',
      'Parent API record (embedding arrays omitted):', md ? '```json' : '', stringifyWithoutEmbeddingArrays(parent), md ? '```' : '',
      'Child endpoint response information (embedding arrays omitted):', md ? '```json' : '',
      stringifyWithoutEmbeddingArrays(Object.fromEntries(Object.entries(response).filter(([key]) => key !== 'children'))),
      md ? '```' : '');
    children.forEach((child, childIndex) => lines.push(
      md ? `### Child ${childIndex + 1} — ${child.id}` : `Child ${childIndex + 1} — ${child.id}`,
      `Parent ID: ${child.parentId ?? parent.id}`,
      `Pages: ${pagesOf(child.metadata).join(', ') || 'unknown'}`,
      'Child API record (embedding arrays omitted):', md ? '```json' : '', stringifyWithoutEmbeddingArrays(child), md ? '```' : ''
    ));
    lines.push('');
  });
  return lines.join('\n');
};
