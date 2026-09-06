/**
 * The AI vendors, models, and packages behind DocuMind. Mirrors
 * `constants/pipeline.js`: content lives here, the About page just renders
 * it (§2).
 */
export const AI_PLATFORMS = [
  {
    name: 'Universal LLM Engine (Groq & OpenRouter)',
    package: 'openai',
    model: 'gpt-oss-120b / meta-llama/llama-3.3-70b (ReAct) · gpt-oss-20b (Batch)',
    purpose:
      'High-throughput multi-provider cloud inference with fallback routing and rate-limit resilience',
    color: 'blue',
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
    purpose: 'Cross-encoder re-ranking of retrieved chunks',
    color: 'purple',
  },
  {
    name: 'LlamaCloud',
    package: 'llama-cloud-services',
    model: 'LlamaParse Premium',
    purpose: 'Layout-aware OCR and Vision AI with agentic data extraction',
    color: 'amber',
  },
  {
    name: 'LangSmith',
    package: 'langsmith',
    model: 'Tracing & evaluation SDK',
    purpose: 'RAGOps observability and LLM-as-a-Judge evaluations',
    color: 'teal',
  },
];

export const ENV_KEYS = [
  { key: 'AI_PROVIDER', note: 'active inference provider: "groq" | "openrouter"' },
  { key: 'GROQ_API_KEY', note: 'primary fast inference' },
  { key: 'OPENROUTER_API_KEY', note: 'fallback inference / free tier routing' },
  { key: 'COHERE_API_KEY', note: 'used only for the re-ranker' },
  { key: 'LLAMA_CLOUD_API_KEY' },
  { key: 'LANGCHAIN_API_KEY' },
];

export const NPM_PACKAGES = [
  'openai',
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
  'This hybrid setup — using a lightweight local model for heavy ingestion embedding, and a universal OpenAI-compatible client for resilient multi-provider cloud inference — is exactly how production enterprise systems balance speed, cost, and reliability.';
