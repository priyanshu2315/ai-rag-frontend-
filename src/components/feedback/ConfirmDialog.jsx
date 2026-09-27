import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import Button from '../buttons/Button';

/**
 * A blocking yes/no prompt for anything hard to reverse.
 *
 * `window.confirm` works, but it is the browser's own chrome — it freezes the
 * tab and looks nothing like the rest of the app. This is the one place a
 * destructive action pauses for a second opinion instead.
 *
 * Portaled to the body and Escape-closable, the same way `DocumentPreview`
 * is: every ancestor inside the shell clips, and Escape is how a modal
 * closes without hunting for the one button that does it.
 */
const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, loading]);

  return createPortal(
    <div
      role="presentation"
      // The backdrop cancels, same as the Escape key — but not mid-request,
      // or a stray click would abandon a delete that is already committed.
      onClick={() => !loading && onCancel()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 p-4 backdrop-blur-[2px]"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? 'confirm-dialog-message' : undefined}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-(--radius-lg) border border-border bg-surface p-5 shadow-(--sh-lg)"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-bg text-red">
            <AlertTriangle className="h-4 w-4" />
          </span>

          <div className="min-w-0 pt-1">
            <h2 id="confirm-dialog-title" className="font-display text-[14px] font-semibold text-ink">
              {title}
            </h2>
            {message && (
              <p id="confirm-dialog-message" className="mt-1 text-[13px] leading-relaxed text-muted">
                {message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
