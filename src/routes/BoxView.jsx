import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Check, Pencil, QrCode, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import ConfirmDialog from '../components/ConfirmDialog'

const fieldClass =
  'bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100'

export default function BoxView() {
  const { shortId } = useParams()
  const navigate = useNavigate()
  const { canWrite, canDeleteBins, isOwner } = useWorkspace()
  const [bin, setBin] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({ name: '', quantity: 1, notes: '' })
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, notes: '' })
  const [pendingDelete, setPendingDelete] = useState(null) // {kind:'item'|'bin', ...}
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const { data: binRow, error: binError } = await supabase
      .from('containers')
      .select('id, short_id, name, workspace_id')
      .eq('short_id', shortId)
      .is('deleted_at', null)
      .maybeSingle()

    if (binError) {
      setError(binError.message)
      setLoading(false)
      return
    }
    setBin(binRow)

    if (binRow) {
      const { data: itemRows, error: itemError } = await supabase
        .from('items')
        .select('id, name, quantity, notes')
        .eq('container_id', binRow.id)
        .is('deleted_at', null)
        .order('name')

      if (itemError) setError(itemError.message)
      else setItems(itemRows ?? [])
    }
    setLoading(false)
  }, [shortId])

  useEffect(() => {
    load()
  }, [load])

  async function addItem(event) {
    event.preventDefault()
    const name = newItem.name.trim()
    if (!name) return
    setError(null)

    const { error: insertError } = await supabase.from('items').insert({
      container_id: bin.id,
      name,
      quantity: Number(newItem.quantity) || 1,
      notes: newItem.notes.trim() || null,
    })

    if (insertError) return setError(insertError.message)
    setNewItem({ name: '', quantity: 1, notes: '' })
    load()
  }

  async function saveEdit(id) {
    setError(null)
    const { error: updateError } = await supabase
      .from('items')
      .update({
        name: draft.name.trim(),
        quantity: Number(draft.quantity) || 0,
        notes: draft.notes.trim() || null,
      })
      .eq('id', id)

    if (updateError) return setError(updateError.message)
    setEditingId(null)
    load()
  }

  async function confirmDelete() {
    setDeleting(true)
    setError(null)

    if (pendingDelete.kind === 'item') {
      const { error: rpcError } = await supabase.rpc('soft_delete_item', {
        item_id: pendingDelete.id,
      })
      setDeleting(false)
      setPendingDelete(null)
      if (rpcError) return setError(rpcError.message)
      return load()
    }

    const { error: rpcError } = await supabase.rpc('soft_delete_bin', { bin_id: bin.id })
    setDeleting(false)
    setPendingDelete(null)
    if (rpcError) return setError(rpcError.message)
    navigate('/', { replace: true })
  }

  if (loading) return <Centered>Loading…</Centered>

  if (!bin) {
    return (
      <Centered>
        <p className="font-medium text-gray-900 dark:text-gray-100">Bin not found</p>
        <p className="mt-1">
          This sticker points to a bin that was deleted, or that you cannot access.
        </p>
        <Link to="/" className="mt-4 inline-block text-accent hover:underline">
          Back to all bins
        </Link>
      </Centered>
    )
  }

  const stickerUrl = `${window.location.origin}/box/${bin.short_id}`

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-2 px-3 py-3">
          <Link
            to="/"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Back to all bins"
          >
            <ArrowLeft size={17} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
            {bin.name}
            {!canWrite && (
              <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">view only</span>
            )}
          </h1>
          <button
            onClick={() => setShowQr(true)}
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
          >
            <QrCode size={15} /> Sticker
          </button>
        </header>

        {error && (
          <p className="mx-3 mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="divide-y divide-gray-100 border-y border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {canWrite && (
            <form onSubmit={addItem} className="flex items-center gap-2 px-3 py-2">
              <input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Add an item…"
                className={`${fieldClass} min-w-0 flex-1`}
              />
              <input
                type="number"
                min="0"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                className={`${fieldClass} w-10 text-right tabular-nums`}
                aria-label="Quantity"
              />
              <input
                value={newItem.notes}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                placeholder="notes"
                className={`${fieldClass} w-20 shrink-0`}
              />
              <button
                type="submit"
                className="shrink-0 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Add
              </button>
            </form>
          )}

          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              This bin is empty.
            </p>
          ) : (
            items.map((item) =>
              editingId === item.id ? (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                  <input
                    autoFocus
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className={`${fieldClass} min-w-0 flex-1`}
                  />
                  <input
                    type="number"
                    min="0"
                    value={draft.quantity}
                    onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                    className={`${fieldClass} w-10 text-right tabular-nums`}
                    aria-label="Quantity"
                  />
                  <input
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    placeholder="notes"
                    className={`${fieldClass} w-20 shrink-0`}
                  />
                  <button
                    onClick={() => saveEdit(item.id)}
                    className="shrink-0 text-accent hover:text-accent-hover"
                    aria-label="Save"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    aria-label="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{item.name}</span>
                    {item.notes && (
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400">
                    {item.quantity}
                  </span>
                  {canWrite && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => {
                          setEditingId(item.id)
                          setDraft({
                            name: item.name,
                            quantity: item.quantity,
                            notes: item.notes ?? '',
                          })
                        }}
                        className="p-1 text-gray-300 hover:text-gray-700 dark:text-gray-600 dark:hover:text-gray-200"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() =>
                          setPendingDelete({ kind: 'item', id: item.id, name: item.name })
                        }
                        className="p-1 text-gray-300 hover:text-red-600 dark:text-gray-600 dark:hover:text-red-400"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ),
            )
          )}
        </div>

        <div className="flex items-baseline justify-between px-3 py-2">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
          {canDeleteBins && (
            <button
              onClick={() => setPendingDelete({ kind: 'bin' })}
              className="text-xs text-gray-400 hover:text-red-600 dark:text-gray-600 dark:hover:text-red-400"
            >
              Delete bin
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete?.kind === 'item'}
        title="Delete this item?"
        message={`"${pendingDelete?.name}" will be removed from ${bin.name}.`}
        detail={isOwner ? 'You can restore it from the trash for 30 days.' : undefined}
        confirmLabel="Delete item"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingDelete?.kind === 'bin'}
        title={`Delete "${bin.name}"?`}
        message={
          items.length > 0
            ? `This bin and all ${items.length} ${items.length === 1 ? 'item' : 'items'} inside it will be removed.`
            : 'This bin will be removed.'
        }
        detail="Any sticker already printed for this bin will stop working. Deleted bins can be restored for 30 days."
        confirmLabel="Delete bin"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {showQr && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] print:bg-transparent print:p-0"
          onClick={() => setShowQr(false)}
        >
          <div
            className="print-area w-full max-w-xs rounded-xl border border-gray-200 bg-white p-6 text-center shadow-xl dark:border-gray-800 dark:bg-gray-900 print:max-w-none print:rounded-none print:border-0 print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <QRCodeSVG value={stickerUrl} size={200} level="M" className="mx-auto" />
            <p className="mt-4 font-semibold text-gray-900 dark:text-gray-100">{bin.name}</p>
            <p className="font-mono text-xs text-gray-400">{bin.short_id}</p>
            <div className="mt-5 flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Print
              </button>
              <button
                onClick={() => setShowQr(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Centered({ children }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-950">
      <div className="text-sm text-gray-500 dark:text-gray-400">{children}</div>
    </div>
  )
}
