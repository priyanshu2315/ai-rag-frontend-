import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { configureStore } from '@reduxjs/toolkit';
import { evidenceForAnswer, pdfPageUrl } from '../src/utils/chatSources.js';
import { summarizeTrace } from '../src/utils/crag.js';

let vite, DocumentOutline, ReasoningContent, RetrievalOrigin, AnswerSources, slice, applyEvent, docReducer, fetchDocuments;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ default: DocumentOutline } = await vite.ssrLoadModule('/src/components/documents/DocumentOutline.jsx'));
  ({ ReasoningContent } = await vite.ssrLoadModule('/src/components/chat/ReasoningViewer.jsx'));
  ({ default: RetrievalOrigin } = await vite.ssrLoadModule('/src/components/chat/RetrievalOrigin.jsx'));
  ({ default: AnswerSources } = await vite.ssrLoadModule('/src/components/chat/AnswerSources.jsx'));
  slice = await vite.ssrLoadModule('/src/redux/slices/chatSlice.js');
  ({ applyEvent } = await vite.ssrLoadModule('/src/redux/actions/chatActions.js'));
  ({ default: docReducer } = await vite.ssrLoadModule('/src/redux/slices/documentSlice.js'));
  ({ fetchDocuments } = await vite.ssrLoadModule('/src/redux/actions/documentActions.js'));
});
after(async () => vite?.close());

const origin = { type: 'chapter_expansion', seedParentId: 'seed', chapter: 'Section 04 - Technical Architecture' };

test('chapter expansion renders chapter-specific badges and tooltips and contributes to trace counts', () => {
  const html = renderToStaticMarkup(createElement(RetrievalOrigin, { origin }));
  assert.match(html, /📖 Chapter: Section 04 - Technical Architecture/);
  assert.match(html, /Pulled as part of sequential workflow or procedure in Section 04/);
  assert.match(html, /bg-indigo-50/);
  const trace = summarizeTrace([{ kind: 'generation_context', event: { documents: [{ id: 'c1', retrievalOrigin: origin }] } }]);
  assert.equal(trace.counts.chapter_expansion, 1);
  assert.equal(trace.expansionCount, 1);
});

test('chapter reasoning shows separate page bullets and accented causal trigger lines', () => {
  const html = renderToStaticMarkup(createElement(ReasoningContent, { chain: { summary: 'Read the workflow.', steps: [{ step: 2, type: 'chapter_expansion', title: 'Expand chapter', description: 'Read sequential passages.',
    findings: '• Page 4: Operating cost 4,120.\n• Page 9: Board resolution.\n• Trigger for next step: Find contract VS-GRID-0417.' }] } }));
  assert.match(html, /Chapter \/ Workflow Expansion/);
  assert.match(html, /findings-content whitespace-pre-line/);
  assert.match(html, /finding-bullet[^>]*>• Page 4/);
  assert.match(html, /finding-bullet[^>]*>• Page 9/);
  assert.match(html, /finding-trigger-highlight[^>]*>↳ Trigger for next step: Find contract VS-GRID-0417/);
});

test('document listing retains its outline and outline click passes the supplied page to PDF navigation', () => {
  const outline = [{ sectionCode: 'Appendix B', title: 'Board Minutes', targetPage: 20, pageCount: 2 }, { sectionCode: 'TN-1', title: 'Thermal management', targetPage: null, pageCount: null }];
  const document = { id: 'doc', filename: 'report.pdf', fileUrl: 'https://example.com/report.pdf', documentOutline: outline };
  const store = configureStore({ reducer: docReducer });
  store.dispatch(fetchDocuments.fulfilled([document], 'list'));
  assert.deepEqual(store.getState().list[0].documentOutline, outline);
  let page;
  const tree = DocumentOutline({ outline, onPageJump: (value) => { page = value; } });
  const items = tree.props.children[1].props.children.props.children;
  items[0].props.children.props.onClick();
  assert.equal(page, 20);
  assert.equal(pdfPageUrl(document.fileUrl, page), 'https://example.com/report.pdf#page=20');
  assert.equal(items[1].props.children.props.disabled, true);
  items[1].props.children.props.onClick();
  assert.equal(page, 20);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Document Outline/);
  assert.match(html, /Appendix B/);
  assert.match(html, /Page 20 · 2 pages/);
  assert.match(html, /Page unavailable/);
  for (const value of [null, {}, [], [null, 'bad', {}]]) assert.equal(DocumentOutline({ outline: value }), null);
});

