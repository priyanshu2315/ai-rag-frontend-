# Structured chunk inspector integration

Current contract: backend-selected Gemini, LlamaParse + Gemini, or deterministic logic ingestion. New Gemini-based chunks report `ai-corrected-markdown-v1`; older saved documents retain their actual version. Implementation uses JavaScript/JSX, existing React components, Redux and bearer-authenticated API clients.

## Changed behavior

- `progressStream.js` uses authenticated fetch with `Accept: text/event-stream`, a streaming UTF-8 decoder, buffered LF/CRLF SSE parsing, malformed-record isolation, document filtering and cancellation. Only completed, summary_failed and failed close the stream as terminal events. Unexpected closure is a connection issue.
- `useDocumentProgress.js` retains the session on remount and retries at most five times with exponential backoff. It refetches document statuses on reconnection and stops on authorization failures. `AppShell.jsx` watches the selected unfinished document, disconnecting on a document switch, navigation out of the shell or logout.
- `structuredInspector.js` and `progressReducer.js` maintain document-scoped source, heading, section, part, parent and child maps alongside raw event history. Real chunk IDs deduplicate preparation/embedding events. Persisted/readiness state and completed diagnostics survive late preparation events. Specific chunking/embedding errors remain visible after a generic terminal failure.
- `ChunkExplorer.jsx` and `useDocumentChunks.js` restore statuses and stored parents on refresh and refetch parents after chunks_saved/chunks_ready or reconnect. Children and vectors are fetched only on parent expansion. `chunkSlice.js` ignores stale request IDs and mismatched document/parent responses; stored child responses update their authoritative parent.
- `StructureOverview.jsx` displays identity separate from headings, inferred heading trees using parentCandidateId, independent ingestion/summary/connection indicators, prepared/embedded/saved counts, warnings, unresolved relationships, table/list groupings, owning sections and original reading placement. Tables expose labelled passage values rather than inventing a cell schema. Unique item IDs count once across fragments within the loaded document scope.
- `StructuredDetails.jsx` adds budgets, structural IDs (including linked table IDs), source/context evidence, compaction/fragment flags, identity metadata and relationships to parent/child cards. Parent passages render safe Markdown; exact text, contextual search input and records remain inspectable. Explicit references, reading-order navigation and inferred table continuations remain distinct, including unresolved target navigation.
- `SourcePages.jsx` supports rendered/image/document sources without physical page numbers, separate parser pages, raw text and safe Markdown. Source spans use UTF-16 offsets; source_unit evidence does not promise exact split-child highlighting.
- `ProcessingTimeline.jsx` preserves unknown events and supports category filters plus progressive rendering. Parent/child/source/structure lists render progressively; vector numbers render only after expansion. `ProcessingPanel.jsx` uses indeterminate overall progress and preserves connection problems separately from ingestion failures.
- `ProcessingUsage.jsx` counts Gemini response usage once per document/operation/batch, keeps raw provider payloads, separates local embedding tokens, and estimates only matching `gemini-3.5-flash-lite` standard paid API list prices. INR conversion requires configured rate, source, and date.
- `architecture.html` replaces current character-size descriptions with contextual token budgets. Historical documents retain their supplied chunker version.

## Persistence and provenance

There is no backend progress replay, Redis history request or Last-Event-ID recovery. Captured events are memory-only, document-scoped session data. Early upload events and events missed during disconnect are unavailable. On refresh, saved chunks restore identity, represented sections, metadata and links; original extraction, complete heading decisions, section-part history and the full event timeline cannot be reconstructed. Empty parent responses during processing mean not saved yet.

Questions depend on ingestion COMPLETED, including when summary fails. Prepared chunks, successful embeddings, transaction completion, question readiness and summary completion are distinct states. Gemini extraction/correction usage is live-only; LlamaParse charges, summary usage, local compute, credits, taxes, discounts, and invoice adjustments are outside the estimate.

## Verification

Run `npm test`, `npm run build`, and `npm run lint`.

Local fixture/mocked API tests cover byte-by-byte UTF-8/SSE boundaries, CRLF/comments/malformed JSON, unknown events, authenticated transport, stale document/request isolation, upsert counts, independent readiness, summary failure, old/null metadata, missing extraction history, heading siblings 17/18, D08?D12 continuations, unresolved section 5A references, distinct Kettleby values/dates, cross-source context, 19 unique list IDs with fragments, identity compaction, safe Markdown, lazy vector display and stored vectors.

A read-only local API probe to `http://localhost:3000/api/documents/my-documents` returned HTTP 401. The backend is reachable, but no authenticated session or stress PDF is available to this implementation run. Fixture results are not evidence of a successful live upload. Pending real authenticated checks:

