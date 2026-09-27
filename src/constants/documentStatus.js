/** The `status` the backend puts on every document. */
export const DOCUMENT_STATUS = {
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

export const isProcessing = (doc) => doc?.status === DOCUMENT_STATUS.PROCESSING;

/**
 * True while chat over this document must stay off. Documents with no `status`
 * at all (uploaded before the field existed) are treated as ready.
 */
export const isNotReady = (doc) =>
  doc?.status === DOCUMENT_STATUS.PROCESSING || doc?.status === DOCUMENT_STATUS.FAILED;
