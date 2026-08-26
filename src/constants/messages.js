/** User-facing copy that appears in more than one place. */
export const MESSAGES = {
  CHAT_ERROR: 'Sorry — I could not answer that. Please try again.',
  NO_ANSWER: "I couldn't find any relevant information in your documents to answer that.",
  STOPPED: 'Stopped',
  ALL_DOCUMENTS: 'All documents',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
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
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB (§8.1)
