/**
 * The vocabulary this project was built out of — every idea the pipeline in
 * `constants/pipeline.js` put to work, defined once.
 *
 * Grouped by where each one lives in the system rather than by when it was
 * learned, so the list reads as a map of the architecture.
 */
export const GLOSSARY = [
  {
    group: 'Data Ingestion & Structuring',
    color: 'blue',
    terms: [
      {
        term: 'Page-Aware Ingestion',
        definition:
          'Processing documents by physical page boundaries rather than flattening them into one continuous text blob.',
      },
      {
        term: 'Vision OCR Parsing',
        definition:
          'Using vision models (like LlamaParse) to extract complex layouts, financial tables, and scanned images into structured markdown.',
      },
      {
        term: 'Hierarchical Chunking',
        definition:
          'Splitting data into two connected tiers: large ParentChunks (for the LLM to read) and small ChildChunks (for precise vector math).',
      },
      {
        term: 'JSONB Metadata Indexing',
        definition:
          'Attaching flexible, queryable JSON objects (like page_number and chunk_index) to chunks to track their exact origin and chronological sequence.',
      },
    ],
  },
  {
    group: 'Retrieval & Routing',
    color: 'green',
    terms: [
      {
        term: 'Dual-Path Agent Router',
        definition:
          'An architecture that intelligently chooses between vector math (for conceptual questions) and deterministic database lookups (for exact coordinates).',
      },
      {
        term: 'Deterministic Page Lookup',
        definition:
          'Bypassing AI embeddings completely to fetch exact document pages using native database queries (via Prisma ORM).',
      },
      {
        term: 'Reciprocal Rank Fusion (RRF)',
        definition:
          'A hybrid algorithm that combines traditional keyword search and vector similarity to return the most accurate results.',
      },
      {
        term: 'Coordinate-Based Retrieval',
        definition:
          'Searching for data based on its physical location in a document (e.g., "What is on Page 3?") rather than its semantic meaning.',
      },
    ],
  },
  {
    group: 'Agentic Logic & Defenses (The ReAct Loop)',
    color: 'purple',
    terms: [
      {
        term: 'ReAct Loop',
        definition:
          'An agent architecture where the LLM alternates between Reasoning (planning) and Acting (calling external tools like your database).',
      },
      {
        term: 'Circuit Breaker (MAX_STEPS)',
        definition:
          'A hard limit on tool-calling iterations to prevent the agent from getting stuck in infinite loops.',
      },
      {
        term: 'Duplicate Query Detection',
        definition:
          'Using memory structures (Set()) to catch and block the LLM when it panics and fires the exact same search query twice.',
      },
      {
        term: 'Terminal State Signalling',
        definition:
          'Giving the agent an explicit failure string (like SEARCH_RESULT: Empty) so it knows when a search yielded zero results, rather than leaving it confused.',
      },
      {
        term: 'Graceful Bailout Prompting',
        definition:
          'System prompt rules that force the AI to safely terminate and summarize what it knows if it hits the circuit breaker limit.',
      },
      {
        term: 'Reasoning vs. Instruction-Tuned Models',
        definition:
          'The architectural difference between models that output internal chain-of-thought (which can break JSON parsers) versus models that directly output standard API tool calls.',
      },
      {
        term: 'Anti-Hallucination Protocols',
        definition:
          'Strict prompt engineering designed to force the model to say “I don’t know” instead of inventing facts when tool responses are empty.',
      },
    ],
  },
  {
    group: 'System Transparency & Validation',
    color: 'teal',
    terms: [
      {
        term: 'Server-Sent Events (SSE)',
        definition:
          'A unidirectional web connection that streams live agent execution states (tool starts, status updates, generated tokens) to the frontend in real-time.',
      },
      {
        term: 'Source Grounding',
        definition:
          'Forcing the LLM to base its answers strictly on verified database text, transforming the AI from a creative writer into a factual synthesizer.',
      },
      {
        term: 'Context-Window Injection',
        definition:
          'The critical step of pushing retrieved database chunks back into the messages array so the LLM can actually read the data.',
      },
      {
        term: 'Inline Citation Tagging',
        definition:
          'Forcing the LLM to output specific metadata tags ([Source ID: Page X]) within its response to enable frontend UI chips.',
      },
      {
        term: 'Black-Box System',
        definition:
          'An opaque architecture where the user cannot see the internal reasoning — dismantled here in favour of an auditable pipeline.',
      },
    ],
  },
  {
    group: 'Infrastructure',
    color: 'amber',
    terms: [
      {
        term: 'Provider Abstraction Layer',
        definition:
          'Designing the API logic to seamlessly hot-swap between different LLM providers (like Groq and OpenRouter) using the exact same standard message structures.',
      },
      {
        term: 'Token Budget Management',
        definition:
          'Protecting your API quota by controlling context window sizes and aggressively cutting off infinite loops.',
      },
    ],
  },
];

export default GLOSSARY;
