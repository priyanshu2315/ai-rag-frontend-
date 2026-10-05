import { pagesOf, sortByMetadataIndex } from './chunkInspector.js';

const orderedParents = (parents) => sortByMetadataIndex(parents, 'chunk_index');
const orderedChildren = (children) => sortByMetadataIndex(children, 'child_index');

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

export const buildChunkDownload = ({ parents, childResponses, scope, page, endPage, documentId, filename, format }) => {
  const selected = selectDownloadParents(parents, childResponses, scope, page, endPage);
  const title = scope === 'page' ? `Page ${page} chunks` : scope === 'across' ? `Pages ${page}–${endPage} chunks` : 'All chunks';
  const md = format === 'md';
  const lines = [md ? `# ${title}` : title, '', `Document: ${filename}`, `Document ID: ${documentId}`,
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
      'Exact parent API record:', md ? '```json' : '', JSON.stringify(parent, null, 2), md ? '```' : '',
      'Child endpoint response information:', md ? '```json' : '',
      JSON.stringify(Object.fromEntries(Object.entries(response).filter(([key]) => key !== 'children')), null, 2),
      md ? '```' : '');
    children.forEach((child, childIndex) => lines.push(
      md ? `### Child ${childIndex + 1} — ${child.id}` : `Child ${childIndex + 1} — ${child.id}`,
      `Parent ID: ${child.parentId ?? parent.id}`,
      `Pages: ${pagesOf(child.metadata).join(', ') || 'unknown'}`,
      'Exact child API record:', md ? '```json' : '', JSON.stringify(child, null, 2), md ? '```' : ''
    ));
    lines.push('');
  });
  return lines.join('\n');
};
