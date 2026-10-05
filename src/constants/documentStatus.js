/** The `status` the backend puts on every document. */
export const DOCUMENT_STATUS = {
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

export const SUMMARY_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

export const isProcessing = (doc) => doc?.status === DOCUMENT_STATUS.PROCESSING;

export const canDeleteDocument = (doc) =>
  doc?.status === DOCUMENT_STATUS.COMPLETED || doc?.status === DOCUMENT_STATUS.FAILED;

/**
 * Questions become available only after saved chunks are marked COMPLETED.
 */
export const isNotReady = (doc) =>
  Boolean(doc) && doc.status !== DOCUMENT_STATUS.COMPLETED;

export const isSummaryPending = (doc) =>
  doc?.status === DOCUMENT_STATUS.COMPLETED &&
  (doc.summaryStatus === SUMMARY_STATUS.PENDING || doc.summaryStatus === SUMMARY_STATUS.PROCESSING);

export const needsProgress = (doc) => isProcessing(doc) || isSummaryPending(doc);

export const canRequestSummary = (doc) =>
  doc?.status === DOCUMENT_STATUS.COMPLETED && doc.summaryStatus === SUMMARY_STATUS.COMPLETED;
