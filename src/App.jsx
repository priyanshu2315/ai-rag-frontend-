import { useCallback, useState } from 'react'
import { BrainCircuit } from 'lucide-react'
import UploadPanel from './components/UploadPanel'
import ChatPanel from './components/ChatPanel'
import ToastStack from './components/ToastStack'
import { API_BASE_URL, createId } from './api'

export default function App() {
  const [documents, setDocuments] = useState([])
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    ({ tone = 'info', title, message, duration = 4500 }) => {
      const id = createId('toast')
      setToasts((prev) => [...prev, { id, tone, title, message }])
      window.setTimeout(() => dismissToast(id), duration)
    },
    [dismissToast],
  )

  const readyCount = documents.filter((doc) => doc.status === 'ready').length

  return (
    <div className="app">
      <header className="app__bar">
        <div className="brand">
          <span className="brand__mark">
            <BrainCircuit size={19} strokeWidth={2.2} />
          </span>
          <span>
            <h1 className="brand__name">DocuMind</h1>
            <p className="brand__tag">Retrieval-augmented answers from your PDFs</p>
          </span>
        </div>

        <div className="app__meta">
          <span className="pill">
            {readyCount} {readyCount === 1 ? 'document' : 'documents'} indexed
          </span>
          <span className="pill">
            <span className="pill__dot" aria-hidden="true" />
            <code>{API_BASE_URL.replace(/^https?:\/\//, '')}</code>
          </span>
        </div>
      </header>

      <main className="workspace">
        <UploadPanel
          documents={documents}
          setDocuments={setDocuments}
          onToast={pushToast}
        />
        <ChatPanel documentCount={readyCount} />
      </main>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
