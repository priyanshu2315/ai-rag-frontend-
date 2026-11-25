/** User-facing copy that appears in more than one place. */
export const MESSAGES = {
  CHAT_ERROR: 'Sorry — I could not answer that. Please try again.',
  NO_ANSWER: "I couldn't find any relevant information in your documents to answer that.",
  STOPPED: 'Stopped',
  STILL_PROCESSING: 'Your document is still processing. Please wait a few seconds!',
  RATE_LIMITED: 'The assistant has hit its usage limit for now.',
  PROCESSING_FAILED:
    "This document couldn't be processed. Please delete it and upload the file again.",
  PROGRESS_LOST:
    'Lost contact with the server while this document was processing. Reload the page to check on it, or upload the file again.',
  CHAT_LOCKED: 'Chat unlocks once this document has finished processing…',
  LOADING_CONVERSATION: 'Loading conversation…',
  DOCUMENT_UNAVAILABLE: 'This document is no longer available',
  CHAT_UNAVAILABLE: 'This chat is no longer available',
  ALL_CHATS_DENIED: "You no longer have admin access, so you're seeing only your own chats.",
  RESET_CODE_SENT: 'If the account exists, a reset code has been sent.',
  NO_SHARED_DOCUMENTS: 'No documents have been shared with you yet. Ask your admin for access.',
  ALL_DOCUMENTS: 'All documents',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  NO_CHILD_CHUNKS: 'No child chunks found for this parent',
  NO_PARENT_CHUNKS: 'This document has no chunks yet',
  REPLACE_FAILED: 'The new version could not be processed; the previous version is still in use',
  REPLACE_LOST: 'Lost track of the new version. Refresh the Knowledge base to see whether it is live.',
  REPLACE_PDF_ONLY: 'Only a PDF can replace a document.',
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
  'text/markdown': ['.md', '.markdown'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/*': [],
};
