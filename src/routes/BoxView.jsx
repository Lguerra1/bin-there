import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Check, Package, Pencil, Plus, QrCode, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  IconButton,
  Page,
  PageHeader,
  TextField,
} from '../components/ui'

const emptyDraft = { name: '', quantity: 1, notes: '' }

export default function BoxView() {
  const { shortId } = useParams()
  const navigate = useNavigate()
  const { canWrite, canDeleteBins, isOwner } = useWorkspace()
  const [bin, setBin] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showQr, setShowQr] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [pendingDelete, setPendingDelete] = useState(null)
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
    const name = draft.name.trim()
    if (!name) return
    setError(null)

    const { error: insertError } = await supabase.from('items').insert({
      container_id: bin.id,
      name,
      quantity: Number(draft.quantity) || 1,
      notes: draft.notes.trim() || null,
    })

    if (insertError) return setError(insertError.message)
    setDraft(emptyDraft)
    setAdding(false)
    load()
  }

  async function saveEdit(event, id) {
    event.preventDefault()
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
    setDraft(emptyDraft)
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

  if (loading) {
    return (
      <Page>
        <p className="py-20 text-center text-base text-gray-400">Loading…</p>
      </Page>
    )
  }

  if (!bin) {
    return (
      <Page>
        <PageHeader title="Bin not found" back={<BackButton />} />
        <EmptyState icon={Package} title="Nothing here">
          This sticker points to a bin that was deleted, or that you cannot access.
        </EmptyState>
      </Page>
    )
  }

  const stickerUrl = `${window.location.origin}/box/${bin.short_id}`

  const draftFields = (
    <>
      <TextField
        autoFocus
        label="Item"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Christmas lights"
      />
      <div className="mt-3 grid grid-cols-[7rem_1fr] gap-3">
        <TextField
          label="Qty"
          type="number"
          min="0"
          inputMode="numeric"
          value={draft.quantity}
          onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
        />
        <TextField
          label="Notes"
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Optional"
        />
      </div>
    </>
  )

  return (
    <Page>
      <PageHeader
        title={bin.name}
        subtitle={`${items.length} ${items.length === 1 ? 'item' : 'items'}${canWrite ? '' : ' · view only'}`}
        back={<BackButton />}
        actions={
          <IconButton onClick={() => setShowQr(true)} aria-label="Show QR sticker">
            <QrCode size={22} />
          </IconButton>
        }
      />

      <ErrorBanner>{error}</ErrorBanner>

      {canWrite &&
        (adding ? (
          <Card className="mb-4 p-4">
            <form onSubmit={addItem}>
              {draftFields}
              <div className="mt-4 flex gap-2">
                <Button type="submit" fullWidth>
                  Add item
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAdding(false)
                    setDraft(emptyDraft)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Button
            fullWidth
            size="lg"
            className="mb-4"
            onClick={() => {
              setEditingId(null)
              setDraft(emptyDraft)
              setAdding(true)
            }}
          >
            <Plus size={22} /> Add item
          </Button>
        ))}

      {items.length === 0 ? (
        <EmptyState icon={Package} title="This bin is empty">
          {canWrite ? 'Add the first item above.' : 'Nothing has been added yet.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id}>
                <Card className="p-4">
                  <form onSubmit={(e) => saveEdit(e, item.id)}>
                    {draftFields}
                    <div className="mt-4 flex gap-2">
                      <Button type="submit" fullWidth>
                        <Check size={20} /> Save
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(null)
                          setDraft(emptyDraft)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Card>
              </li>
            ) : (
              <li key={item.id}>
                <Card className="flex items-center gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                      {item.name}
                      {item.quantity !== 1 && (
                        <span className="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">
                          ×{item.quantity}
                        </span>
                      )}
                    </p>
                    {item.notes && (
                      <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 gap-1">
                      <IconButton
                        onClick={() => {
                          setAdding(false)
                          setEditingId(item.id)
                          setDraft({
                            name: item.name,
                            quantity: item.quantity,
                            notes: item.notes ?? '',
                          })
                        }}
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil size={20} />
                      </IconButton>
                      <IconButton
                        variant="dangerGhost"
                        onClick={() =>
                          setPendingDelete({ kind: 'item', id: item.id, name: item.name })
                        }
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={20} />
                      </IconButton>
                    </div>
                  )}
                </Card>
              </li>
            ),
          )}
        </ul>
      )}

      {canDeleteBins && (
        <div className="mt-10 text-center">
          <Button variant="dangerGhost" onClick={() => setPendingDelete({ kind: 'bin' })}>
            <Trash2 size={20} /> Delete this bin
          </Button>
        </div>
      )}

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
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm print:bg-transparent print:p-0"
          onClick={() => setShowQr(false)}
        >
          <div
            className="print-area w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl dark:bg-gray-900 print:max-w-none print:rounded-none print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <QRCodeSVG value={stickerUrl} size={224} level="M" className="mx-auto" />
            <p className="mt-5 text-xl font-semibold text-gray-900 dark:text-gray-50">
              {bin.name}
            </p>
            <div className="mt-2 flex justify-center print:hidden">
              <Badge>{bin.short_id}</Badge>
            </div>
            <p className="hidden font-mono text-sm print:block">{bin.short_id}</p>
            <div className="mt-6 flex gap-2 print:hidden">
              <Button fullWidth onClick={() => window.print()}>
                Print
              </Button>
              <Button variant="secondary" onClick={() => setShowQr(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}

function BackButton() {
  return (
    <Link
      to="/"
      className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
      aria-label="Back to all bins"
    >
      <ArrowLeft size={22} />
    </Link>
  )
}
