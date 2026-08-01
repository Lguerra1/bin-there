import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useWorkspace } from '../lib/workspace'

export default function Dashboard() {
  const { signOut } = useAuth()
  const { workspace, role, canWrite, isOwner } = useWorkspace()
  const [bins, setBins] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    // Items are pulled in full so the list can show per-bin counts and search
    // across contents without a round trip per bin. At household scale this is
    // a few hundred rows.
    const [binResult, itemResult] = await Promise.all([
      supabase.from('containers').select('id, short_id, name').is('deleted_at', null).order('name'),
      supabase.from('items').select('id, name, container_id').is('deleted_at', null),
    ])

    if (binResult.error) setError(binResult.error.message)
    else setBins(binResult.data ?? [])
    if (itemResult.data) setItems(itemResult.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const countsByBin = useMemo(() => {
    const counts = new Map()
    for (const item of items) {
      counts.set(item.container_id, (counts.get(item.container_id) ?? 0) + 1)
    }
    return counts
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return bins.map((bin) => ({ bin, matches: [] }))

    return bins
      .map((bin) => {
        const matches = items
          .filter((item) => item.container_id === bin.id && item.name.toLowerCase().includes(q))
          .map((item) => item.name)
        return { bin, matches, nameHit: bin.name.toLowerCase().includes(q) }
      })
      .filter((row) => row.nameHit || row.matches.length > 0)
  }, [bins, items, query])

  async function createBin(event) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setError(null)

    const { error: insertError } = await supabase
      .from('containers')
      .insert({ workspace_id: workspace.id, name })

    if (insertError) {
      // 23505 is the unique index on (workspace_id, lower(name)).
      setError(
        insertError.code === '23505'
          ? `A bin named "${name}" already exists.`
          : insertError.message,
      )
      return
    }
    setNewName('')
    setAdding(false)
    load()
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-baseline justify-between px-3 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
              {workspace?.name}
              <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">{role}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {canWrite && !adding && (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
              >
                <Plus size={15} /> New bin
              </button>
            )}
            {isOwner && (
              <Link
                to="/trash"
                className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Trash
              </Link>
            )}
            <button
              onClick={signOut}
              className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="border-y border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          {adding && (
            <form
              onSubmit={createBin}
              className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Bin name"
                className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
              />
              <button
                type="submit"
                className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setNewName('')
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </form>
          )}

          <div className="flex items-center gap-2 px-3 py-2">
            <Search size={15} className="shrink-0 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bins and items…"
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mx-3 mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="divide-y divide-gray-100 border-b border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              {query
                ? `Nothing matches "${query}".`
                : canWrite
                  ? 'No bins yet. Create one to get started.'
                  : 'No bins in this workspace yet.'}
            </p>
          ) : (
            visible.map(({ bin, matches }) => (
              <Link
                key={bin.id}
                to={`/box/${bin.short_id}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-gray-900 dark:text-gray-100">{bin.name}</span>
                  {matches.length > 0 && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {matches.slice(0, 3).join(', ')}
                      {matches.length > 3 && ` +${matches.length - 3} more`}
                    </p>
                  )}
                </div>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400">
                  {countsByBin.get(bin.id) ?? 0}
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs text-gray-400 dark:text-gray-600">
                  {bin.short_id}
                </span>
                <ChevronRight size={15} className="shrink-0 text-gray-300 dark:text-gray-700" />
              </Link>
            ))
          )}
        </div>

        {!loading && bins.length > 0 && (
          <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-600">
            {items.length} {items.length === 1 ? 'item' : 'items'} across {bins.length}{' '}
            {bins.length === 1 ? 'bin' : 'bins'}
          </p>
        )}
      </div>
    </div>
  )
}
