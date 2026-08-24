import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import './ToastStack.css'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export default function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone] ?? Info
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <Icon size={17} strokeWidth={2.2} className="toast__icon" />
            <div className="toast__body">
              {toast.title && <p className="toast__title">{toast.title}</p>}
              {toast.message && <p className="toast__message">{toast.message}</p>}
            </div>
            <button
              type="button"
              className="toast__close"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
