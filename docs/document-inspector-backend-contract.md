# Pipeline inspector contract and verification

This frontend uses the backend contract supplied on 2026-10-04. The configured local API was not reachable during implementation, so the examples below are contract examples rather than observed production responses.

## Authenticated REST

The existing Axios client supplies the bearer token and unwraps `{ success: true, data }` for the inspector's GET requests. `GET /api/documents/my-documents` restores filename, ID, `status`, and `summaryStatus` after refresh. Questions are enabled only at `status: COMPLETED`; the explicit Summary action is enabled only at `summaryStatus: COMPLETED`.

`GET /api/documents/get-all-parent-chunk/:docId` supplies saved parent `id`, `documentId`, `text`, `searchText`, `prevParentId`, `nextParentId`, `totalChildren`, and metadata. The inspector groups by `(documentId, metadata.section_id)` and orders by zero-based `metadata.chunk_index`. Explicit `null` link IDs are section boundaries.

`GET /api/documents/get-all-child-chunk/:parentId` supplies the complete parent, `totalChildren`, and ordered child records. The inspector loads these only when a parent expands. It displays each child's raw/contextual text, `metadata.embedding` diagnostics, `embeddingDimensions`, and the actual `embedding` numeric array with indices and a copy action. The full vector is never inferred from dimensions.

## Authenticated processing SSE

The existing `fetch` reader sends the bearer header to `GET /api/documents/progress/:docId`. The reducer records the received JSON events and deduplicates by JSON `eventId`; no SSE `id:` header is required. Replayed and live events are merged by section ID plus document ID and by parent/child UUID. `parent_links` updates earlier `parent_created` records. `child_created` and `child` remain labelled as in-memory preparation or embedding. `chunking_complete` does not unlock questions. `chunks_ready` makes the saved REST tree authoritative, while the stream continues through summary processing.

The timeline shows extraction, heading, code-fence, section, part, chunk, embedding, saving, readiness, and summary events with local-time timestamps and expandable exact JSON. Extracted page text, heading decisions, and empty sections appear only when retained Redis history is replayed. Saved parent metadata still rebuilds nonempty sections after history expires.

## Chat search SSE

The answer trace keeps existing status/tool/token/done/error events. Its advanced toggle displays the implemented `retrieval_candidates`, `rerank_result`, `neighbor_expansion`, `grading_result`, and `generation_context` frames. Candidate retrieval and rerank scores are shown only when returned. Neighbor origins identify the seed and direction. Grading shows the returned relevant boolean and decision source without inventing explanations. `generation_context.contextText` is displayed verbatim, and real parent IDs link to the document inspector. Summary context objects without parent IDs are not linked as stored parents.

## Verification and limits

Automated tests cover replay deduplication, section and child merging, empty sections, saved-record precedence, readiness, authenticated SSE parsing, and structured search events. `npm run build` succeeds. Live checks against a fresh cross-page document remain pending because `http://localhost:3000/api` refused the connection. The following require a running authenticated backend and test document: cross-page breadcrumbs and links, saved vectors/diagnostics, real search candidates and generation context, 24-hour replay, and owner-only 404 behavior.

The inspector does not change backend chunking. The document title is still the filename; heading recognition may misclassify bold sentences; oversized labelled embedding inputs fail rather than resize; tables still use character splitting; and the vector index migration issue remains separate.

`RAG_DEBUG=false` affects only backend terminal detail logs. It does not remove the authenticated frontend event stream.
