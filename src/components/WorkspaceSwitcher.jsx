import { useEffect, useState } from 'react'
import { Check, ChevronDown, Home, Plus, X } from 'lucide-react'
import { useWorkspace } from '../lib/workspace'
import { Button, Card, ErrorBanner, TextField } from './ui'

/**
 * Title that doubles as a household picker. Renders as plain text when the user
 * belongs to exactly one household and has no reason to think about the concept.
 */
export default function WorkspaceSwitcher() {
  const { workspace, workspaces, switchWorkspace, createWorkspace } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function close() {
    setOpen(false)
    setCreating(false)
    setName('')
    setError(null)
  }

  async function submit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setBusy(true)
    const { error: createError } = await createWorkspace(trimmed)
    setBusy(false)

    if (createError) return setError(createError.message)
    close()
  }

  const title = (
    <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
      {workspace?.name ?? 'BinThere'}
    </h1>
  )

  // One household and nothing to switch to: keep it a plain heading.
  if (workspaces.length < 2 && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-1 text-left"
        aria-label="Household options"
      >
        {title}
        <ChevronDown size={20} className="shrink-0 text-gray-400" />
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-1 text-left"
        aria-label="Switch household"
      >
        {title}
        <ChevronDown size={20} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
          onClick={close}
          role="presentation"
        >
          <Card
            className="w-full max-w-sm p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                Households
              </h2>
              <button
                onClick={close}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {creating ? (
              <form onSubmit={submit} className="mt-4">
                <TextField
                  autoFocus
                  label="Household name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="The Shop"
                  hint="You will be its owner, with your own separate bins."
                />
                <ErrorBanner>{error}</ErrorBanner>
                <div className="mt-4 flex gap-2">
                  <Button type="submit" fullWidth disabled={busy}>
                    {busy ? 'Creating…' : 'Create'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <ul className="mt-4 space-y-1">
                  {workspaces.map((ws) => {
                    const isActive = ws.id === workspace?.id
                    return (
                      <li key={ws.id}>
                        <button
                          onClick={() => {
                            switchWorkspace(ws.id)
                            close()
                          }}
                          className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition ${
                            isActive
                              ? 'bg-accent/10 text-accent'
                              : 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                          }`}
                        >
                          <Home size={20} className="shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-medium">{ws.name}</span>
                            <span className="block text-sm text-gray-500 dark:text-gray-400">
                              {ws.role}
                            </span>
                          </span>
                          {isActive && <Check size={20} className="shrink-0" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-4"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={20} /> New household
                </Button>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
