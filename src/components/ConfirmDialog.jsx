import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex gap-3 p-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0">
            <h2
              id="confirm-title"
              className="text-sm font-semibold text-gray-900 dark:text-gray-50"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</p>
            {detail && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">{detail}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 focus:outline-none disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-gray-900"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
