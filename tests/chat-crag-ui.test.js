import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { parseCitations, resolveCitation } from '../src/utils/crag.js';
import { citations, retrieved, usage, v2Chunks, v2Citations, v2StepCost, v2Usage } from './chat-source-fixtures.js';
import { evidenceForAnswer, pdfPageUrl, previewSource, streamCitationFor } from '../src/utils/chatSources.js';
import { traceChunkLabels } from '../src/utils/traceChunks.js';

let vite, Markdown, CitationBadge, SourceContent, RetrievalOrigin, ChunkInspection, AnswerTimeline, AnswerSources, StreamCitationBadge, AnswerUsage, SourceSelection, previewKind, MessageBubble, SearchEventDetails;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ default: Markdown, CitationBadge } = await vite.ssrLoadModule('/src/components/chat/Markdown.jsx'));
  ({ SourceContent } = await vite.ssrLoadModule('/src/components/chat/SourceDrawer.jsx'));
  ({ default: RetrievalOrigin } = await vite.ssrLoadModule('/src/components/chat/RetrievalOrigin.jsx'));
  ({ default: ChunkInspection } = await vite.ssrLoadModule('/src/components/chunks/ChunkInspection.jsx'));
  ({ default: AnswerTimeline } = await vite.ssrLoadModule('/src/components/chat/AnswerTimeline.jsx'));
  ({ default: SearchEventDetails } = await vite.ssrLoadModule('/src/components/chat/SearchEventDetails.jsx'));
  ({ default: AnswerSources, StreamCitationBadge } = await vite.ssrLoadModule('/src/components/chat/AnswerSources.jsx'));
  ({ default: AnswerUsage } = await vite.ssrLoadModule('/src/components/chat/AnswerUsage.jsx'));
  ({ SourceSelection, previewKind } = await vite.ssrLoadModule('/src/components/documents/DocumentPreview.jsx'));
  ({ default: MessageBubble } = await vite.ssrLoadModule('/src/components/chat/MessageBubble.jsx'));
});
after(async () => vite?.close());

test('question steps use stored chunk indexes even when retrieval details are hidden', () => {
  const id = 'c5a1f4b2-0000-4000-8000-000000000001';
  const html = renderToStaticMarkup(createElement(AnswerTimeline, { streaming: false, steps: [
    { id: 'retrieval', kind: 'retrieval_candidates', event: { documents: [{ id, metadata: { chunk_index: 7 } }] } },
    { id: 'status', kind: 'status', label: `Grading ${id}`, detail: `Kept ${id}`, done: true },
  ] }));
  assert.match(html, /Grading Chunk 7/);
  assert.match(html, /Kept Chunk 7/);
  assert.ok(!html.includes(id));
});

test('grading and expansion show chunk indexes while navigation and exact JSON retain IDs', () => {
  const parent = { id: 'parent-a', documentId: 'doc-a', metadata: { chunk_index: 7 } };
  const event = { type: 'grading_result', seedParentIds: [parent.id], keptParentIds: [parent.id],
    documents: [parent], decisions: [{ parentId: parent.id, documentId: parent.documentId, relevant: true }] };
  const html = renderToStaticMarkup(createElement(MemoryRouter, null,
    createElement(SearchEventDetails, { event, chunkLabels: traceChunkLabels([{ event }]) })));
  assert.match(html, /Seed chunks: Chunk 7/);
  assert.match(html, /Kept chunks: Chunk 7/);
  assert.match(html, /href="[^"]*#parent-parent-a"[^>]*>Chunk 7<\/a>/);
  assert.match(html, /Exact search event JSON/);
  assert.equal(event.decisions[0].parentId, 'parent-a');
});

test('all CRAG retrieval origins render accurate pills', () => {
  for (const [type, label] of Object.entries({ search: 'Direct Search', table_continuation: 'Table Continuation', section_expansion: 'Section Expansion', neighbor_expansion: 'Reading Order' })) {
    const html = renderToStaticMarkup(createElement(RetrievalOrigin, { origin: { type } }));
    assert.ok(html.includes(label));
  }
});

test('fine-grained origins distinguish sibling context and section header scope with accurate tooltips', () => {
  for (const [type, label, tooltip, icon] of [
    ['search', 'Direct Search Hit', 'Direct Search Hit', '📄'],
    ['section_sibling', 'Context Sibling', 'Preceding or succeeding passage in section', '📖'],
    ['section_lead', 'Section Header &amp; Scope', 'Header chunk providing column labels and units', '📋'],
    ['table_continuation', 'Table Continuation', 'Connected table row across pages', '▦'],
    ['reference_following', 'Reference Followed: Appendix C', 'Target section cited in seed passage', '🔗'],
  ]) {
    const html = renderToStaticMarkup(createElement(RetrievalOrigin, { origin: { type, reference: 'Appendix C' } }));
    assert.ok(html.includes(label), label);
    assert.ok(html.includes(`title="${tooltip}"`), tooltip);
    assert.ok(html.includes(icon), icon);
  }
});