1. Fresh multipart upload returns HTTP 202, connects immediately, and receives the configured mode's extraction/correction and new chunking events.
2. Save/ready/summary transitions and actual parent/child/vector output match the contract.
3. Refresh and interrupted-stream reconnection restore saved output while correctly marking missing live history.
4. Owner-only inspection/progress access, inaccessible 404s and expired-token handling behave correctly.
5. The original stress PDF produces correct sibling headings, continued tables, labelled values and list identities in persisted output.

## CRAG chat integration

`POST /api/chat` uses bearer-authenticated streaming fetch, incremental UTF-8 decoding and fragmented LF/CRLF frame parsing. Scoped requests include `documentId`; global requests omit it. The existing conversation ID comes from `GET /api/chat/conversation`, and clearing uses `DELETE` on the same endpoint. Both conversation operations omit the document query parameter for global mode. History requests and answer completions are guarded against stale context/request results.

Every status, tool, retrieval candidate, rerank, neighbor expansion, grading, generation context, token, done and error event is dispatched into the assistant message. A terminal frame cancels the reader even if the server keeps the connection open. Partial answers remain visible on failure or cancellation.

The collapsible Reasoning Trace shows the supplied intent, standalone sub-queries, ordered retrieval rounds, targeted missing-fact follow-ups, and unique final-context counts for Search Hit, Table Continuation, Section Expansion and Reading Order. Advanced details retain full grading decisions and the exact assembled context.

Citation tags such as `[parent-id: Page 4]` and `[parent-id: Depot Handbook, Page 3-4 (5. Financial record)]` become buttons. A button resolves its source by the actual parent ID in the final generation context and opens a keyboard-accessible source drawer with title, pages, section, origin, complete passage, row IDs and budget. If live context is missing after history hydration, opening a citation fetches the saved parent through the existing child-chunk endpoint; vectors are fetched only on opening, never for every citation in advance. Returned IDs and supplied document scope/title are checked before binding. Retrieval origin remains unavailable when not returned. Code and existing Markdown links are left intact. Inaccessible or unresolvable citations explicitly show unavailable source context; page numbers alone never bind a different source.

Additional mocked integration and server-rendered UI tests cover all chat event types, multi-round CRAG retries, authenticated byte-fragmented CRLF streams, open connections after done, origin pills, citation parsing/click binding, safe passage Markdown, scoped/global history hydration and clearing, and stale chat requests. A real authenticated backend chat remains a manual integration check.

## File citations and answer usage events

Chat also dispatches `retrieved_chunks` (`count`, `chunks`), `citations` (`citations`), and `total_usage_summary` (`totalTokens`, `totalCostINR`, `formattedTotalCost`, `breakdown`). These events should arrive before the terminal `done` event. Each answer retains the supplied snapshots and raw trace events. Usage totals replace previous summaries rather than accumulating them, so repeated summaries do not double-count tokens or cost.

`step_cost` is dispatched and retained per answer. Addendum v2 specifies `step`, `model`, `promptTokens`, `completionTokens`, `totalTokens`, `costUSD`, `costINR` and `formattedINR`. The usage panel renders model, input/output/total tokens and reported USD/INR for each invocation. Missing measurements in older records remain unavailable. Live step costs remain accessible after the final summary arrives; the server's final total stays authoritative. If a step event supplies an `eventId`, a repeated event with that ID is ignored.

The answer displays clickable citation labels, a collapsible list of complete retrieved passages, and server-reported answer usage with per-step token/cost breakdown. A retrieved count larger than the supplied list is shown explicitly. Inline `[Page 3]`, exact display-label citations, and the previous parent-ID citation syntax remain supported. Ambiguous page labels across files do not silently select a document; each explicit source button remains independently clickable.

Flat citation labels such as `sourceId: "Page 3"` bind to a retrieved chunk by exact file URL, page and source offsets, not by a parent-ID REST lookup. Opening one uses the existing document preview modal at `pageNumber`, retaining the exact `startOffset`/`endOffset` and complete chunk text (or the supplied snippet when no chunk matches). URLs are restricted to HTTP(S).

PDF citations use a lazily loaded, locally bundled PDF.js viewer/worker with selectable text, Previous/Next navigation, and a return-to-cited-page control. Backend offsets may index corrected Markdown or document-wide extraction rather than a PDF text layer. The viewer therefore locates the supplied passage/snippet in the selected page's text, verifies repeated matches using offsets only when they index that same text, and highlights the corresponding text runs. It never treats document-wide offsets as indices into a short chunk. Scanned pages or unmatched text show the supplied highlighted excerpt separately. Load failures retain the excerpt and offer the native PDF preview and a page-specific external link. No new backend endpoint is required.

