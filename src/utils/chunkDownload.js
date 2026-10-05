import { pagesOf, sortByMetadataIndex } from './chunkInspector.js';

const orderedParents = (parents) => sortByMetadataIndex(parents, 'chunk_index');
const orderedChildren = (children) => sortByMetadataIndex(children, 'child_index');

// Parent links define the connected flow. A chain is included in the cross-page
// export when its records cover more than one page, even if the link crosses a
// page boundary between two otherwise single-page parents.
export const selectDownloadParents = (parents, childResponses, scope, page) => {
  const ordered = orderedParents(parents);
  if (scope === 'all') return ordered;
  if (scope === 'page') return ordered.filter((parent) =>
    pagesOf(parent.metadata).includes(Number(page)) ||
    childResponses[parent.id]?.children?.some((child) => pagesOf(child.metadata).includes(Number(page)))
  );

  const byId = new Map(ordered.map((parent) => [parent.id, parent]));
  const neighbors = new Map(ordered.map((parent) => [parent.id, new Set()]));
  ordered.forEach((parent) => {
    for (const linkedId of [parent.prevParentId, parent.nextParentId]) {
      if (!byId.has(linkedId)) continue;
      neighbors.get(parent.id).add(linkedId);
      neighbors.get(linkedId).add(parent.id);
    }
  });
  const visited = new Set();
  const included = new Set();
  for (const parent of ordered) {
    if (visited.has(parent.id)) continue;
    const stack = [parent];
    const component = [];
    const pages = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      component.push(current);
      pagesOf(current.metadata).forEach((value) => pages.add(value));
      (childResponses[current.id]?.children ?? []).forEach((child) =>
        pagesOf(child.metadata).forEach((value) => pages.add(value)));
      for (const linkedId of neighbors.get(current.id)) {
        if (byId.has(linkedId) && !visited.has(linkedId)) stack.push(byId.get(linkedId));
      }
    }
    if (pages.size > 1) component.forEach((item) => included.add(item.id));
  }
  return ordered.filter((parent) => included.has(parent.id));
};

export const buildChunkDownload = ({ parents, childResponses, scope, page, documentId, filename, format }) => {
  const selected = selectDownloadParents(parents, childResponses, scope, page);
  const title = scope === 'page' ? `Page ${page} chunks` : scope === 'across' ? 'Across-page chunks' : 'All chunks';
  const md = format === 'md';
  const lines = [md ? `# ${title}` : title, '', `Document: ${filename}`, `Document ID: ${documentId}`,
    `Scope: ${scope}${scope === 'page' ? ` (page ${page})` : ''}`, `Parent chunks: ${selected.length}`, ''];

  if (scope === 'across' && selected.length) {
    lines.push('Connected flow:', selected.map((parent) => {
      const parentPage = pagesOf(parent.metadata).join(', ') || 'unknown';
      const children = orderedChildren(childResponses[parent.id].children);
      return `Page ${parentPage}: Parent ${parent.id}${children.map((child) =>
        ` → Page ${pagesOf(child.metadata).join(', ') || 'unknown'}: Child ${child.id}`).join('')}`;
    }).join(' → '), '');
  }

  if (!selected.length) lines.push('No chunks match this selection.', '');
  selected.forEach((parent, index) => {
    const response = childResponses[parent.id];
    const allChildren = orderedChildren(response.children);
    const children = scope === 'page' ? allChildren.filter((child) => {
      const childPages = pagesOf(child.metadata);
      return childPages.includes(Number(page)) || (!childPages.length && pagesOf(parent.metadata).includes(Number(page)));
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
