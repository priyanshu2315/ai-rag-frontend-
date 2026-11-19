import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import cn from '../../utils/cn';
import Spinner from '../feedback/Spinner';
import { ACCEPTED_DOCUMENT_TYPES } from '../../constants/messages';

const DEFAULT_HINT = 'PDF, TXT, Markdown or image · DOCX requires LlamaParse ingestion';

/**
 * Single-file dropzone. Upload result handling belongs to `onUpload`.
 * `accept` / `hint` narrow it (Replace takes PDFs only); `onReject` gets the
 * file react-dropzone turned away, so the caller can say why.
 */
const DocumentDropzone = ({ onUpload, uploading, accept = ACCEPTED_DOCUMENT_TYPES, hint = DEFAULT_HINT, onReject }) => {
  const onDrop = useCallback(
    (files, rejected) => {
      const [file] = files;
      if (file) onUpload(file);
      else if (rejected?.length) onReject?.(rejected[0].file);
    },
    [onUpload, onReject]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-1.5 rounded-(--radius) border border-dashed p-5 text-center transition-colors',
        uploading && 'cursor-wait opacity-60',
        isDragActive ? 'border-blue bg-blue-lt' : 'border-border-2 bg-surface-2 hover:border-blue'
      )}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <Spinner className="h-6 w-6" />
      ) : (
        <UploadCloud className={cn('h-6 w-6', isDragActive ? 'text-blue' : 'text-muted-2')} />
      )}

      <p className="text-[13px] text-ink-2">
        <span className="font-medium text-blue sm:hidden">Tap to upload</span>
        <span className="hidden font-medium text-blue sm:inline">Click to upload</span>
        <span className="hidden sm:inline"> or drag a file</span>
      </p>
      <p className="text-[11px] text-muted">{hint}</p>
    </div>
  );
};

export default DocumentDropzone;
