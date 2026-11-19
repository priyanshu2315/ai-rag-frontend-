import { useState } from 'react';
import { FileText, X } from 'lucide-react';
import Modal from '../modals/Modal';
import Button from '../buttons/Button';
import Alert from '../feedback/Alert';
import DocumentDropzone from './DocumentDropzone';
import { MESSAGES } from '../../constants/messages';
import { isPdfFile, versionLabel } from '../../utils/documentVersion';
import { formatBytes } from '../../utils/format';

const PDF_ONLY = { 'application/pdf': ['.pdf'] };

/**
 * "Replace with new version" (admin only): pick a PDF, then send it onto the
 * same document. The dialog stays open through the request so its button can
 * spin; the caller closes it once the backend has answered.
 */
const ReplaceDocumentDialog = ({ document: doc, submitting, onReplace, onClose }) => {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const version = versionLabel(doc);

  const pick = (picked) => {
    if (!isPdfFile(picked)) {
      setFile(null);
      setFileError(MESSAGES.REPLACE_PDF_ONLY);
      return;
    }
    setFileError(null);
    setFile(picked);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (file && await onReplace(doc.id, file)) onClose();
  };

  return (
    <Modal
      title="Replace with new version"
      description={`${doc.filename}${version ? ` · ${version}` : ''}`}
      onClose={onClose}
      closeDisabled={submitting}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-[13px] leading-relaxed text-ink-2">
          The new file goes onto this same document: its roles and chats stay. Only the parts that
          changed are processed again, and answers keep coming from the current version until the
          new one is ready.
        </p>

        {file ? (
          <div className="flex items-center gap-2.5 rounded-(--radius-sm) border border-border bg-surface-2 px-3 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink" title={file.name}>{file.name}</span>
            <span className="mono shrink-0 text-[11px] text-muted">{formatBytes(file.size)}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              disabled={submitting}
              aria-label="Choose a different file"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-sm) text-muted hover:bg-chip hover:text-ink disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <DocumentDropzone
            onUpload={pick}
            onReject={pick}
            uploading={submitting}
            accept={PDF_ONLY}
            hint="PDF only"
          />
        )}

        {fileError && <Alert>{fileError}</Alert>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" size="sm" loading={submitting} disabled={!file}>Upload new version</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReplaceDocumentDialog;