test('a capped six-chunk historical context displays every passage and keeps the answer intact', () => {
  const documents = Array.from({ length: 6 }, (_, index) => {
    const ending = ` End of capped passage ${index}`;
    const length = index === 5 ? 2670 : 2666;
    return { id: `capped-${index}`, text: 'x'.repeat(length - ending.length) + ending, metadata: { chunk_index: index } };
  });
  assert.equal(documents.reduce((total, document) => total + document.text.length, 0), 16000);
  const message = { role: 'assistant', content: 'Complete final answer without truncation.', metadata: { steps: [{ type: 'generation_context', documents }] } };
  const html = renderToStaticMarkup(createElement(MessageBubble, { message }));
  assert.match(html, /Complete final answer without truncation/);
  assert.match(html, /Evidence Chunks · 6/);
  for (let index = 0; index < 6; index += 1) assert.ok(html.includes(`End of capped passage ${index}`));
});

test('Markdown renders neutral citation badges without metadata while code and normal links stay intact', () => {
  const html = renderToStaticMarkup(createElement(Markdown, { onCitation: () => {} },
    'Cost **[p1: Depot Handbook, Page 3-4 (5. Financial record)]**. `[p2: Page 5]` [Visit](https://example.com) <script>alert(1)</script>'));
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /\[Page 3-4\]/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /\[p2: Page 5\]/);
  assert.doesNotMatch(html, /<script>/);
});

test('clicking a citation binds the correct complete passage to the source drawer', () => {
  const citation = parseCitations('[p1: Depot Handbook, Page 3-4 (5. Financial record)]')[0];
  const parent = { id: 'p1', documentId: 'd1', text: 'Short text', searchText: '**Complete cost passage**',
    retrievalOrigin: { type: 'table_continuation' }, metadata: { document_title: 'Depot Handbook', source_pages: [3, 4],
      heading_path: ['Finance', 'Operating costs'], row_ids: ['row-9'], token_budget: { tokenCount: 88, tokenLimit: 100, withinLimit: true } } };
  let drawerProps;
  const badge = CitationBadge({ citation, onCitation: (clicked) => { drawerProps = { citation: clicked, parent: resolveCitation(clicked, [parent]) }; } });
  badge.props.onClick();
  assert.equal(drawerProps.parent, parent);
  const html = renderToStaticMarkup(createElement(SourceContent, drawerProps));
  for (const value of ['Depot Handbook', 'Pages 3, 4', 'Finance', 'Operating costs', 'Table Continuation', 'Complete cost passage', 'row-9', '88', '100', 'Within limit']) assert.ok(html.includes(value), value);
  assert.match(html, /<strong[^>]*>Complete cost passage<\/strong>/);
  assert.match(renderToStaticMarkup(createElement(SourceContent, { citation })), /Full source passage unavailable/);
});

test('chunk inspector renders untrusted Markdown and exposes new metadata without changing legacy values', () => {
  const html = renderToStaticMarkup(createElement(ChunkInspection, { chunk: {
    text: '**Saved passage** <img src=x onerror=alert(1)>', searchText: 'Exact search text',
    metadata: { chunker_version: 'ai-corrected-markdown-v1', linked_table_ids: ['table-7'], document_title: 'Depot Handbook' },
  } }));
  assert.match(html, /<strong[^>]*>Saved passage<\/strong>/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /linked table ids/);
  assert.match(html, /ai-corrected-markdown-v1/);
  const old = renderToStaticMarkup(createElement(ChunkInspection, { chunk: { text: 'Old', metadata: { chunker_version: 'structured-context-v4' } } }));
  assert.match(old, /structured-context-v4/);
});

test('reasoning trace visibly places targeted rewriting between retrieval rounds', () => {
  const html = renderToStaticMarkup(createElement(AnswerTimeline, { streaming: true, steps: [
    { id: '1', kind: 'retrieval_candidates', event: { attempt: 1 } },
    { id: '2', kind: 'grading_result', event: { attempt: 1 } },
    { id: '3', kind: 'tool_finish', label: 'Query Rewriter', event: { query: 'Find missing cost' } },
    { id: '4', kind: 'retrieval_candidates', event: { attempt: 2 } },
  ] }));
  assert.match(html, /Reasoning Trace/);
  assert.ok(html.indexOf('Round 1:') < html.indexOf('Missing Fact Follow-up:'));
  assert.ok(html.indexOf('Missing Fact Follow-up:') < html.indexOf('Round 2:'));
});

