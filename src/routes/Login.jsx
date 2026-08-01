import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Package } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Button, Card, ErrorBanner, TextField } from '../components/ui'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Arriving from an invite link almost always means a brand new person.
  const fromInvite = Boolean(location.state?.invite)
  const [mode, setMode] = useState(fromInvite ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Where the user was headed before they hit the login wall -- a scanned
  // sticker at /box/a1b2c3, or an invite at /invite/<token>.
  const returnTo = location.state?.from ?? '/'

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const action = mode === 'signup' ? signUp : signIn
    const { error: authError } = await action(email.trim(), password)

    if (authError) {
      setError(authError.message)
      setBusy(false)
      return
    }
    navigate(returnTo, { replace: true })
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-lg">
            <Package size={32} strokeWidth={1.75} />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            BinThere
          </h1>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
            {fromInvite
              ? 'Create an account to accept your invite.'
              : 'Know what is in every box.'}
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
            />

            <ErrorBanner>{error}</ErrorBanner>

            <Button type="submit" size="lg" fullWidth disabled={busy}>
              {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup')
            setError(null)
          }}
          className="mt-5 w-full text-center text-base text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {mode === 'signup'
            ? 'Already have an account? Sign in'
            : 'Have an invite? Create an account'}
        </button>
      </div>
    </div>
  )
}
