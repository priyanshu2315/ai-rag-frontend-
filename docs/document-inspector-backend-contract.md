# Structured chunk inspector integration

Contract: structured-context-v4, supplied and checked against backend on 7 October 2026. Implementation uses JavaScript/JSX, existing React components, Redux and bearer-authenticated API clients.

## Changed behavior

- `progressStream.js` uses authenticated fetch with `Accept: text/event-stream`, a streaming UTF-8 decoder, buffered LF/CRLF SSE parsing, malformed-record isolation, document filtering and cancellation. Only completed, summary_failed and failed close the stream as terminal events. Unexpected closure is a connection issue.
- `useDocumentProgress.js` retains the session on remount and retries at most five times with exponential backoff. It refetches document statuses on reconnection and stops on authorization failures. `AppShell.jsx` watches the selected unfinished document, disconnecting on a document switch, navigation out of the shell or logout.
- `structuredInspector.js` and `progressReducer.js` maintain document-scoped source, heading, section, part, parent and child maps alongside raw event history. Real chunk IDs deduplicate preparation/embedding events. Persisted/readiness state and completed diagnostics survive late preparation events. Specific chunking/embedding errors remain visible after a generic terminal failure.
- `ChunkExplorer.jsx` and `useDocumentChunks.js` restore statuses and stored parents on refresh and refetch parents after chunks_saved/chunks_ready or reconnect. Children and vectors are fetched only on parent expansion. `chunkSlice.js` ignores stale request IDs and mismatched document/parent responses; stored child responses update their authoritative parent.
- `StructureOverview.jsx` displays identity separate from headings, inferred heading trees using parentCandidateId, independent ingestion/summary/connection indicators, prepared/embedded/saved counts, warnings, unresolved relationships, table/list groupings, owning sections and original reading placement. Tables expose labelled passage values rather than inventing a cell schema. Unique item IDs count once across fragments within the loaded document scope.
- `StructuredDetails.jsx` adds budgets, structural IDs, source/context evidence, compaction/fragment flags, identity metadata and relationships to parent/child cards. Explicit references, reading-order navigation and inferred table continuations remain distinct, including unresolved target navigation. Search traversal of semantic relationships remains pending backend Part 2.
- `SourcePages.jsx` supports rendered/image/document sources without physical page numbers, separate parser pages, raw text and safe Markdown. Source spans use UTF-16 offsets; source_unit evidence does not promise exact split-child highlighting.
- `ProcessingTimeline.jsx` preserves unknown events and supports category filters plus progressive rendering. Parent/child/source/structure lists render progressively; vector numbers render only after expansion. `ProcessingPanel.jsx` uses indeterminate overall progress and preserves connection problems separately from ingestion failures.
- `architecture.html` replaces current character-size descriptions with contextual token budgets. Historical documents retain their supplied chunker version.

## Persistence and provenance

There is no backend progress replay, Redis history request or Last-Event-ID recovery. Captured events are memory-only, document-scoped session data. Early upload events and events missed during disconnect are unavailable. On refresh, saved chunks restore identity, represented sections, metadata and links; original extraction, complete heading decisions, section-part history and the full event timeline cannot be reconstructed. Empty parent responses during processing mean not saved yet.

Questions depend on ingestion COMPLETED, including when summary fails. Prepared chunks, successful embeddings, transaction completion, question readiness and summary completion are distinct states. Token budgets include contextual input and special tokens. Parent default: 1,024 tokens. Child maximum: lower of 256 tokens and embedding tokenizer limit. No generative AI call was added to chunk creation; extraction uses LlamaParse for supported formats and embedding uses the local model.

## Verification

Run `npm test`, `npm run build`, and `npm run lint`.

Local fixture/mocked API tests cover byte-by-byte UTF-8/SSE boundaries, CRLF/comments/malformed JSON, unknown events, authenticated transport, stale document/request isolation, upsert counts, independent readiness, summary failure, old/null metadata, missing extraction history, heading siblings 17/18, D08?D12 continuations, unresolved section 5A references, distinct Kettleby values/dates, cross-source context, 19 unique list IDs with fragments, identity compaction, safe Markdown, lazy vector display and stored vectors.

A read-only local API probe to `http://localhost:3000/api/documents/my-documents` returned HTTP 401. The backend is reachable, but no authenticated session or stress PDF is available to this implementation run. Fixture results are not evidence of a successful live upload. Pending real authenticated checks:

1. Fresh multipart upload returns HTTP 202, connects immediately, and receives v4 extraction/heading/structure events.
2. Save/ready/summary transitions and actual parent/child/vector output match the contract.
3. Refresh and interrupted-stream reconnection restore saved output while correctly marking missing live history.
4. Owner-only inspection/progress access, inaccessible 404s and expired-token handling behave correctly.
5. The original stress PDF produces correct sibling headings, continued tables, labelled values and list identities in persisted output.

Existing chat retrieval traces and document question/summary gates continue to use their current contracts.
