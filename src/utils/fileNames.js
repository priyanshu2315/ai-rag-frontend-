/**
 * The uploaded file's name for a citation. The documents list has the real
 * name (matched by document id, or by file URL); without it, the last part of
 * the storage URL is what is left. The backend stores files as
 * `<user>/<timestamp>-<name with underscores>`, so the timestamp is dropped.
 */
export const fileNameFromUrl = (fileUrl) => {
  if (typeof fileUrl !== 'string') return null;
  try {
    const last = decodeURIComponent(new URL(fileUrl).pathname.split('/').filter(Boolean).pop() ?? '');
    return last.replace(/^\d{10,}-/, '') || null;
  } catch {
    return null;
  }
};

export const citationFileName = (citation, documents = []) => {
  const known = documents.find((doc) => (citation.documentId && doc.id === citation.documentId)
    || (citation.fileUrl && doc.fileUrl === citation.fileUrl));
  return known?.filename ?? fileNameFromUrl(citation.fileUrl);
};