Tests exercise fragmented delivery of all three events, repeated usage summaries, same-page citations across documents, original offset preservation, inline labels, safe URLs, snippet fallback, whitespace/Unicode text-run mapping, and page-three extraction from a real PDF fixture. Desktop and mobile browser fixture checks also verified page selection, on-page highlights, source offsets, modal closing and preserved reasoning-trace expansion.

## Addendum v2 implementation and changed files

- `src/utils/chatSources.js`: citation indexes keyed by source label and chunk ID, document/chunk identity checks, evidence accumulation and final-context enrichment. `src/utils/crag.js`: separate parallel-query groups, retained query lists per round and chunk-ID source resolution.
- `src/redux/actions/chatActions.js`: preserve the complete tool-start event. `src/redux/slices/chatSlice.js`: match pending tools by tool/query/attempt, preserve concurrent searches and prior evidence, store citation indexes, and settle remaining tools at generation/stream completion.
- `src/components/chat/CitationTooltip.jsx` (new): accessible hover/focus snippet cards and compact page/document labels. `Markdown.jsx`: bind inline citation pills to indexed sources with tooltips. `AnswerSources.jsx`: Evidence Chunks panel with origin, page span, section breadcrumb, safe Markdown tables, contextual search text and exact evidence JSON. `RetrievalOrigin.jsx`: Direct Search label.
- `src/components/chat/AnswerUsage.jsx`: expandable query cost pill, detailed model/input/output/total/USD/INR tables and raw live/final usage records. `AnswerTimeline.jsx`: per-query event groups, all parallel round queries and direct follow-up routing. `MessageBubble.jsx`: integrate final accumulated evidence, indexed citations, previews and passage fallback.
- `src/components/chat/SourceDrawer.jsx`, `src/services/citationSource.js` and `src/components/documents/DocumentPreview.jsx`: accept flat v2 evidence, resolve stored passages by actual `chunkId`, preserve multi-page source spans and show section breadcrumbs in file previews. Page labels never become parent lookup IDs.
- `src/types/pipeline.js`: document the new evidence, citation and step-cost fields.
- `tests/chat-source-fixtures.js`, `tests/chat-sources.test.js`, `tests/chat-crag-integration.test.js`, `tests/chat-crag-ui.test.js`: v2 schemas, multi-page mapping, tooltip safety/association, detailed billing, concurrent completion matching, direct next-hop events and two-round accumulated final evidence.
- `docs/document-inspector-backend-contract.md`: this contract and validation record.

The frontend displays expansion provenance supplied by the backend. Section-first expansion and the 40-chunk safety ceiling remain server responsibilities; the client neither invents missing chunks nor silently truncates authoritative context. A `Query Rewriter` finish event without a matching start is rendered as a direct follow-up; it does not trigger another frontend request or infer an extra billed LLM call. Final generation document order is retained exactly.

## Markdown-to-PDF highlighting

`src/utils/pdfPassage.js` maps selected Markdown to visible PDF text runs. It first verifies exact passage matches, then compares normalized words to handle table pipes, emphasis, ligatures, punctuation, line breaks and denormalized column labels. It marks matching row spans and associates numeric values with a preceding selected row identifier, while excluding unrelated identifiers and ambiguous repeated passages. Source offsets remain unchanged and are not blindly applied to the PDF extraction text.

`PdfCitationPreview.jsx` paints every matched span in the PDF text layer, scrolls to the first highlight, and applies the same matching on every supplied `sourcePages` page. `DocumentPreview.jsx` starts with the PDF filling the modal and makes the Markdown excerpt available through the Source text toggle. Unmatched/scanned pages report that no text-layer match was found.

`tests/pdf-passage.test.js` covers Markdown tables, denormalized labels, ligatures, numeric cells, unrelated/repeated text, multiple highlights per run, multi-page eligibility, and extraction/matching against a real PDF fixture. A headless browser fixture also verified visible marks over the depot passage and its cost on page 3, a collapsed side excerpt, and a working Source text toggle.

## Chat History v3: persisted message metadata

Conversation hydration retains the actual `message.metadata` returned by `GET /api/chat/conversation`, including null user metadata and unknown metadata keys. Live citation events also populate `metadata.citations`; final usage events populate `metadata.totalTokens`, `metadata.totalCostINR` and `metadata.formattedTotalCost`. The server persists these records; the frontend does not create a new persistence endpoint or rely on local storage to recreate history.