test('new citation badges open the exact file selection and show complete retrieved text without applying absolute offsets to a snippet', () => {
  let preview;
  const badge = StreamCitationBadge({ citation: citations.citations[0], onOpen: (citation) => { preview = previewSource(citation, retrieved.chunks); } });
  badge.props.onClick();
  const html = renderToStaticMarkup(createElement(SourceSelection, { selection: preview.selection }));
  assert.match(html, /Selected page: 3/);
  assert.match(html, /1205–1850/);
  assert.match(html, /<mark[^>]*>Depot Code: D01 Alderbank Yard/);
  assert.match(html, /Fiscal 2022 Cost: 3,880/);
  assert.equal(previewKind(citations.citations[0].displayLabel, preview.file.fileUrl), 'frame');
  const sources = renderToStaticMarkup(createElement(AnswerSources, { citations: citations.citations, chunks: retrieved.chunks, count: 4, onOpen: () => {} }));
  assert.match(sources, /Handbook.pdf, Page 3 \(5. Financial Record\)/);
  assert.match(sources, /Evidence Chunks · 4 \(1 observed across searches\)/);
});

test('registered page citations render inline and retain normal links and code', () => {
  const html = renderToStaticMarkup(createElement(Markdown, { citations: citations.citations, onCitation: () => {} },
    `Cost [Page 3] and [${citations.citations[0].displayLabel}]. Code \`[Page 3]\` [Website](https://example.com).`));
  assert.equal((html.match(/aria-label="Open source:/g) ?? []).length, 2);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /<code[^>]*>\[Page 3\]<\/code>/);
});

test('answer usage shows server totals and all per-step costs, including zero', () => {
  const html = renderToStaticMarkup(createElement(AnswerUsage, { usage }));
  for (const value of ['4,120', '₹0.04', 'Question Splitter', 'Relevance Grader', 'Final Answer Generation', '₹0.0018', '₹0.0080', '₹0.0286']) assert.ok(html.includes(value), value);
  assert.match(renderToStaticMarkup(createElement(AnswerUsage, { usage: { totalTokens: 0, totalCostINR: 0 } })), /0 tokens/);
});

test('a completed answer keeps its visible reasoning steps open and displays source and usage events', () => {
  const html = renderToStaticMarkup(createElement(MessageBubble, { message: {
    id: 'answer1', role: 'assistant', content: 'Cost [Page 3]', streaming: false,
    steps: [{ id: 'step1', kind: 'done', label: 'Stream completed', done: true }],
    retrievedChunks: retrieved.chunks, retrievedChunkCount: 4, citations: citations.citations, usageSummary: usage,
  } }));
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Stream completed/);
  assert.match(html, /Answer usage/);
  assert.match(html, /Handbook.pdf/);
});

test('live steps stay visible beside the reasoning-chain button and remain visible on completion', () => {
  const message = { role: 'assistant', content: 'Answer text', steps: [
    { id: 'status', kind: 'status', label: 'Checking evidence', done: false },
    { id: 'search', kind: 'tool_start', label: 'Hybrid Search', query: 'Current operating cost', done: false },
  ], metadata: { reasoningChain: { summary: 'Detailed chain summary', steps: [{ step: 1, type: 'initial_search', title: 'Found source passage' }] } } };
  for (const streaming of [true, false]) {
    const html = renderToStaticMarkup(createElement(MessageBubble, { message: { ...message, streaming } }));
    assert.match(html, /Checking evidence/);
    assert.match(html, /Hybrid Search/);
    assert.match(html, /Current operating cost/);
    assert.match(html, /Reasoning Chain/);
    assert.match(html, /aria-haspopup="dialog" aria-expanded="false"/);
    assert.match(html, /aria-expanded="true"/);
    assert.doesNotMatch(html, /Detailed chain summary|Found source passage/);
  }
});

test('the exact [Source ID: Page 3] tag binds to the supplied file, page and source offsets', () => {
  const raw = '[Source ID: Page 3]';
  const parsed = parseCitations(raw)[0];
  const citation = streamCitationFor(parsed, citations.citations);
  assert.equal(citation, citations.citations[0]);
  let preview;
  const badge = CitationBadge({ citation, onCitation: (clicked) => { preview = previewSource(clicked, retrieved.chunks); } });
  badge.props.onClick();
  assert.equal(pdfPageUrl(preview.file.fileUrl, preview.selection.pageNumber), `${citations.citations[0].fileUrl}#page=3`);
  assert.equal(preview.selection.startOffset, 1205);
  assert.equal(preview.selection.endOffset, 1850);
  assert.equal(preview.selection.text, retrieved.chunks[0].text);
  const html = renderToStaticMarkup(createElement(Markdown, { citations: citations.citations, onCitation: () => {} }, `Cost ${raw}`));
  assert.match(html, /<button/);
  assert.match(html, /Handbook.pdf, Page 3 \(5. Financial Record\)/);
});

test('live step_cost fields render before a summary without inventing total usage', () => {
  // Older messages may omit the newly documented model/input/output fields.
  const cost = { type: 'step_cost', step: 'Question Splitter', totalTokens: 240, formattedINR: '₹0.0018' };
  const html = renderToStaticMarkup(createElement(AnswerUsage, { stepCosts: [cost] }));
  assert.match(html, /Final usage summary not received yet/);
  assert.match(html, /Reported step costs · 1/);
  assert.match(html, /Question Splitter/);
  assert.match(html, /₹0.0018/);
  assert.doesNotMatch(html, /240 tokens ·/);
  const withSummary = renderToStaticMarkup(createElement(AnswerUsage, { stepCosts: [cost], usage }));
  assert.match(withSummary, /4,120 tokens • ₹0.04/);
  assert.doesNotMatch(withSummary, /4,360/);
});

test('v2 citation pills expose a hover/focus tooltip with exact label and escaped snippet', () => {
  const html = renderToStaticMarkup(createElement(Markdown, { citations: v2Citations, onCitation: () => {} }, 'Costs [Source ID: Page 3-4] [Page 4]'));
  assert.equal((html.match(/role="tooltip"/g) ?? []).length, 2);
  assert.match(html, /aria-describedby=/);
  assert.match(html, /group-hover\/citation:block/);
  assert.match(html, /group-focus-within\/citation:block/);
  assert.match(html, /📄 Page 3-4 • Depot Handbook/);
  assert.ok(html.includes(v2Citations[0].displayLabel));
  assert.match(html, /D08 fiscal 2023 cost/);
  const unsafe = renderToStaticMarkup(createElement(Markdown, { citations: [{ ...v2Citations[1], snippet: '<img src=x onerror=alert(1)>' }], onCitation: () => {} }, '[Page 4]'));
  assert.doesNotMatch(unsafe, /<img/);
});

test('v2 evidence inspector shows both rounds, origin, page span, heading and rendered table', () => {
  const finalDocs = v2Chunks.map((chunk) => ({ id: chunk.id, documentId: chunk.documentId, text: chunk.text, retrievalOrigin: chunk.retrievalOrigin,
    metadata: { heading_path: chunk.headingPath, source_pages: chunk.sourcePages, page_number: chunk.pageNumber } }));
  const message = { retrievedChunks: v2Chunks, citations: v2Citations, steps: [{ kind: 'generation_context', event: { documents: finalDocs } }] };
  const html = renderToStaticMarkup(createElement(AnswerSources, { chunks: evidenceForAnswer(message), citations: v2Citations, final: true, onOpen: () => {} }));
  for (const value of ['Evidence Chunks · 2', 'Direct Search', 'Table Continuation', 'Page 3–4', '5. Financial record', 'Depot Handbook', 'D01', 'D08']) assert.ok(html.includes(value), value);
  assert.match(html, /<table/);
  assert.match(html, /Final accumulated generation evidence/);
});

test('v2 cost pill and expanded table use reported models, input/output/total tokens and precise currency values', () => {
  const html = renderToStaticMarkup(createElement(AnswerUsage, { usage: v2Usage, stepCosts: [v2StepCost] }));
  for (const value of ['2,840 tokens • ₹0.25', 'Query cost breakdown', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'Input', 'Output', 'USD', 'INR', '1,250', '1,120', '260', '₹0.0009', '₹0.24', '$0.00245']) assert.ok(html.includes(value), value);
  assert.match(html, /<summary aria-controls=/);
  const live = renderToStaticMarkup(createElement(AnswerUsage, { stepCosts: [v2StepCost] }));
  for (const value of ['142', '28', '170', '₹0.0102', '$0.000105']) assert.ok(live.includes(value), value);
});

test('reasoning trace groups intermingled parallel search events under their queries', () => {
  const html = renderToStaticMarkup(createElement(AnswerTimeline, { streaming: true, steps: [
    { id: 'a', kind: 'tool_start', label: 'Hybrid Search', query: 'D01 cost', done: false },
    { id: 'b', kind: 'tool_start', label: 'Hybrid Search', query: 'D08 cost', done: false },
    { id: 'c', kind: 'retrieval_candidates', event: { query: 'D08 cost', attempt: 1, documents: [] } },
    { id: 'd', kind: 'retrieval_candidates', event: { query: 'D01 cost', attempt: 1, documents: [] } },
  ] }));
  assert.match(html, /Searches by query · 2/);
  assert.match(html, /<summary[^>]*>D01 cost · Rounds 1<\/summary>/);
  assert.match(html, /<summary[^>]*>D08 cost · Rounds 1<\/summary>/);
});
