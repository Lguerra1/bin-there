import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui'

/**
 * Replaces window.confirm(). Escape cancels, the backdrop cancels, and focus
 * lands on Cancel so a stray Enter never destroys anything.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    cancelRef.current?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
          <AlertTriangle size={26} strokeWidth={1.75} />
        </div>

        <h2
          id="confirm-title"
          className="mt-4 text-center text-xl font-semibold text-gray-900 dark:text-gray-50"
        >
          {title}
        </h2>
        <p className="mt-2 text-center text-base text-gray-600 dark:text-gray-400">{message}</p>
        {detail && (
          <p className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-center text-sm text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            {detail}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            ref={cancelRef}
            variant="secondary"
            fullWidth
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button variant="danger" fullWidth onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