`messageMetadata.js` provides safe citation/usage access for both live and historical records. Rendering uses saved `metadata.citations` as the canonical source, with the former transient citation array retained as a compatibility fallback. Optional saved totals render only when present; live per-step details remain distinct from totals actually returned in history.

`resolveCitations` recognizes `[Source ID: Page 3-4]`, `[Page 4]`, exact display-label tags and `[Source: <displayLabel>]`. It uses the same indexed resolver in live and hydrated messages. Unmatched older citations become neutral non-interactive badges. Code and ordinary Markdown links remain unchanged. Invalid citation arrays/records are ignored at the rendering boundary without discarding unrelated metadata.

Tooltips retain title, section label, pages and snippet, and add View in Document/View source and safe page-specific Open PDF actions. A saved citation with no file URL opens the existing source drawer, loads its actual parent chunk when an ID is available, and retains the saved snippet if the full parent cannot be retrieved. No guessed page-label REST request is made.

Changed files for v3: `src/redux/slices/chatSlice.js`; `src/utils/messageMetadata.js` (new), `chatSources.js`, `remarkCitations.js`, `crag.js`; `src/components/chat/MessageBubble.jsx`, `Markdown.jsx`, `CitationTooltip.jsx`, `AnswerSources.jsx`, `SourceDrawer.jsx`; `src/services/citationSource.js`; `src/types/pipeline.js`; `tests/message-metadata.test.js` (new), `tests/chat-crag-ui.test.js`; and this document.

Focused tests cover authenticated metadata hydration, fresh-store historical reload, identical live/historical resolver behavior, inline PDF click destinations and offsets, tooltip actions, null/malformed metadata, missing-file parent lookup and snippet fallback, and live-stream metadata retained through completion and subsequent history hydration. Real server database persistence still depends on the supplied backend migration and implementation.

A local headless-browser fixture loaded history through the existing conversation thunk/API adapter, reloaded it, focused the metadata-backed citation, verified the visible snippet/actions, and clicked through to page 3 with visible PDF highlights. The check used a mocked conversation response and a real PDF fixture; it does not claim to validate the backend migration or database writes.

## Chat v4: reference traversal, relationships and TOC indicators

Reference-following origins are displayed with amber link badges in live and historical citations, source previews, retrieval cards and the reasoning trace. The trace shows observed seed → reference → target paths without requiring advanced details. Selecting a path opens and scrolls to the evidence inspector and highlights both records by document/chunk ID. Earlier retrieval context remains available for this selection even if the seed was removed from the final generation context; clearing the selection restores the normal final evidence view. Reference tags in evidence select matching explicitly followed targets rather than guessing targets from text.

Tooltips show the reference, target label, snippet and observed seed page/heading, with a page-specific Open Source PDF action. Source previews preserve this origin context alongside PDF passage highlighting. History retains the backend citation origin unchanged; missing seed records explicitly show “Seed context unavailable.” No new API, persistence field or frontend factual-search filter was added: TOC exclusion remains the backend's responsibility.

Document chunk rows and detailed inspection show TOC badges with the exclusion tooltip. Inspection supports both new string references/cross_references and legacy structured reference objects, page-to-page relationships, and a Restatement / Precedence Item indicator based on the document title/heading. This role indicator does not assert that an override has occurred.

Changed files for v4:

- Utilities: `src/utils/crossReferences.js` (new), `src/utils/retrievalOrigin.js` (new), `src/utils/crag.js`, `src/utils/chatSources.js`.
- Chat components: `src/components/chat/ReferenceFlow.jsx` (new), `AnswerTimeline.jsx`, `AnswerSources.jsx`, `CitationTooltip.jsx`, `Markdown.jsx`, `MessageBubble.jsx`, `RetrievalOrigin.jsx`, `SourceDrawer.jsx`.
- Chunk components: `src/components/chunks/ReferenceDetails.jsx` (new), `ChunkInspection.jsx`, `StructuredDetails.jsx`, `ParentChunkRow.jsx`.
- Preview and types: `src/components/documents/DocumentPreview.jsx`, `src/types/pipeline.js`.
- Tests: `tests/cross-references.test.js` (new), `tests/crag.test.js`, `tests/message-metadata.test.js`.
- Documentation: `docs/document-inspector-backend-contract.md`.

Verification covers both neighbor_expansion and retrieved_chunks, origin icons/labels and tooltip actions, reference path selection and evidence highlights, seed document ownership/ambiguity, missing seed context, sparse later records, reference tags/relationships/TOC, legacy reference objects, and authenticated conversation reload with reference-followed citations. These checks use supplied/mock API records and do not validate real backend extraction or precedence decisions.

