/**
 * The AI vendors, models, and packages behind DocuMind. Mirrors
 * `constants/pipeline.js`: content lives here, the About page just renders
 * it (§2).
 */
export const AI_PLATFORMS = [
  {
    name: 'Universal LLM Engine (Groq & OpenRouter)',
    package: 'openai',
    model:
      'gpt-oss-120b (answer generation, question splitting) · gpt-oss-20b (security firewall, intent routing, relevance grading, query rewriting, document summaries)',
    purpose:
      'OpenAI-compatible cloud inference with a two-tier model split: a large model for reasoning-heavy steps and a fast model for high-volume classification. Provider is switchable via AI_PROVIDER.',
    color: 'blue',
  },
  {
    name: 'LangGraph',
    package: '@langchain/langgraph',
    model: 'StateGraph (Corrective RAG pipeline)',
    purpose:
      'Orchestrates intent routing, question decomposition, hybrid retrieval, context-aware grading, query rewriting and grounded generation as a state machine, streaming each step to the user',
    color: 'purple',
  },
  {
    name: 'Hugging Face — Local',
    package: '@xenova/transformers',
    model: 'Xenova/all-MiniLM-L6-v2',
    purpose: 'Local vector embeddings, 384 dimensions, running on-device via ONNX',
    color: 'green',
  },
  {
    name: 'Cohere',
    package: 'cohere-ai',
    model: 'rerank-english-v3.0',
    purpose: 'Cross-encoder re-ranking of hybrid-search results for each sub-query',
    color: 'purple',
  },
  {
    name: 'LlamaCloud',
    package: 'llama-cloud-services',
    model: 'LlamaParse Premium',
    purpose:
      'Vision-based parsing of PDFs, DOCX and images into Markdown, including tables and chart data',
    color: 'amber',
  },
  {
    name: 'LangSmith',
    package: 'langsmith',
    model: 'Tracing SDK',
    purpose: 'RAGOps observability: traces every pipeline step and LLM call',
    color: 'teal',
  },
];

export const ENV_KEYS = [
  { key: 'AI_PROVIDER', note: 'active inference provider: "groq" | "openrouter"' },
  { key: 'GROK_API_KEY', note: 'Groq inference (the code reads this exact spelling)' },
  { key: 'OPENROUTER', note: 'OpenRouter inference' },
  { key: 'COHERE_API_KEY', note: 'used only for the re-ranker' },
  { key: 'LLAMA_CLOUD_API_KEY', note: 'document parsing' },
  { key: 'LANGCHAIN_API_KEY', note: 'LangSmith tracing (or LANGSMITH_API_KEY)' },
];

export const NPM_PACKAGES = [
  'openai',
  '@langchain/langgraph',
  '@xenova/transformers',
  'cohere-ai',
  'llama-cloud-services',
  '@llamaindex/env',
  '@langchain/textsplitters',
  '@langchain/core',
  'langsmith',
  'gpt-tokenizer',
];

export const STACK_NOTE =
  'This hybrid setup uses a free local model for bulk embedding, a fast small LLM for high-volume checks like security screening, routing and grading, and a large LLM only where reasoning quality matters most, balancing cost, speed and answer accuracy.';
