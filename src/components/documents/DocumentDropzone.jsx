import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import cn from '../../utils/cn';
import Spinner from '../feedback/Spinner';
import { ACCEPTED_DOCUMENT_TYPES, MAX_UPLOAD_BYTES } from '../../constants/messages';

/** Single-file dropzone. Upload result handling belongs to `onUpload`. */
const DocumentDropzone = ({ onUpload, uploading }) => {
  const onDrop = useCallback(
    (files) => {
      const [file] = files;
      if (file) onUpload(file);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_DOCUMENT_TYPES,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: true,
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
        <span className="font-medium text-blue">Click to upload</span> or drag a file
      </p>
      <p className="text-[11px] text-muted">PDF, DOCX or TXT · up to 5MB</p>
    </div>
  );
};

export default DocumentDropzone;