## Chat v5: persisted reasoning and targeted context

Historical assistant messages now hydrate `metadata.steps` (raw non-token stream events) into settled timeline steps. `messageMetadata.js` provides shared step, per-step cost and final usage access, preserving the original event records in metadata. The same trace, query groups, chunk-index labels, reference paths, evidence inspector and cost breakdown render after an authenticated conversation reload. Completing a live stream snapshots its non-token events into local message metadata; database persistence remains the backend's responsibility. Null/older metadata and malformed step-array entries remain safe.

`section_sibling` and `section_lead` have distinct Context Sibling and Section Header & Scope badges/icons/tooltips. Origin counts include both, while the previous expansion labels remain compatible. Saved and live next_hop/rewrite events with the existing query field appear as follow-up queries. Definition indicators identify a reference in a returned heading or at the passage start; a passing mention retains a reference/target-heading label without asserting a verified definition. Chunk inspection shows isDocumentBoundary/boundaryTitle and preserves TOC indicators.

Final generation context remains authoritative, with all supplied passages displayed. The frontend does not apply another six-chunk/16,000-character truncation or perform reference ranking: these limits and selection rules are enforced by the backend. Citation previews retain the original page and offsets and use the existing PDF text matching to highlight the passage.

Changed files for v5:

- State/actions: `src/redux/slices/chatSlice.js`, `src/redux/actions/chatActions.js`.
- Utilities/types: `src/utils/messageMetadata.js`, `chatSources.js`, `crag.js`, `crossReferences.js`, `retrievalOrigin.js`; `src/types/pipeline.js`.
- Chat components: `src/components/chat/MessageBubble.jsx`, `AnswerUsage.jsx`, `RetrievalOrigin.jsx`, `CitationTooltip.jsx`.
- Chunk components: `src/components/chunks/ReferenceDetails.jsx`, `ParentChunkRow.jsx`.
- Tests: `tests/message-metadata.test.js`, `chat-crag-ui.test.js`, `crag.test.js`, `cross-references.test.js`.
- Documentation: `docs/document-inspector-backend-contract.md`.

Verification includes authenticated saved-trace hydration with tool steps, intent/sub-queries, rerank scores, grading, follow-ups and per-step costs; live-to-history non-token event snapshots; safe old/malformed histories; all five retrieval origins and tooltips; six-chunk context rendering; definition vs passing-mention indicators; boundary titles; and reference-origin PDF page/offset/highlight selection.

## Reasoning chain modal

The chat stream now handles reasoning_chain and retains its raw reasoningChain in message.metadata alongside citations, usage and persisted trace events. The same metadata property restores the chain from conversation history. messageReasoningChain validates optional data at the rendering boundary and retains unknown step types with a generic icon.

Assistant bubbles show live and historical execution steps inline in the expanded Reasoning Trace. Steps remain visible after completion unless the user collapses the trace. The AI reasoning chain has a separate compact Reasoning Chain button; its summary, numbered steps, descriptions and findings appear in the modal, along with a collapsible detailed retrieval trace. Completion does not close an open modal; reference-path selection closes it deliberately to reveal highlighted evidence. Escape/backdrop/Close dismiss the native dialog and restore focus to the trigger. Styling uses the existing theme tokens and a scrollable responsive modal.

Changed files: src/services/chatStream.js; src/redux/actions/chatActions.js; src/redux/slices/chatSlice.js; src/utils/messageMetadata.js; src/components/chat/ReasoningViewer.jsx (new), AnswerTimeline.jsx and MessageBubble.jsx; src/types/pipeline.js; tests/message-metadata.test.js and tests/chat-crag-ui.test.js; and this document.

Tests cover byte-fragmented reasoning_chain SSE, completion and authenticated history reload, compact bubbles, detailed modal content, malformed/empty chains, unknown types and escaped text. A local headless-browser fixture verified the live modal, chain updates, remaining open on completion, Escape, focus return, reopening and Close. Temporary browser fixtures/profiles and their dev server were removed after the check.

## Durable billing data still missing

A complete per-document bill cannot be reconstructed from the current API. It would require a persisted, ownership-checked endpoint such as `GET /api/documents/:documentId/usage` returning immutable usage records keyed by document ID, provider, operation, model, batch/request ID, pricing class (standard, batch, free tier, or cached), input/candidate/thinking/cached token counts, currency/rate metadata, LlamaParse pages or credits, summary-model usage, timestamps, and whether each provider request succeeded. Invoice credits, taxes, discounts, and adjustments would still require provider billing data rather than inference from tokens.
