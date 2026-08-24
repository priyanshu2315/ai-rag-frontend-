import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderOpen,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { createId, toErrorMessage, uploadDocument } from '../api'
import './UploadPanel.css'

const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

export default function UploadPanel({ documents, setDocuments, onToast }) {
  const patchDocument = useCallback(
    (id, patch) => {
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
      )
    },
    [setDocuments],
  )

  const handleDrop = useCallback(
    async (acceptedFiles, fileRejections) => {
      fileRejections.forEach((rejection) => {
        onToast({
          tone: 'error',
          title: 'File rejected',
          message: `${rejection.file.name}: ${
            rejection.errors[0]?.code === 'file-too-large'
              ? 'exceeds the 25 MB limit.'
              : 'only PDF files are supported.'
          }`,
        })
      })

      // Sequential so the backend isn't hit with N parallel ingest jobs.
      for (const file of acceptedFiles) {
        const id = createId('doc')

        setDocuments((prev) => [
          {
            id,
            name: file.name,
            size: file.size,
            status: 'uploading',
            progress: 0,
          },
          ...prev,
        ])

        try {
          const data = await uploadDocument(file, {
            onProgress: (progress) => patchDocument(id, { progress }),
          })

          patchDocument(id, {
            status: 'ready',
            progress: 100,
            chunks: data?.chunks ?? data?.chunkCount ?? null,
          })

          onToast({
            tone: 'success',
            title: 'Document indexed',
            message: `${file.name} is ready to query.`,
          })
        } catch (error) {
          const message = toErrorMessage(error)
          patchDocument(id, { status: 'error', error: message })
          onToast({
            tone: 'error',
            title: 'Upload failed',
            message: `${file.name} — ${message}`,
          })
        }
      }
    },
    [onToast, patchDocument, setDocuments],
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop: handleDrop,
      accept: { 'application/pdf': ['.pdf'] },
      maxSize: MAX_SIZE,
      multiple: true,
    })

  const removeFromList = (id) =>
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))

  const uploadingCount = documents.filter(
    (doc) => doc.status === 'uploading',
  ).length

  return (
    <section className="panel upload">
      <header className="panel__head">
        <div>
          <h2 className="panel__title">
            <FolderOpen size={16} strokeWidth={2.2} />
            Document Manager
          </h2>
          <p className="panel__subtitle">
            {uploadingCount > 0
              ? `Uploading ${uploadingCount} file${uploadingCount === 1 ? '' : 's'}…`
              : 'PDF files up to 25 MB'}
          </p>
        </div>
        <span className="count-badge">{documents.length}</span>
      </header>

      <div className="upload__body">
        <div
          {...getRootProps({
            className: [
              'dropzone',
              isDragActive && 'dropzone--active',
              isDragReject && 'dropzone--reject',
            ]
              .filter(Boolean)
              .join(' '),
          })}
        >
          <input {...getInputProps()} />
          <span className="dropzone__icon">
            <UploadCloud size={22} strokeWidth={2} />
          </span>
          <p className="dropzone__title">
            {isDragActive ? 'Drop to upload' : 'Drag & drop a PDF here'}
          </p>
          <p className="dropzone__hint">
            or <span className="dropzone__link">browse your files</span>
          </p>
        </div>

        <div className="doc-list" role="list">
          {documents.length === 0 ? (
            <div className="doc-empty">
              <FileText size={20} strokeWidth={1.8} />
              <p>No documents yet</p>
              <span>Uploaded PDFs will appear here.</span>
            </div>
          ) : (
            documents.map((doc) => (
              <article key={doc.id} className="doc" role="listitem">
                <span className={`doc__icon doc__icon--${doc.status}`}>
                  <FileText size={15} strokeWidth={2} />
                </span>

                <div className="doc__body">
                  <p className="doc__name" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="doc__meta">
                    <span>{formatBytes(doc.size)}</span>
                    <span className="doc__dot" />
                    <StatusLabel doc={doc} />
                  </p>

                  {doc.status === 'uploading' && (
                    <div
                      className="doc__progress"
                      role="progressbar"
                      aria-valuenow={doc.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${doc.progress}%` }} />
                    </div>
                  )}
                </div>

                {doc.status !== 'uploading' && (
                  <button
                    type="button"
                    className="doc__remove"
                    onClick={() => removeFromList(doc.id)}
                    title="Remove from list"
                    aria-label={`Remove ${doc.name} from list`}
                  >
                    <X size={14} strokeWidth={2.4} />
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function StatusLabel({ doc }) {
  if (doc.status === 'uploading') {
    return (
      <span className="doc__status doc__status--uploading">
        <Loader2 size={12} className="spin" strokeWidth={2.5} />
        Uploading {doc.progress}%
      </span>
    )
  }

  if (doc.status === 'error') {
    return (
      <span className="doc__status doc__status--error" title={doc.error}>
        <AlertCircle size={12} strokeWidth={2.5} />
        {doc.error}
      </span>
    )
  }

  return (
    <span className="doc__status doc__status--ready">
      <CheckCircle2 size={12} strokeWidth={2.5} />
      Indexed{doc.chunks ? ` · ${doc.chunks} chunks` : ''}
    </span>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}
