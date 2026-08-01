import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Page,
  PageHeader,
  TextField,
} from '../components/ui'

export default function Trash() {
  const { workspace, isOwner, loading: workspaceLoading } = useWorkspace()
  const [bins, setBins] = useState([])
  const [items, setItems] = useState([])
  const [emails, setEmails] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    const [binResult, itemResult, emailResult] = await Promise.all([
      supabase
        .from('containers')
        .select('id, name, short_id, deleted_at, deleted_by')
        .eq('workspace_id', workspace.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      supabase
        .from('items')
        .select('id, name, deleted_at, deleted_by, containers!inner (id, name, deleted_at, workspace_id)')
        .eq('containers.workspace_id', workspace.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      supabase.from('member_emails').select('user_id, email').eq('workspace_id', workspace.id),
    ])

    if (binResult.error) setError(binResult.error.message)
    setBins(binResult.data ?? [])

    // Items that went down with their bin come back when the bin is restored,
    // so only show items that were deleted on their own.
    setItems((itemResult.data ?? []).filter((item) => !item.containers?.deleted_at))

    if (emailResult.data) {
      setEmails(new Map(emailResult.data.map((row) => [row.user_id, row.email])))
    }
    setLoading(false)
  }, [workspace.id])

  useEffect(() => {
    load()
  }, [load])

  async function restoreBin(id, newName) {
    setBusyId(id)
    setError(null)

    const { error: rpcError } = await supabase.rpc('restore_bin', {
      bin_id: id,
      new_name: newName ?? null,
    })
    setBusyId(null)

    if (rpcError) {
      // The old name was taken by a newer bin while this one sat in the trash.
      if (rpcError.message.includes('already exists')) {
        setRenaming({ id, name: newName ?? bins.find((b) => b.id === id)?.name ?? '' })
      }
      return setError(rpcError.message)
    }
    setRenaming(null)
    load()
  }

  async function restoreItem(id) {
    setBusyId(id)
    setError(null)
    const { error: rpcError } = await supabase.rpc('restore_item', { item_id: id })
    setBusyId(null)
    if (rpcError) return setError(rpcError.message)
    load()
  }

  if (workspaceLoading) return null
  if (!isOwner) return <Navigate to="/" replace />

  const isEmpty = bins.length === 0 && items.length === 0

  return (
    <Page>
      <PageHeader
        title="Recently deleted"
        subtitle="Kept for 30 days"
        back={
          <Link
            to="/"
            className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Back to all bins"
          >
            <ArrowLeft size={22} />
          </Link>
        }
      />

      <ErrorBanner>{error}</ErrorBanner>

      {loading ? (
        <p className="py-12 text-center text-base text-gray-400">Loading…</p>
      ) : isEmpty ? (
        <EmptyState icon={Trash2} title="Nothing deleted">
          Deleted bins and items show up here so you can put them back.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {bins.map((bin) => (
            <li key={bin.id}>
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-gray-900 dark:text-gray-50">
                      {bin.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <Deleted at={bin.deleted_at} by={emails.get(bin.deleted_by)} />
                    </p>
                  </div>
                  <Badge>bin</Badge>
                </div>

                {renaming?.id === bin.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      restoreBin(bin.id, renaming.name)
                    }}
                    className="mt-4"
                  >
                    <TextField
                      autoFocus
                      label="Restore under a new name"
                      value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                    />
                    <div className="mt-3 flex gap-2">
                      <Button type="submit" fullWidth>
                        Restore
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setRenaming(null)
                          setError(null)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    variant="secondary"
                    fullWidth
                    className="mt-4"
                    disabled={busyId === bin.id}
                    onClick={() => restoreBin(bin.id)}
                  >
                    <RotateCcw size={20} /> Restore bin
                  </Button>
                )}
              </Card>
            </li>
          ))}

          {items.map((item) => (
            <li key={item.id}>
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-gray-900 dark:text-gray-50">
                      {item.name}
                    </p>
                    <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
                      in {item.containers?.name}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-400">
                      <Deleted at={item.deleted_at} by={emails.get(item.deleted_by)} />
                    </p>
                  </div>
                  <Badge>item</Badge>
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-4"
                  disabled={busyId === item.id}
                  onClick={() => restoreItem(item.id)}
                >
                  <RotateCcw size={20} /> Restore item
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function Deleted({ at, by }) {
  const when = new Date(at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return by ? `Deleted ${when} by ${by}` : `Deleted ${when}`
}
