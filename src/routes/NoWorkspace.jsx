import { useState } from 'react'
import { Home } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useWorkspace } from '../lib/workspace'
import { Button, Card, ErrorBanner, TextField } from '../components/ui'

/**
 * Shown to a signed in account with no membership: either they have not
 * redeemed an invite yet, or they signed up on their own. Either way, starting
 * their own household is a perfectly good thing to do from here.
 */
export default function NoWorkspace() {
  const { user, signOut } = useAuth()
  const { createWorkspace } = useWorkspace()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setBusy(true)
    setError(null)
    const { error: createError } = await createWorkspace(trimmed)
    setBusy(false)
    if (createError) setError(createError.message)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-lg">
            <Home size={30} strokeWidth={1.75} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Start a household
          </h1>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
            Your account is not part of a household yet. Create your own, or open an invite
            link someone sent you.
          </p>
        </div>

        <Card className="p-5">
          <form onSubmit={submit}>
            <TextField
              label="Household name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Our Home"
              hint="You will be its owner and can invite others later."
            />
            <ErrorBanner>{error}</ErrorBanner>
            <Button type="submit" size="lg" fullWidth className="mt-4" disabled={busy}>
              {busy ? 'Creating…' : 'Create household'}
            </Button>
          </form>
        </Card>

        <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
          Signed in as {user?.email} ·{' '}
          <button onClick={signOut} className="underline hover:text-gray-900 dark:hover:text-gray-200">
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}
