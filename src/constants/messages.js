/** User-facing copy that appears in more than one place. */
export const MESSAGES = {
  CHAT_ERROR: 'Sorry — I could not answer that. Please try again.',
  NO_ANSWER: "I couldn't find any relevant information in your documents to answer that.",
  STOPPED: 'Stopped',
  STILL_PROCESSING: 'Your document is still processing. Please wait a few seconds!',
  RATE_LIMITED: 'The assistant has hit its usage limit for now.',
  PROCESSING_FAILED:
    "This document couldn't be processed. Please delete it and upload the file again.",
  LOADING_CONVERSATION: 'Loading conversation…',
  DOCUMENT_UNAVAILABLE: 'That document is no longer available — showing all documents instead.',
  ALL_DOCUMENTS: 'All documents',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  NO_CHILD_CHUNKS: 'No child chunks found for this parent',
  NO_PARENT_CHUNKS: 'This document has no chunks yet',
};

/** Chat roles — the only two values `message.role` ever takes. */
export const ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
};

/** Accepted upload types for the document dropzone. */
export const ACCEPTED_DOCUMENT_TYPES = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/*': [],
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB (§8.1)
