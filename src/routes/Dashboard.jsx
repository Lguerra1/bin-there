import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, ChevronRight, LogOut, Plus, Trash2, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useWorkspace } from '../lib/workspace'
import WorkspaceSwitcher from '../components/WorkspaceSwitcher'
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

export default function Dashboard() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
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
      supabase
        .from('containers')
        .select('id, short_id, name')
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .order('name'),
      supabase
        .from('items')
        .select('id, name, container_id, containers!inner(workspace_id)')
        .eq('containers.workspace_id', workspace.id)
        .is('deleted_at', null),
    ])

    if (binResult.error) setError(binResult.error.message)
    else setBins(binResult.data ?? [])
    if (itemResult.data) setItems(itemResult.data)
    setLoading(false)
  }, [workspace.id])

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
    <Page>
      <PageHeader
        title={<WorkspaceSwitcher />}
        subtitle={`${bins.length} ${bins.length === 1 ? 'bin' : 'bins'} · ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
        actions={
          <div className="flex items-center gap-1">
            {isOwner && (
              <>
                <IconButton onClick={() => navigate('/members')} aria-label="Members">
                  <Users size={20} />
                </IconButton>
                <IconButton onClick={() => navigate('/trash')} aria-label="Recently deleted">
                  <Trash2 size={20} />
                </IconButton>
              </>
            )}
            <IconButton onClick={signOut} aria-label="Sign out">
              <LogOut size={20} />
            </IconButton>
          </div>
        }
      />

      <ErrorBanner>{error}</ErrorBanner>

      {canWrite &&
        (adding ? (
          <Card className="mb-4 p-4">
            <form onSubmit={createBin}>
              <TextField
                autoFocus
                label="Bin name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Garage shelf 3"
              />
              <div className="mt-3 flex gap-2">
                <Button type="submit" fullWidth>
                  Create bin
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAdding(false)
                    setNewName('')
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Button fullWidth size="lg" className="mb-4" onClick={() => setAdding(true)}>
            <Plus size={22} /> New bin
          </Button>
        ))}

      {bins.length > 3 && (
        <div className="relative mb-4">
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bins and items…"
            className="pr-12"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute top-0 right-0 flex h-12 w-12 items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Clear search"
            >
              <X size={20} />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-base text-gray-400">Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState icon={Box} title={query ? 'No matches' : 'No bins yet'}>
          {query
            ? `Nothing matches "${query}".`
            : canWrite
              ? 'Create your first bin, then print a QR sticker for it.'
              : 'Nothing has been added to this workspace yet.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map(({ bin, matches }) => {
            const count = countsByBin.get(bin.id) ?? 0
            return (
              <li key={bin.id}>
                <Link to={`/box/${bin.short_id}`} className="block">
                  <Card className="flex items-center gap-4 p-5 transition hover:border-accent/40 hover:shadow-md">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold text-gray-900 dark:text-gray-50">
                        {bin.name}
                      </p>
                      <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
                        {count} {count === 1 ? 'item' : 'items'}
                      </p>
                      {matches.length > 0 && (
                        <p className="mt-2 truncate text-sm text-accent">
                          {matches.slice(0, 3).join(', ')}
                          {matches.length > 3 && ` +${matches.length - 3} more`}
                        </p>
                      )}
                    </div>
                    <Badge>{bin.short_id}</Badge>
                    <ChevronRight size={22} className="shrink-0 text-gray-300 dark:text-gray-600" />
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-sm text-gray-400 dark:text-gray-600">
        Signed in as {role}
      </p>
    </Page>
  )
}
