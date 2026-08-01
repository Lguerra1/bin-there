import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, RotateCcw, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'

export default function Trash() {
  const { isOwner, loading: workspaceLoading } = useWorkspace()
  const [bins, setBins] = useState([])
  const [items, setItems] = useState([])
  const [emails, setEmails] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [renaming, setRenaming] = useState(null) // { id, name }
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    const [binResult, itemResult, emailResult] = await Promise.all([
      supabase
        .from('containers')
        .select('id, name, short_id, deleted_at, deleted_by')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      supabase
        .from('items')
        .select('id, name, deleted_at, deleted_by, containers (id, name, deleted_at)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      supabase.from('member_emails').select('user_id, email'),
    ])

    if (binResult.error) setError(binResult.error.message)
    setBins(binResult.data ?? [])

    // Items that went down with their bin are restored by restoring the bin, so
    // only show items that were deleted on their own.
    setItems((itemResult.data ?? []).filter((item) => !item.containers?.deleted_at))

    if (emailResult.data) {
      setEmails(new Map(emailResult.data.map((row) => [row.user_id, row.email])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isEmpty = bins.length === 0 && items.length === 0

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
          <h1 className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-50">
            Recently deleted
          </h1>
        </header>

        {error && (
          <p className="mx-3 mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="divide-y divide-gray-100 border-y border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : isEmpty ? (
            <p className="px-3 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Nothing has been deleted recently.
            </p>
          ) : (
            <>
              {bins.map((bin) => (
                <div key={bin.id} className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-gray-900 dark:text-gray-100">{bin.name}</span>
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-500 uppercase dark:bg-gray-800 dark:text-gray-400">
                        bin
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <Deleted at={bin.deleted_at} by={emails.get(bin.deleted_by)} />
                      </p>
                    </div>
                    <button
                      onClick={() => restoreBin(bin.id)}
                      disabled={busyId === bin.id}
                      className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50"
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                  </div>

                  {renaming?.id === bin.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        restoreBin(bin.id, renaming.name)
                      }}
                      className="mt-2 flex items-center gap-2 rounded border border-gray-200 px-2 py-1.5 dark:border-gray-700"
                    >
                      <input
                        autoFocus
                        value={renaming.name}
                        onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                        placeholder="New bin name"
                        className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none dark:text-gray-100"
                      />
                      <button
                        type="submit"
                        className="rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover"
                      >
                        Restore as this
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenaming(null)}
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        aria-label="Cancel rename"
                      >
                        <X size={15} />
                      </button>
                    </form>
                  )}
                </div>
              ))}

              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{item.name}</span>
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      in {item.containers?.name}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <Deleted at={item.deleted_at} by={emails.get(item.deleted_by)} />
                    </p>
                  </div>
                  <button
                    onClick={() => restoreItem(item.id)}
                    disabled={busyId === item.id}
                    className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-600">
          Deleted bins and items stay here for 30 days.
        </p>
      </div>
    </div>
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
