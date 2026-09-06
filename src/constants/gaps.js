/**
 * Known limitations and the roadmap ahead — deliberately public.
 * A system's honest edges say more about its engineering than its feature list.
 *
 * Content only, the same as `constants/pipeline.js`: the About page renders
 * this and holds no copy of its own.
 */
export const GAPS = [
  {
    id: 1,
    title: 'No Approximate Nearest Neighbour Index',
    gap: 'The ChildChunk embedding column has no HNSW or IVFFlat index. Every vector search is an exact sequential scan computing cosine distance against every row in the table — O(n) on each query.',
    impact:
      'Imperceptible at a few thousand chunks, but latency grows linearly and degrades badly past ~100k chunks.',
    plan: 'Add an HNSW index and tune m / ef_construction, then benchmark the recall-versus-latency tradeoff rather than assuming the default is correct.',
    terms: ['HNSW', 'IVFFlat', 'ANN vs. Exact Search', 'Recall/Latency Tradeoff'],
  },
  {
    id: 2,
    title: 'No Lexical or Metadata Indexing',
    gap: 'The BM25 half of hybrid search runs to_tsvector over raw text at query time with no GIN index, the JSONB page lookup is unindexed, and no B-Tree covers the documentId or parentId foreign keys.',
    impact:
      'Both halves of the hybrid query and every join sequentially scan, compounding the ANN gap above.',
    plan: 'Add a GIN index on the tsvector expression, a B-Tree on the foreign keys, and an expression index on metadata->>page_number. Verify each with EXPLAIN ANALYZE instead of trusting that the index is used.',
    terms: ['GIN Indexing', 'Expression Indexes', 'EXPLAIN ANALYZE', 'Sequential Scan Elimination'],
  },
  {
    id: 3,
    title: 'No Automated Evaluation Harness',
    gap: 'Retrieval and answer quality are validated manually. There is no golden dataset and no regression suite, so the measured contribution of the cross-encoder reranker, the RRF k-constant, the chunk sizing, and the MAX_STEPS ceiling are all currently unknown.',
    impact:
      'Every tuning decision in the pipeline is an educated guess, and any change could silently regress quality.',
    plan: 'Build a 50-question golden dataset and score retrieval (recall@k, MRR, NDCG) separately from generation (faithfulness, context precision), then run it in CI so prompt and chunking changes are gated like unit tests.',
    terms: [
      'Golden Dataset',
      'recall@k / MRR / NDCG',
      'Faithfulness Scoring',
      'Continuous Evaluation',
    ],
  },
  {
    id: 4,
    title: 'Indirect Prompt Injection Surface',
    gap: 'The pipeline ingests untrusted third-party documents and feeds their extracted text directly into the context of an LLM that holds live tool-calling privileges. Retrieved chunk content is not sanitized or delimited as untrusted data.',
    impact:
      'A crafted document could contain instructions that the agent reads as commands, steering its tool calls or its final answer.',
    plan: 'Delimit and label retrieved context as untrusted, add input and output guardrails, and treat the LLM as a confused-deputy boundary rather than a trusted component.',
    terms: [
      'Indirect Prompt Injection',
      'Confused Deputy Problem',
      'Guardrails',
      'Untrusted Context Delimiting',
    ],
  },
  {
    id: 5,
    title: 'No Caching Layer',
    gap: 'The system prompt, tool schemas, and retrieved context are re-sent in full on every turn, and semantically identical questions re-run the entire retrieval and generation pipeline from scratch.',
    impact: 'Redundant token spend and avoidable latency on repeated or near-duplicate queries.',
    plan: 'Adopt provider prompt caching for the static prefix and add a semantic cache keyed on query embedding similarity rather than exact string match.',
    terms: ['Prompt Caching', 'Semantic Caching', 'Cache Key by Embedding Similarity'],
  },
  {
    id: 6,
    title: 'Manual Provider Failover',
    gap: 'The provider abstraction layer makes swapping between Groq and OpenRouter trivial, but the swap is a manual environment variable change. There is no automatic retry, exponential backoff, or fallback on a 429 or a provider outage.',
    impact:
      'A rate limit still surfaces to the user as a failed request rather than being absorbed transparently.',
    plan: 'Wrap the client in a retry policy with jittered backoff and automatic cascade to the secondary provider on rate-limit and 5xx classes.',
    terms: [
      'Exponential Backoff with Jitter',
      'Automatic Failover',
      'Circuit Breaking',
      'Graceful Degradation',
    ],
  },
  {
    id: 7,
    title: 'Fixed 384-Dimension Embedding Ceiling',
    gap: 'all-MiniLM-L6-v2 is a small, fast, general-purpose bi-encoder. It carries no domain adaptation and represents a hard ceiling on first-stage retrieval quality that no amount of downstream reranking can fully recover.',
    impact:
      'Domain-specific vocabulary and long-tail technical terms embed less distinctly than a larger or fine-tuned model would place them.',
    plan: 'Benchmark larger and domain-tuned embedding models against the golden dataset, and evaluate contextual retrieval — prepending generated context to each chunk before embedding — as a likely larger win than swapping the model alone.',
    terms: [
      'Bi-Encoder Ceiling',
      'Embedding Dimensionality',
      'Contextual Retrieval',
      'Domain Adaptation',
    ],
  },
  {
    id: 8,
    title: 'No Re-Indexing or Document Versioning',
    gap: 'Ingestion is single-shot. Changing the chunking strategy, the embedding model, or the parsing instruction requires re-uploading every document, and there is no version history on a re-ingested file.',
    impact: 'Pipeline improvements cannot be applied retroactively to an existing corpus.',
    plan: 'Add a re-index job that rebuilds chunks and vectors from the stored source artifact, and version chunk rows against the pipeline configuration that produced them.',
    terms: [
      'Re-Indexing Pipeline',
      'Corpus Migration',
      'Chunk Versioning',
      'Idempotent Ingestion',
    ],
  },
];

export default GAPS;