test('six retrieval loops and sixteen final passages stay complete in bounded evidence scrolling', () => {
  const store = configureStore({ reducer: slice.default });
  store.dispatch(slice.answerStarted());
  const documents = Array.from({ length: 16 }, (_, index) => ({ id: `c${index}`, documentId: 'doc', text: `Complete passage ${index}: ${'x'.repeat(1979)}`, retrievalOrigin: index ? origin : { type: 'search' }, metadata: { chunk_index: index } }));
  for (let attempt = 1; attempt <= 6; attempt++) applyEvent(store.dispatch, { type: 'retrieval_candidates', attempt, query: `Round ${attempt}`, documents });
  applyEvent(store.dispatch, { type: 'retrieved_chunks', count: 16, chunks: documents });
  applyEvent(store.dispatch, { type: 'generation_context', documents });
  const message = store.getState().messages[0];
  const evidence = evidenceForAnswer(message);
  assert.equal(evidence.length, 16);
  assert.equal(summarizeTrace(message.steps).rounds.length, 6);
  const html = renderToStaticMarkup(createElement(AnswerSources, { chunks: evidence, final: true, onOpen: () => {} }));
  assert.match(html, /Evidence Chunks · 16/);
  assert.match(html, /max-h-\[65dvh\].*overflow-y-auto/);
  for (let index = 0; index < 16; index++) assert.ok(html.includes(`Complete passage ${index}:`));
});

test('citation chips lead with the file name, keep the page, and carry the full text in the hover title', async () => {
  const { CitationBadge } = await vite.ssrLoadModule('/src/components/chat/Markdown.jsx');
  const citation = { sourceId: 'Page 1', pageNumber: 1, documentTitle: 'Purchase Approval Authority Matrix, Version 2 (Amendment No. 1)' };
  const html = renderToStaticMarkup(createElement(CitationBadge, { citation, onCitation: () => {} }));
  assert.match(html, /title="[^"]*Purchase Approval Authority Matrix, Version 2 \(Amendment No\. 1\) • Page 1"/);
  assert.match(html, /truncate[^>]*>Purchase Approval/);
  assert.ok(html.indexOf('>Purchase Approval') < html.indexOf('>• Page 1'));
  assert.match(html, /text-\[10\.5px\]/);
  assert.doesNotMatch(html, /role="tooltip"/);
});

test('source chips lead with the uploaded file name, found by document id, file URL or the storage path', async () => {
  const { citationFileName, fileNameFromUrl } = await vite.ssrLoadModule('/src/utils/fileNames.js');
  const { CitationBadge } = await vite.ssrLoadModule('/src/components/chat/Markdown.jsx');
  const url = 'https://x.supabase.co/storage/v1/object/public/documents/user-1/1762700000000-Service_Agreement_v2.pdf';
  const citation = { sourceId: 'Page 2', pageNumber: 2, documentId: 'd1', fileUrl: url, documentTitle: 'Service Agreement, Version 2' };
  assert.equal(citationFileName(citation, [{ id: 'd1', filename: 'Service Agreement v2.pdf' }]), 'Service Agreement v2.pdf');
  assert.equal(citationFileName({ ...citation, documentId: undefined }, [{ id: 'd9', fileUrl: url, filename: 'By url.pdf' }]), 'By url.pdf');
  assert.equal(citationFileName(citation, []), 'Service_Agreement_v2.pdf');
  assert.equal(fileNameFromUrl('not a url'), null);
  assert.equal(fileNameFromUrl(undefined), null);
  const html = renderToStaticMarkup(createElement(CitationBadge, { citation, onCitation: () => {}, fileName: 'Service Agreement v2.pdf' }));
  assert.match(html, /title="[^"]*Service Agreement v2\.pdf — Service Agreement, Version 2 • Page 2"/);
  assert.ok(html.indexOf('>Service Agreement v2.pdf') < html.indexOf('>• Page 2'));
  assert.doesNotMatch(html, /truncate[^>]*>Service Agreement, Version 2</);
});
