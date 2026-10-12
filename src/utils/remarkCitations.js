import { resolveCitations } from './chatSources.js';

// Work on Markdown text nodes so citations inside code and existing links stay literal.
export default function remarkCitations({ citations: supplied = [], citationIndex } = {}) {
  return (tree) => {
    const visit = (node) => {
      if (['link', 'linkReference', 'code', 'inlineCode', 'html'].includes(node.type) || !node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== 'text') { visit(child); return [child]; }
        const citations = resolveCitations(child.value, supplied, citationIndex);
        if (!citations.length) return [child];
        const result = [];
        let cursor = 0;
        for (const citation of citations) {
          if (citation.index > cursor) result.push({ type: 'text', value: child.value.slice(cursor, citation.index) });
          result.push({ type: 'link', url: '#source-passage',
            data: { hProperties: { 'data-source-citation': citation.raw } },
            children: [{ type: 'text', value: citation.label }] });
          cursor = citation.index + citation.raw.length;
        }
        if (cursor < child.value.length) result.push({ type: 'text', value: child.value.slice(cursor) });
        return result;
      });
    };
    visit(tree);
  };
}
